import { Check, Globe, Loader2, Lock, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { useMemo } from 'react';
import { GROUPS, joinNames, ORG, ownerRunFeeds, PRIVATE, summarizeAudience } from './publishAccessSummary';
import useAppRoles, { useOrgDirectory } from '../rbac/useAppRoles';

/**
 * The publish modal's "who can open this" picker, and — right under it — what
 * that choice hands those people in the app's own tables, plus the outside
 * sources it fetches for them on the owner's credentials.
 *
 * The consequence panel is computed from the SAVED data model (the same
 * useAppRoles read the Roles & access panel uses), never from the audience
 * alone: "everyone in your organisation can open it" and "everyone in your
 * organisation can delete every salary row" are the same setting, and only the
 * second one is what the owner is agreeing to. When the model cannot be read
 * the panel says so — it never falls back to a reassuring sentence.
 */

export default function AudiencePicker({ open, appId, audience, onChoose, selectedGroups, onToggleGroup, incomplete }) {
    const directory = useOrgDirectory(open);
    return (
        <>
            <fieldset className="space-y-2">
                <legend className="sr-only">Audience</legend>
                <AudienceOption
                    icon={<Lock className="h-4 w-4" aria-hidden="true" />}
                    title="Private"
                    description="Only you (and co-editors) can open the app."
                    checked={audience === PRIVATE}
                    onSelect={() => onChoose(PRIVATE)}
                />
                <AudienceOption
                    icon={<Globe className="h-4 w-4" aria-hidden="true" />}
                    title="Entire organization"
                    description="Everyone in your organization can open the published app."
                    checked={audience === ORG}
                    onSelect={() => onChoose(ORG)}
                />
                <AudienceOption
                    icon={<Users className="h-4 w-4" aria-hidden="true" />}
                    title="Specific groups"
                    description="Only members of the groups you pick can open the app."
                    checked={audience === GROUPS}
                    onSelect={() => onChoose(GROUPS)}
                />
            </fieldset>

            {audience === GROUPS ? (
                <GroupPicker
                    directory={directory}
                    selectedGroups={selectedGroups}
                    onToggle={onToggleGroup}
                    incomplete={incomplete}
                />
            ) : null}

            <DataImpact
                appId={appId}
                audience={audience}
                selectedGroups={selectedGroups}
                groups={directory.groups}
            />
        </>
    );
}

function DataImpact({ appId, audience, selectedGroups, groups }) {
    const { model, tables, isLoading, isError, hasModel } = useAppRoles(appId);
    const summary = useMemo(
        () => summarizeAudience({ audience, model, tables, groups, selectedGroupIds: [...selectedGroups] }),
        [audience, model, tables, groups, selectedGroups],
    );

    if (audience === PRIVATE) {
        return (
            <ImpactPanel tone="calm" icon={<ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />}>
                <p>Nobody else can open this app, so nobody else can reach the information in its tables.</p>
            </ImpactPanel>
        );
    }
    if (isLoading) {
        return (
            <ImpactPanel icon={<Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}>
                <p>Checking what this would share…</p>
            </ImpactPanel>
        );
    }
    if (isError) {
        return (
            <ImpactPanel tone="warn" icon={<ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />}>
                <p>
                    We could not check what this would share. Open “Roles &amp; access” and look at who can reach
                    your tables before you publish.
                </p>
            </ImpactPanel>
        );
    }
    // Outside sources ignore roles entirely, so they belong under every one of
    // the sentences below — including the ones that would otherwise reassure.
    const feeds = ownerRunFeeds(model);
    const loud = summary.broad || feeds.length > 0;

    if (!hasModel || tables.length === 0) {
        return (
            <ImpactPanel tone={loud ? 'warn' : 'calm'} icon={<PanelIcon loud={loud} />}>
                <p>This app has no tables of its own, so there are no stored rows to share.</p>
                <FeedLine names={feeds} />
            </ImpactPanel>
        );
    }
    if (summary.cohorts.length === 0) {
        return (
            <ImpactPanel tone={loud ? 'warn' : 'calm'} icon={<PanelIcon loud={loud} />}>
                <p>Pick the groups above to see what they will be able to reach.</p>
                <FeedLine names={feeds} />
            </ImpactPanel>
        );
    }
    return (
        <ImpactPanel tone={loud ? 'warn' : 'calm'} icon={<PanelIcon loud={loud} />}>
            {summary.cohorts.map((cohort) => <CohortLines key={cohort.key} cohort={cohort} />)}
            <FeedLine names={feeds} />
        </ImpactPanel>
    );
}

function PanelIcon({ loud }) {
    return loud
        ? <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
        : <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />;
}

function FeedLine({ names }) {
    if (names.length === 0) return null;
    return (
        <p>
            Anyone who can open the app can also fetch live data as you through {joinNames(names)},
            whichever role they land on.
        </p>
    );
}

function CohortLines({ cohort }) {
    if (cohort.grants.length === 0) {
        return <p><strong>{cohort.who}</strong> will not be able to reach any information in this app.</p>;
    }
    const opens = cohort.maybe ? ' may be able to ' : ' will be able to ';
    const adds = cohort.maybe ? ' may also be able to ' : ' will also be able to ';
    return (
        <>
            {cohort.grants.map((grant, i) => (
                <p key={grant.phrase}>
                    {i === 0 ? <strong>{cohort.who}</strong> : 'They'}
                    {i === 0 ? opens : adds}
                    {grant.phrase} in {joinNames(grant.names)}.
                </p>
            ))}
            {cohort.denied.length > 0 ? (
                <p>They will not be able to open {joinNames(cohort.denied)}.</p>
            ) : null}
        </>
    );
}

const TONES = {
    warn: { borderColor: '#b45309', background: 'color-mix(in srgb, #b45309 8%, transparent)', icon: '#b45309' },
    calm: { borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)', icon: 'var(--text-tertiary)' },
};

function ImpactPanel({ tone = 'calm', icon, children }) {
    const style = TONES[tone] || TONES.calm;
    return (
        <div
            data-testid="publish-data-impact"
            className="flex gap-2 rounded-lg border px-3 py-2.5 text-xs"
            style={{ borderColor: style.borderColor, background: style.background }}
        >
            <span style={{ color: style.icon }}>{icon}</span>
            <div className="space-y-1" style={{ color: 'var(--text-secondary)' }}>{children}</div>
        </div>
    );
}

function GroupPicker({ directory, selectedGroups, onToggle, incomplete }) {
    return (
        <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border-subtle)' }}>
            {directory.isLoading ? (
                <div className="flex items-center gap-2 py-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Loading groups…
                </div>
            ) : directory.groups.length === 0 ? (
                <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
                    {directory.available
                        ? 'Your organization has no groups yet — create them in Organisation settings, or publish to the entire organization.'
                        : 'Choosing groups needs organisation-admin access. Publish to the entire organization instead.'}
                </p>
            ) : (
                <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto" aria-label="Groups">
                    {directory.groups.map((g) => {
                        const id = String(g.id);
                        const checked = selectedGroups.has(id);
                        return (
                            <li key={id}>
                                <label
                                    className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--bg-tertiary)]"
                                    style={{ color: 'var(--text-primary)' }}
                                >
                                    <span
                                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                                        style={{
                                            borderColor: checked ? 'var(--accent-primary)' : 'var(--border-default)',
                                            background: checked ? 'var(--accent-primary)' : 'transparent',
                                            color: '#fff',
                                        }}
                                    >
                                        {checked ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
                                    </span>
                                    <input
                                        type="checkbox"
                                        className="sr-only"
                                        checked={checked}
                                        onChange={() => onToggle(id)}
                                        aria-label={g.name || id}
                                    />
                                    <span className="truncate">{g.name || id}</span>
                                </label>
                            </li>
                        );
                    })}
                </ul>
            )}
            {incomplete && directory.groups.length > 0 ? (
                <p className="mt-2 text-xs" style={{ color: '#b45309' }}>
                    Select at least one group, or choose a different audience.
                </p>
            ) : null}
        </div>
    );
}

function AudienceOption({ icon, title, description, checked, onSelect }) {
    return (
        <label
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
            style={{
                borderColor: checked ? 'var(--accent-primary)' : 'var(--border-subtle)',
                background: checked ? 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' : 'transparent',
            }}
        >
            <input
                type="radio"
                name="publish-audience"
                className="sr-only"
                checked={checked}
                onChange={onSelect}
            />
            <span
                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                style={{
                    background: 'var(--bg-tertiary)',
                    color: checked ? 'var(--accent-primary)' : 'var(--text-tertiary)',
                }}
            >
                {icon}
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</span>
                <span className="block text-xs" style={{ color: 'var(--text-tertiary)' }}>{description}</span>
            </span>
        </label>
    );
}
