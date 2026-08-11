import { AlertTriangle, ExternalLink, Info, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AudiencePicker from './AudiencePicker';
import { GROUPS, ORG, PRIVATE } from './publishAccessSummary';
import Modal from '../../../../shared/Modal';
import toast from '../../../../shared/Toast';
import { studioAppsApi } from '../studioAppsApi';

/**
 * Publish modal — the three-way audience picker for an App Studio app.
 *
 *   Private            → unpublish            → PATCH { isPublished: false }
 *   Entire organization→ share org-wide       → PATCH { isPublished: true, sharedGroups: [] }
 *   Specific groups    → share to groups only  → PATCH { isPublished: true, sharedGroups: [ids] }
 *
 * The server (PATCH /:id/publish) validates sharedGroups against the app's org;
 * the modal only builds the payload. On success it hands the merged, id-bearing
 * app back through onPublished so the editor chrome (and the shell's open row)
 * stay in sync — the same success shape EditorHeader's old inline stub used, but
 * merged with the app so the identity/name survive.
 *
 * A publish the server refuses (422) is NOT an error toast: the response
 * carries the full { errors, warnings } list of what stands in the way, each
 * entry a { code, severity, path, message, hint }. The modal stays open and
 * renders that list, resolving each entry's `path` back to the node it points
 * at so "Show me" can jump the user straight to it.
 *
 * The audience choice and what it hands people in the app's tables live in
 * AudiencePicker — the modal only owns the payload and the server's answer.
 */

/** Which audience the app is CURRENTLY published to. */
function audienceOf(app) {
    const published = !!(app?.isPublished ?? app?.is_published);
    if (!published) return PRIVATE;
    const groups = sharedGroupsOf(app);
    return groups.length > 0 ? GROUPS : ORG;
}

function sharedGroupsOf(app) {
    const g = app?.sharedGroups ?? app?.shared_groups;
    return Array.isArray(g) ? g.map((x) => String(x)).filter(Boolean) : [];
}

function formatWhen(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString();
}

const AUDIENCE_LABEL = {
    [PRIVATE]: 'Private draft',
    [ORG]: 'Everyone in your organization',
    [GROUPS]: 'Specific groups',
};

const PATH_STEP_RE = /^(screens|sections|children)\[(\d+)\]$/;

/**
 * Walk a validator `path` ("screens[0].sections[1].children[2].props.title")
 * down the definition to the thing the editor can actually select: the
 * deepest addressed section/element id, plus the page it sits on. Trailing
 * segments that aren't a screen/section/child step (props, filters, …) stop
 * the walk — they address a field inside the node we already found.
 * Returns null when the path doesn't start at a real screen.
 */
function resolveIssueTarget(definition, path) {
    if (typeof path !== 'string') return null;
    let screen = null;
    let cursor = null;
    let nodeId = null;
    for (const part of path.split('.')) {
        const m = PATH_STEP_RE.exec(part);
        if (!m) break;
        const list = m[1] === 'screens' ? definition?.screens : cursor?.[m[1]];
        cursor = Array.isArray(list) ? list[Number(m[2])] : null;
        if (!cursor) break;
        if (m[1] === 'screens') screen = cursor;
        else if (cursor.id != null) nodeId = String(cursor.id);
    }
    if (!screen) return null;
    return {
        screenId: screen.id != null ? String(screen.id) : null,
        screenName: screen.name || null,
        nodeId,
    };
}

function asIssueList(value) {
    return Array.isArray(value) ? value.filter((e) => e && typeof e === 'object') : [];
}

export default function PublishModal({ open, onClose, app, onPublished, definition, onRevealNode }) {
    const currentAudience = audienceOf(app);
    const currentGroups = useMemo(() => sharedGroupsOf(app), [app]);
    const publishedAt = formatWhen(app?.publishedAt ?? app?.published_at);
    const isPublished = !!(app?.isPublished ?? app?.is_published);

    const [audience, setAudience] = useState(currentAudience);
    const [selectedGroups, setSelectedGroups] = useState(() => new Set(currentGroups));
    const [busy, setBusy] = useState(false);
    // What the server said stands in the way of publishing, straight from the
    // 422 body: { errors, warnings }. null until a publish is refused.
    const [blockers, setBlockers] = useState(null);

    // Reset the draft each time the modal opens so a re-open starts from the
    // app's real, current audience.
    useEffect(() => {
        if (!open) return;
        setAudience(audienceOf(app));
        setSelectedGroups(new Set(sharedGroupsOf(app)));
        setBusy(false);
        setBlockers(null);
    }, [open, app]);

    // A different audience is a different attempt — the previous refusal no
    // longer describes what the Apply button would do.
    const chooseAudience = (next) => {
        setAudience(next);
        setBlockers(null);
    };

    const toggleGroup = (id) => {
        setSelectedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // "Specific groups" needs at least one group selected — otherwise it is
    // indistinguishable from an org-wide publish (and the server would treat an
    // empty list as org-wide).
    const groupsIncomplete = audience === GROUPS && selectedGroups.size === 0;
    const canApply = !busy && !groupsIncomplete;

    const buildPayload = () => {
        if (audience === PRIVATE) return { isPublished: false };
        if (audience === ORG) return { isPublished: true, sharedGroups: [] };
        return { isPublished: true, sharedGroups: [...selectedGroups] };
    };

    const doApply = async () => {
        if (!app?.id || !canApply) return;
        const payload = buildPayload();
        setBusy(true);
        setBlockers(null);
        try {
            const res = await studioAppsApi.publish(app.id, payload);
            const nextPublished = res?.isPublished ?? payload.isPublished;
            const nextGroups = res?.sharedGroups ?? payload.sharedGroups ?? [];
            onPublished?.({
                ...app,
                isPublished: nextPublished,
                sharedGroups: nextGroups,
                // Which draft is now live — the server reports it so the "live
                // copy is behind your edits" indicator settles immediately
                // instead of waiting for the next app fetch.
                publishedVersion: res?.publishedVersion ?? app?.publishedVersion ?? null,
                // Stamp an optimistic publish time; the server sets published_at
                // = NOW() and keeps the previous value on unpublish.
                publishedAt: nextPublished
                    ? new Date().toISOString()
                    : (app?.publishedAt ?? app?.published_at ?? null),
            });
            toast.success(
                payload.isPublished
                    ? (audience === GROUPS ? 'App shared with the selected groups.' : 'App published to your organization.')
                    : 'App unpublished — it is a private draft again.',
            );
            onClose?.();
        } catch (err) {
            // 422 = the server already listed exactly what's wrong. Keep the
            // modal open and show that list instead of a toast the user can't
            // act on. Everything else really is an unexpected failure.
            const errors = err?.status === 422 ? asIssueList(err?.body?.errors) : [];
            if (errors.length > 0) {
                setBlockers({ errors, warnings: asIssueList(err?.body?.warnings) });
            } else {
                toast.error(err?.message || 'Publishing failed.');
            }
        } finally {
            setBusy(false);
        }
    };

    const liveHref = app?.id ? `/app/apps/${app.id}` : null;

    // Prefer the live editor definition when the chrome hands one down; the
    // stored app row is the fallback for callers that only have the row.
    const resolveAgainst = definition ?? app?.definition ?? null;
    const revealTarget = (issue) => {
        if (!onRevealNode) return null;
        const target = resolveIssueTarget(resolveAgainst, issue?.path);
        return (target && (target.nodeId || target.screenId)) ? target : null;
    };

    const doReveal = (target) => {
        onRevealNode?.({ nodeId: target.nodeId, screenId: target.screenId });
        onClose?.();
    };

    return (
        <Modal
            open={open}
            onClose={() => !busy && onClose?.()}
            title="Publish app"
            description="Choose who can open this app. Publishing takes a copy of the app as it is now — you can keep editing afterwards, and readers stay on that copy until you publish again."
            size="md"
            footer={(
                <>
                    <button
                        type="button"
                        onClick={() => onClose?.()}
                        disabled={busy}
                        className="rounded-lg bg-white/5 px-4 py-2 text-sm hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={doApply}
                        disabled={!canApply}
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                        Apply
                    </button>
                </>
            )}
        >
            <div className="space-y-4">
                {/* What the server refused to publish, and why */}
                {blockers ? (
                    <BlockerList
                        errors={blockers.errors}
                        warnings={blockers.warnings}
                        revealTarget={revealTarget}
                        onReveal={doReveal}
                    />
                ) : null}

                {/* Current status */}
                <div
                    className="rounded-lg border px-3 py-2.5 text-xs"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
                >
                    <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                        <span>Currently:</span>
                        <strong style={{ color: 'var(--text-primary)' }}>{AUDIENCE_LABEL[currentAudience]}</strong>
                        {currentAudience === GROUPS ? (
                            <span style={{ color: 'var(--text-tertiary)' }}>({currentGroups.length})</span>
                        ) : null}
                    </div>
                    {isPublished && publishedAt ? (
                        <div className="mt-1" style={{ color: 'var(--text-tertiary)' }}>
                            Last published {publishedAt}
                        </div>
                    ) : null}
                    {isPublished && liveHref ? (
                        <a
                            href={liveHref}
                            className="mt-1.5 inline-flex items-center gap-1 font-medium hover:underline"
                            style={{ color: 'var(--accent-primary)' }}
                        >
                            View live <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                    ) : null}
                </div>

                {/* Audience picker, the group list it needs, and what the choice shares */}
                <AudiencePicker
                    open={open}
                    appId={app?.id}
                    audience={audience}
                    onChoose={chooseAudience}
                    selectedGroups={selectedGroups}
                    onToggleGroup={toggleGroup}
                    incomplete={groupsIncomplete}
                />
            </div>
        </Modal>
    );
}

function BlockerList({ errors, warnings, revealTarget, onReveal }) {
    return (
        <div className="space-y-3">
            <IssuePanel
                issues={errors}
                icon={<AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" style={{ color: '#b45309' }} />}
                title={errors.length === 1
                    ? '1 thing to fix before publishing'
                    : `${errors.length} things to fix before publishing`}
                note="Nothing changed for your readers — they still see the version you published last."
                panelStyle={{ borderColor: '#b45309', background: 'color-mix(in srgb, #b45309 8%, transparent)' }}
                revealTarget={revealTarget}
                onReveal={onReveal}
            />
            {warnings.length > 0 ? (
                <IssuePanel
                    issues={warnings}
                    icon={<Info className="h-4 w-4 shrink-0" aria-hidden="true" style={{ color: 'var(--text-tertiary)' }} />}
                    title={warnings.length === 1 ? '1 thing worth a look' : `${warnings.length} things worth a look`}
                    note="These do not stop you publishing."
                    panelStyle={{ borderColor: 'var(--border-subtle)' }}
                    revealTarget={revealTarget}
                    onReveal={onReveal}
                />
            ) : null}
        </div>
    );
}

function IssuePanel({ issues, icon, title, note, panelStyle, revealTarget, onReveal }) {
    return (
        <div className="rounded-lg border p-3" style={panelStyle}>
            <div className="flex items-center gap-2">
                {icon}
                <strong className="text-sm" style={{ color: 'var(--text-primary)' }}>{title}</strong>
            </div>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{note}</p>
            <ul className="mt-2.5 space-y-2">
                {issues.map((issue, i) => (
                    <IssueRow
                        key={`${issue.code || 'issue'}-${issue.path || i}`}
                        issue={issue}
                        target={revealTarget(issue)}
                        onReveal={onReveal}
                    />
                ))}
            </ul>
        </div>
    );
}

function IssueRow({ issue, target, onReveal }) {
    return (
        <li className="text-xs">
            <span className="block" style={{ color: 'var(--text-primary)' }}>{issue.message}</span>
            {issue.hint ? (
                <span className="mt-0.5 block" style={{ color: 'var(--text-tertiary)' }}>{issue.hint}</span>
            ) : null}
            {target ? (
                <span className="mt-1 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onReveal(target)}
                        className="rounded-md bg-white/5 px-2 py-1 font-medium hover:bg-[var(--bg-card-hover)]"
                        style={{ color: 'var(--accent-primary)' }}
                    >
                        Show me
                    </button>
                    {target.screenName ? (
                        <span style={{ color: 'var(--text-tertiary)' }}>on “{target.screenName}”</span>
                    ) : null}
                </span>
            ) : null}
        </li>
    );
}

