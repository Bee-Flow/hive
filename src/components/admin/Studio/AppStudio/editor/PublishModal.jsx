import { AlertTriangle, CheckCircle2, ExternalLink, Info, LayoutGrid, Loader2, Stethoscope } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import AudiencePicker from './AudiencePicker';
import dryRunIssues from './dryRunIssues';
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

/**
 * The screen a node id sits on, in the { nodeId, screenId, screenName } shape
 * "Show me" wants. resolveIssueTarget walks a validator PATH; the dry run
 * reports the component it actually executed, which only has an id.
 */
function resolveNodeScreen(definition, nodeId) {
    if (!definition || !nodeId) return null;
    for (const screen of definition.screens || []) {
        let hit = false;
        const walk = (nodes) => {
            for (const n of nodes || []) {
                if (hit) return;
                if (n?.id === nodeId) { hit = true; return; }
                if (Array.isArray(n?.children)) walk(n.children);
            }
        };
        for (const section of screen.sections || []) walk(section.children);
        if (hit) return { nodeId, screenId: screen.id, screenName: screen.name || null };
    }
    return null;
}

export default function PublishModal({ open, onClose, app, onPublished, definition, onRevealNode }) {
    const currentAudience = audienceOf(app);
    const currentGroups = useMemo(() => sharedGroupsOf(app), [app]);
    const publishedAt = formatWhen(app?.publishedAt ?? app?.published_at);
    const isPublished = !!(app?.isPublished ?? app?.is_published);

    const [audience, setAudience] = useState(currentAudience);
    const [selectedGroups, setSelectedGroups] = useState(() => new Set(currentGroups));
    // Nextcloud app-menu opt-in (stored per app; applied after the publish).
    const [ncMenu, setNcMenu] = useState(!!app?.nextcloudMenu);
    const [busy, setBusy] = useState(false);
    // What the server said stands in the way of publishing, straight from the
    // 422 body: { errors, warnings }. null until a publish is refused.
    const [blockers, setBlockers] = useState(null);
    // The pre-flight check: null = never run, then { errors, warnings }.
    const [checking, setChecking] = useState(false);
    const [checkResult, setCheckResult] = useState(null);

    // Reset the draft each time the modal opens so a re-open starts from the
    // app's real, current audience.
    useEffect(() => {
        if (!open) return;
        setAudience(audienceOf(app));
        setSelectedGroups(new Set(sharedGroupsOf(app)));
        setNcMenu(!!app?.nextcloudMenu);
        setBusy(false);
        setBlockers(null);
        setChecking(false);
        setCheckResult(null);
    }, [open, app]);

    /**
     * Try the app without publishing it.
     *
     * The publish gate only refuses what it can prove statically. The things a
     * hand-builder actually gets wrong — a table with no rows behind a list, a
     * screen that is blank for everyone but them, a save step writing a column
     * that was renamed — are only visible by executing the bindings, which is
     * what the server's dry run does read-only. Until now nothing but the AI
     * builder could ask for it.
     */
    const doCheck = async () => {
        if (!app?.id || checking) return;
        setChecking(true);
        setBlockers(null);
        try {
            const result = await studioAppsApi.checkApp(app.id);
            setCheckResult(dryRunIssues(result, resolveAgainst));
        } catch (err) {
            toast.error(err?.message || 'Could not check this app.');
        } finally {
            setChecking(false);
        }
    };

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

            // Apply the Nextcloud app-menu opt-in AFTER the publish settled —
            // enabling requires a live published copy, which the publish call
            // just created. Best-effort: a hiccup here must not roll back a
            // successful publish, so it reports its own toast and moves on.
            // Only touched when publishing and actually changed; unpublishing
            // leaves the stored flag as-is (the server hides the entry via the
            // is_published filter, and re-publishing restores it).
            let nextNcMenu = !!app?.nextcloudMenu;
            if (payload.isPublished && ncMenu !== nextNcMenu) {
                try {
                    const ncRes = await studioAppsApi.setNextcloudMenu(app.id, ncMenu);
                    nextNcMenu = !!ncRes?.nextcloudMenu;
                    if (ncMenu && ncRes?.ncConnected === false) {
                        toast.info('Saved — the app icon appears once your organization’s Nextcloud is connected to Bee Flow.');
                    }
                } catch (err) {
                    toast.error(err?.message || 'The Nextcloud menu setting could not be saved.');
                }
            }

            onPublished?.({
                ...app,
                isPublished: nextPublished,
                sharedGroups: nextGroups,
                nextcloudMenu: nextNcMenu,
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
        // The dry run names the COMPONENT it executed, not a validator path —
        // so "Show me" has to work from an id as well as from a path.
        if (issue?.nodeId && !issue?.path) {
            const byId = resolveNodeScreen(resolveAgainst, issue.nodeId);
            return byId || null;
        }
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

                {/*
                  * Try it before anyone else has to. The publish gate only
                  * refuses what it can prove statically; this actually runs the
                  * app's data reads, so an empty list, a screen that is blank
                  * for everyone but the owner, or a save step writing a column
                  * that was renamed all surface here rather than in front of a
                  * colleague.
                  */}
                <div
                    className="rounded-lg border px-3 py-2.5"
                    style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
                >
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={doCheck}
                            disabled={checking || !app?.id}
                            className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-xs font-medium hover:bg-[var(--bg-card-hover)] disabled:opacity-50"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            {checking
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                : <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />}
                            {checking ? 'Checking…' : 'Check this app'}
                        </button>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            Tries the app’s screens and logic without changing anything.
                        </span>
                    </div>

                    {checkResult && !checking ? (
                        checkResult.errors.length === 0 && checkResult.warnings.length === 0 ? (
                            <p className="mt-2 flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                Everything loaded and every step checks out.
                            </p>
                        ) : (
                            <div className="mt-2.5">
                                <BlockerList
                                    errors={checkResult.errors}
                                    warnings={checkResult.warnings}
                                    revealTarget={revealTarget}
                                    onReveal={doReveal}
                                    context="check"
                                />
                            </div>
                        )
                    ) : null}
                </div>

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

                {/*
                  * Nextcloud app menu — only meaningful for a published app,
                  * so the section hides under "Private". The entry's ICON is
                  * visible to everyone on the connected Nextcloud (top-menu
                  * entries are instance-wide); opening the app still enforces
                  * the audience above, so people outside it see the normal
                  * "not available to you" screen. The copy says exactly that.
                  */}
                {audience !== PRIVATE ? (
                    <label
                        className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5"
                        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
                    >
                        <input
                            type="checkbox"
                            checked={ncMenu}
                            onChange={(e) => setNcMenu(e.target.checked)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent-primary)]"
                        />
                        <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                Show in the Nextcloud app menu
                            </span>
                            <span className="mt-0.5 block text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                Adds this app to the top bar of your organization’s connected
                                Nextcloud, opening on its own page. Everyone on that Nextcloud
                                sees the icon; only the audience you chose above can use the app.
                            </span>
                        </span>
                    </label>
                ) : null}
            </div>
        </Modal>
    );
}

/**
 * `context` distinguishes the two ways this list appears. A refused publish
 * has to say what happened to the readers; a check the author asked for has
 * not changed anything, so saying so would be noise — and it may have no
 * errors at all, only things worth a look.
 */
function BlockerList({ errors, warnings, revealTarget, onReveal, context = 'publish' }) {
    const isCheck = context === 'check';
    return (
        <div className="space-y-3">
            {errors.length > 0 ? (
                <IssuePanel
                    issues={errors}
                    icon={<AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" style={{ color: '#b45309' }} />}
                    title={errors.length === 1
                        ? (isCheck ? '1 thing is broken' : '1 thing to fix before publishing')
                        : `${errors.length} things ${isCheck ? 'are broken' : 'to fix before publishing'}`}
                    note={isCheck
                        ? 'These stop the app working for the people you share it with.'
                        : 'Nothing changed for your readers — they still see the version you published last.'}
                    panelStyle={{ borderColor: '#b45309', background: 'color-mix(in srgb, #b45309 8%, transparent)' }}
                    revealTarget={revealTarget}
                    onReveal={onReveal}
                />
            ) : null}
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

