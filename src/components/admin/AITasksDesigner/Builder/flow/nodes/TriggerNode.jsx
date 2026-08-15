import {
    Clock, Zap, Webhook, MousePointer2, Mail, Calendar,
    Tag, BellRing, FileUp, FilePlus, FilePen, Share2, Activity, Bell,
    Stethoscope, LogIn, Bot, AppWindow, ClipboardList,
} from 'lucide-react';
import React from 'react';
import IntegrationLogo from './IntegrationLogo';
import StepNodeBase, { NodeChip } from './StepNodeBase';
import { describeCron } from '../scheduleBuilderUtils';
import { triggerTypeLabel } from '../triggerLabels';

/**
 * Trigger provider id → integration id used by INTEGRATION_META.
 * Map only providers whose event surface is a brand the user recognises;
 * `manual` / `schedule` / `webhook` triggers stay on lucide glyphs.
 */
const PROVIDER_TO_INTEGRATION = {
    'gmail':            'gmail',
    'google-calendar':  'google_calendar',
    'google-drive':     'google_drive',
    'msgraph':          'outlook',
    'github':           'github',
    'nextcloud':        'nextcloud',
};

// Icons only — the label strings live in ../triggerLabels so the palette,
// the settings form and the node all name a trigger the same way (BFSF-339).
const KIND_ICON = {
    schedule:    Clock,
    manual:      MousePointer2,
    webhook:     Webhook,
    app_event:   Zap,
    agent_call:  Bot,
    layer_input: LogIn,
    app_trigger: AppWindow,
    form:        ClipboardList,
};

/**
 * Sub-icon per (provider, event) so a Gmail-new-email trigger gets a Mail
 * glyph instead of the generic app-event lightning bolt.
 */
const APP_EVENT_ICON = {
    'gmail.mail.new':                  Mail,
    'gmail.label.added':               Tag,
    'google-calendar.event.changed':   Calendar,
    'google-calendar.event.upcoming':  BellRing,
    'google-drive.file.new':           FileUp,
    'nextcloud.file.new':              FilePlus,
    'nextcloud.file.changed':          FilePen,
    'nextcloud.share.received':        Share2,
    'nextcloud.activity.new':          Activity,
    'nextcloud.notification.new':      Bell,
};

