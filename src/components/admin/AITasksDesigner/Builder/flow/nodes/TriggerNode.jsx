import React from 'react';
import {
    Clock, Zap, Webhook, MousePointer2, Mail, Calendar,
    Tag, BellRing, FileUp, FilePlus, FilePen, Share2, Activity, Bell,
    Ticket, RefreshCw,
} from 'lucide-react';
import StepNodeBase, { NodeChip } from './StepNodeBase';
import IntegrationLogo from './IntegrationLogo';

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

const KIND_META = {
    schedule:   { icon: Clock,         label: 'Schedule trigger' },
    manual:     { icon: MousePointer2, label: 'Manual trigger' },
    webhook:    { icon: Webhook,       label: 'Webhook trigger' },
    app_event:  { icon: Zap,           label: 'App-event trigger' },
};

/**
 * Sub-meta per (provider, event) so a Gmail-new-email trigger gets a
 * Mail icon and a friendly "New email (Gmail)" label instead of the
 * generic "App-event trigger" lightning bolt.
 */
const APP_EVENT_META = {
    'gmail.mail.new':                  { icon: Mail,      label: 'New email (Gmail)' },
    'gmail.label.added':               { icon: Tag,       label: 'Email labelled (Gmail)' },
    'google-calendar.event.changed':   { icon: Calendar,  label: 'Calendar event changed' },
    'google-calendar.event.upcoming':  { icon: BellRing,  label: 'Calendar event upcoming' },
    'google-drive.file.new':           { icon: FileUp,    label: 'New file (Drive)' },
    'nextcloud.file.new':              { icon: FilePlus,  label: 'New file (Nextcloud)' },
    'nextcloud.file.changed':          { icon: FilePen,   label: 'File changed (Nextcloud)' },
    'nextcloud.share.received':        { icon: Share2,    label: 'Share received (Nextcloud)' },
    'nextcloud.activity.new':          { icon: Activity,  label: 'Nextcloud activity' },
    'nextcloud.notification.new':      { icon: Bell,      label: 'Nextcloud notification' },
    'ticket-assistant.ticket.new':     { icon: Ticket,    label: 'New ticket (Assistant)' },
    'ticket-assistant.sync.completed': { icon: RefreshCw, label: 'Ticket sync finished' },
};

export default function TriggerNode({ id, data }) {
    const { step, runStep, issues, onAddAfter } = data;
    const kind = step.kind || 'manual';

    let meta = KIND_META[kind] || KIND_META.manual;
    if (kind === 'app_event' && step.appEvent) {
        const key = `${step.appEvent.provider}.${step.appEvent.event}`;
        if (APP_EVENT_META[key]) meta = APP_EVENT_META[key];
    }
    const Icon = meta.icon;
    const providerIntegration = (kind === 'app_event' && step.appEvent?.provider)
        ? PROVIDER_TO_INTEGRATION[step.appEvent.provider] || null
        : null;

    const cron = step.schedule?.cron;
    const tz = step.schedule?.tz;
    const filter = step.appEvent?.filter || null;

    const body = (
        <div>
            <div className="font-semibold truncate">{step.label || meta.label}</div>
            {kind === 'schedule' && cron && (
                <div className="mt-0.5 flex items-center gap-1 flex-wrap">
                    <NodeChip><span className="font-mono">{cron}</span></NodeChip>
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
        </div>
    );

    const hoverDetail = (
        <div>
            <div className="font-semibold mb-1">{meta.label}</div>
            <div className="text-[var(--text-secondary)]">id: <span className="font-mono">{step.id}</span></div>
            {kind === 'schedule' && cron && <div>cron: <span className="font-mono">{cron}</span> ({tz || 'UTC'})</div>}
            {kind === 'webhook' && <div>HTTP webhook entry point.</div>}
            {kind === 'manual' && <div>Runs only on user action.</div>}
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

    if (provider === 'ticket-assistant') {
        if (key === 'ticket-assistant.ticket.new') {
            if (filter.provider)         push('provider',         `${filter.provider}`);
            if (filter.connectionId)     push('connectionId',     `conn: ${truncate(filter.connectionId, 10)}`);
            if (filter.priorityEquals)   push('priorityEquals',   `prio: ${filter.priorityEquals}`);
            if (filter.statusEquals)     push('statusEquals',     `status: ${filter.statusEquals}`);
            if (filter.categoryEquals)   push('categoryEquals',   `cat: ${truncate(filter.categoryEquals, 14)}`);
            if (filter.subjectContains)  push('subjectContains',  `subject ~ "${truncate(filter.subjectContains, 14)}"`);
            if (filter.bodyContains)     push('bodyContains',     `body ~ "${truncate(filter.bodyContains, 14)}"`);
            return out;
        }
        if (key === 'ticket-assistant.sync.completed') {
            if (filter.provider)        push('provider',        `${filter.provider}`);
            if (filter.connectionId)    push('connectionId',    `conn: ${truncate(filter.connectionId, 10)}`);
            if (filter.outcomeEquals)   push('outcomeEquals',   `outcome: ${filter.outcomeEquals}`);
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