export default function TriggerNode({ id, data }) {
    const { step, runStep, issues, onAddAfter, onDiagnose } = data;
    const kind = step.kind || 'manual';

    const meta = { label: triggerTypeLabel(step) };
    let Icon = KIND_ICON[kind] || KIND_ICON.manual;
    if (kind === 'app_event' && step.appEvent) {
        const key = `${step.appEvent.provider}.${step.appEvent.event}`;
        if (APP_EVENT_ICON[key]) Icon = APP_EVENT_ICON[key];
    }
    const providerIntegration = (kind === 'app_event' && step.appEvent?.provider)
        ? PROVIDER_TO_INTEGRATION[step.appEvent.provider] || null
        : null;

    const cron = step.schedule?.cron;
    const tz = step.schedule?.tz;
    const filter = step.appEvent?.filter || null;

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || meta.label}</div>
            {/* "Every day at 09:00", not `0 9 * * *`. A schedule the author
                can't read at a glance is a schedule they can't check. */}
            {kind === 'schedule' && cron && (
                <div className="mt-0.5 flex items-center gap-1 flex-wrap">
                    <NodeChip title={cron}>{describeCron(cron)}</NodeChip>
                    {tz && <NodeChip>{tz}</NodeChip>}
                </div>
            )}
            {kind === 'app_event' && step.appEvent && (
                <div className="mt-0.5 text-[var(--text-tertiary)] text-[10px] truncate">
                    <span className="font-mono">{step.appEvent.provider}.{step.appEvent.event}</span>
                </div>
            )}
            {kind === 'app_event' && filter && Object.keys(filter).length > 0 && (
                <div className="mt-1 flex items-center gap-1 flex-wrap">
                    {summariseFilter(filter, step.appEvent).slice(0, 4).map(({ key, label }) => (
                        <NodeChip key={key} title={key}>
                            {label}
                        </NodeChip>
                    ))}
                </div>
            )}
            {kind === 'agent_call' && (() => {
                const toolName = step.toolName || `automation_${step.id}`;
                const props = step.parametersSchema?.properties || {};
                const names = Object.keys(props);
                const required = Array.isArray(step.parametersSchema?.required) ? step.parametersSchema.required : [];
                return (
                    <div className="mt-0.5">
                        <NodeChip title="Tool name"><span className="font-mono">{truncate(toolName, 22)}</span></NodeChip>
                        {names.length > 0 && (
                            <div className="mt-1 flex items-center gap-1 flex-wrap">
                                {names.slice(0, 6).map((n) => (
                                    <NodeChip key={n} title={required.includes(n) ? `${n} (required)` : n}>
                                        {n}{required.includes(n) ? '*' : ''}
                                    </NodeChip>
                                ))}
                                {names.length > 6 && <NodeChip>+{names.length - 6}</NodeChip>}
                            </div>
                        )}
                    </div>
                );
            })()}
            {(kind === 'layer_input' || kind === 'app_trigger') && (
                Array.isArray(step.params) && step.params.length > 0 ? (
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                        {step.params.slice(0, 6).map((p) => (
                            <NodeChip key={p.name} title={`${p.name}${p.required ? ' (required)' : ''}${p.type === 'file' ? ' (file)' : ''}`}>
                                {p.name}{p.required ? '*' : ''}
                            </NodeChip>
                        ))}
                        {step.params.length > 6 && <NodeChip>+{step.params.length - 6}</NodeChip>}
                    </div>
                ) : (
                    <div className="mt-0.5 text-[var(--text-tertiary)] text-[10px]">no inputs</div>
                )
            )}
            {kind === 'app_event' && typeof onDiagnose === 'function' && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDiagnose();
                    }}
                    title="Probe the trigger pipeline (subscription, credentials, filter match)"
                    className="mt-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-[var(--border-default)] text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition"
                >
                    <Stethoscope size={10} />
                    Diagnose
                </button>
            )}
        </div>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{meta.label}</div>
            {kind === 'schedule' && cron && <div>{describeCron(cron)} ({tz || 'UTC'})</div>}
            {kind === 'webhook' && (
                <div>
                    <div>HTTP webhook entry point.</div>
                    <div className="mt-1 text-[var(--text-tertiary)]">Open this node to copy its signed POST URL.</div>
                </div>
            )}
            {kind === 'manual' && <div>Runs only on user action.</div>}
            {kind === 'agent_call' && (
                <div className="mt-1">
                    <div>Callable as a tool from direct chat or an agent.</div>
                    <div className="mt-1 text-[var(--text-tertiary)]">tool: <span className="font-mono">{step.toolName || `automation_${step.id}`}</span></div>
                </div>
            )}
            {kind === 'layer_input' && (
                <div className="mt-1">
                    <div>Entry point of this flowlet — runs when a “Call flowlet” step invokes it.</div>
                    {Array.isArray(step.params) && step.params.length > 0 ? (
                        <div className="mt-1 text-[var(--text-tertiary)]">
                            Inputs: <span className="font-mono">{step.params.map((p) => p.name).join(', ')}</span>
                        </div>
                    ) : (
                        <div className="mt-1 text-[var(--text-tertiary)]">No declared inputs.</div>
                    )}
                </div>
            )}
            {kind === 'app_trigger' && (
                <div className="mt-1">
                    <div>Runs when a Studio App action calls it.</div>
                    {Array.isArray(step.params) && step.params.length > 0 ? (
                        <div className="mt-1 text-[var(--text-tertiary)]">
                            Inputs: <span className="font-mono">{step.params.map((p) => p.name + (p.type === 'file' ? ' (file)' : '')).join(', ')}</span>
                        </div>
                    ) : (
                        <div className="mt-1 text-[var(--text-tertiary)]">No declared inputs.</div>
                    )}
                </div>
            )}
            {kind === 'app_event' && step.appEvent?.provider === 'gmail' && step.appEvent?.event === 'mail.new' && (
                <>
                    <div className="mt-1">Fires on every new email in your inbox.</div>
                    <div className="mt-1 text-[var(--text-tertiary)]">
                        Trigger payload: <span className="font-mono">{'{messageId, threadId, from, subject, snippet, labelIds, …}'}</span>
                    </div>
                </>
            )}
        </div>
    );

    const iconEl = providerIntegration
        ? <IntegrationLogo integrationId={providerIntegration} size={16} fallback={<Icon size={14} />} />
        : <Icon size={14} />;

    return (
        <StepNodeBase
            icon={iconEl}
            typeLabel={meta.label}
            body={body}
            hoverDetail={hoverDetail}
            runStep={runStep}
            issues={issues}
            nodeId={id}
            onAddAfter={onAddAfter}
        />
    );
}

/**
 * Render the trigger filter as readable chips. Per-provider branches
 * keep the language idiomatic — "labels: Label_3" reads naturally for a
 * Gmail user but would be confusing in a Drive trigger.
 */
function summariseFilter(filter, appEvent) {
    const provider = appEvent?.provider;
    const event = appEvent?.event;
    const key = `${provider}.${event}`;

    const out = [];
    const push = (k, label) => out.push({ key: k, label });

    // Gmail (mail.new + label.added share most fields)
    if (provider === 'gmail') {
        if (filter.labelId)          push('labelId',         `label: ${truncate(filter.labelId, 18)}`);
        if (filter.from)              push('from',            `from: ${truncate(filter.from, 22)}`);
        if (filter.to)                push('to',              `to: ${truncate(filter.to, 22)}`);
        if (filter.cc)                push('cc',              `cc: ${truncate(filter.cc, 22)}`);
        if (filter.subjectContains)   push('subjectContains', `subject ~ "${truncate(filter.subjectContains, 18)}"`);
        if (filter.subjectRegex)      push('subjectRegex',    `subject /${truncate(filter.subjectRegex, 16)}/`);
        if (Array.isArray(filter.labelIds) && filter.labelIds.length)
            push('labelIds', `labels: ${filter.labelIds.slice(0, 2).join(',')}${filter.labelIds.length > 2 ? '+' + (filter.labelIds.length - 2) : ''}`);
        if (Array.isArray(filter.excludeLabelIds) && filter.excludeLabelIds.length)
            push('excludeLabelIds', `not: ${filter.excludeLabelIds.slice(0, 2).join(',')}`);
        if (filter.hasAttachment === true)   push('hasAttachment',   'has attachment');
        if (filter.excludeFromSelf === true) push('excludeFromSelf', 'not sent by me');
        if (typeof filter.maxAgeMinutes === 'number') push('maxAgeMinutes', `≤ ${filter.maxAgeMinutes}m old`);
        return out;
    }

    if (provider === 'google-calendar') {
        if (typeof filter.leadMinutes === 'number') push('leadMinutes', `≤ ${filter.leadMinutes}m before`);
        if (filter.calendarId && filter.calendarId !== 'primary')
            push('calendarId', `cal: ${truncate(filter.calendarId, 14)}`);
        if (filter.statusEquals)             push('statusEquals',          `status: ${filter.statusEquals}`);
        if (filter.attendeeEmailContains)    push('attendeeEmailContains', `attendee ~ ${truncate(filter.attendeeEmailContains, 16)}`);
        if (filter.includeAllDay === true)   push('includeAllDay',         'incl. all-day');
        return out;
    }

    if (provider === 'google-drive') {
        if (filter.folderId)        push('folderId',        `folder: ${truncate(filter.folderId, 16)}`);
        if (filter.mimeType)        push('mimeType',        truncate(filter.mimeType.split('/').pop() || filter.mimeType, 14));
        if (filter.nameContains)    push('nameContains',    `name ~ "${truncate(filter.nameContains, 14)}"`);
        if (filter.excludeOwnUploads === true) push('excludeOwnUploads', 'not uploaded by me');
        return out;
    }

    if (provider === 'nextcloud') {
        if (key === 'nextcloud.file.new' || key === 'nextcloud.file.changed') {
            if (filter.inFolder)     push('inFolder',     `in ${truncate(filter.inFolder, 18)}`);
            if (filter.extension)    push('extension',    `.${String(filter.extension).replace(/^\./, '')}`);
            if (filter.nameContains) push('nameContains', `name ~ "${truncate(filter.nameContains, 14)}"`);
            if (filter.excludeOwnUploads === true) push('excludeOwnUploads', 'not by me');
            return out;
        }
        if (key === 'nextcloud.share.received') {
            if (filter.actorEquals)  push('actorEquals',  `from: ${truncate(filter.actorEquals, 16)}`);
            if (filter.kindEquals)   push('kindEquals',   filter.kindEquals);
            if (filter.nameContains) push('nameContains', `name ~ "${truncate(filter.nameContains, 14)}"`);
            return out;
        }
        if (key === 'nextcloud.activity.new') {
            if (filter.type)              push('type',              `type: ${truncate(filter.type, 16)}`);
            if (filter.objectNameContains) push('objectNameContains', `obj ~ ${truncate(filter.objectNameContains, 14)}`);
            if (filter.actorEquals)       push('actorEquals',       `actor: ${truncate(filter.actorEquals, 16)}`);
            return out;
        }
        if (key === 'nextcloud.notification.new') {
            if (filter.app)             push('app',             `app: ${truncate(filter.app, 16)}`);
            if (filter.subjectContains) push('subjectContains', `subject ~ "${truncate(filter.subjectContains, 14)}"`);
            return out;
        }
    }

    // Unknown provider — fall back to dumping each key.
    for (const k of Object.keys(filter)) {
        const v = filter[k];
        if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue;
        out.push({ key: k, label: `${k}: ${truncate(String(v), 18)}` });
    }
    return out;
}

function truncate(s, n) {
    s = String(s ?? '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
