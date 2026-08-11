// §WS5 — trigger/event filter editors extracted verbatim from SettingsForm.jsx.
// FilterShell + TicketAssistantConnectionPicker are internal helpers.
import React, { useState, useEffect } from 'react';
import useAutomationApi from '../../../../../../hooks/useAutomationApi';
import { inputClass, sectionHeaderClass, FormRow } from './formPrimitives';

export function GmailFilterFields({ filter, setFilter }) {
    return (
        <div className="rounded-md border border-[var(--border-subtle)] p-3 space-y-3">
            <div className={sectionHeaderClass()}>Gmail filter (all optional, AND across keys)</div>
            <FormRow label="From contains">
                <input type="text" value={filter.from || ''} onChange={(e) => setFilter('from', e.target.value || undefined)}
                    placeholder="boss@example.com" className={inputClass()} />
            </FormRow>
            <FormRow label="To contains">
                <input type="text" value={filter.to || ''} onChange={(e) => setFilter('to', e.target.value || undefined)} className={inputClass()} />
            </FormRow>
            <FormRow label="Subject contains">
                <input type="text" value={filter.subjectContains || ''} onChange={(e) => setFilter('subjectContains', e.target.value || undefined)} className={inputClass()} />
            </FormRow>
            <FormRow label="Subject regex" hint="JS regex. Capped at 200 chars; invalid patterns fail closed.">
                <input type="text" value={filter.subjectRegex || ''} onChange={(e) => setFilter('subjectRegex', e.target.value || undefined)} className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Has attachment">
                <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={filter.hasAttachment === true} onChange={(e) => setFilter('hasAttachment', e.target.checked || undefined)} />
                    Only emails with attachments
                </label>
            </FormRow>
            <FormRow label="Exclude self-sent">
                <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={filter.excludeFromSelf === true} onChange={(e) => setFilter('excludeFromSelf', e.target.checked || undefined)} />
                    Skip emails I sent
                </label>
            </FormRow>
            <FormRow label="Max age (minutes)" hint="Drop messages older than this. Useful so a long-paused poller doesn't flood with backlog on resume.">
                <input
                    type="number"
                    value={filter.maxAgeMinutes ?? ''}
                    min={1}
                    onChange={(e) => setFilter('maxAgeMinutes', e.target.value === '' ? undefined : Number(e.target.value))}
                    className={inputClass()}
                />
            </FormRow>
        </div>
    );
}

// ── Trigger filter sub-forms (one per (provider, event)) ───────────────
//
// All filters reuse FilterShell as chrome and the standard input/textarea
// helpers — keeps the visual language consistent with the Gmail filter
// users already know. Each field's onChange clears its key when the
// input is empty (`undefined`) so the persisted filter object stays
// minimal and the matcher's "if filter.X is set" checks short-circuit.

function FilterShell({ title, children }) {
    return (
        <div className="rounded-md border border-[var(--border-subtle)] p-3 space-y-3">
            <div className={sectionHeaderClass()}>{title}</div>
            {children}
        </div>
    );
}

export function GmailLabelFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Gmail label.added filter (labelId is required)">
            <FormRow label="Label id" hint="Gmail label ids look like Label_3 or system ids like IMPORTANT / STARRED. Use a gmail_search step once to find the id if needed.">
                <input type="text" value={filter.labelId || ''} onChange={(e) => setFilter('labelId', e.target.value || undefined)}
                    placeholder="Label_3" className={inputClass()} />
            </FormRow>
            <FormRow label="From contains">
                <input type="text" value={filter.from || ''} onChange={(e) => setFilter('from', e.target.value || undefined)} className={inputClass()} />
            </FormRow>
            <FormRow label="Subject contains">
                <input type="text" value={filter.subjectContains || ''} onChange={(e) => setFilter('subjectContains', e.target.value || undefined)} className={inputClass()} />
            </FormRow>
            <FormRow label="Exclude labels (comma-separated)" hint="Drops messages that already carry any of these labels.">
                <input
                    type="text"
                    value={Array.isArray(filter.excludeLabelIds) ? filter.excludeLabelIds.join(',') : ''}
                    onChange={(e) => {
                        const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        setFilter('excludeLabelIds', arr.length ? arr : undefined);
                    }}
                    className={inputClass() + ' font-mono'}
                />
            </FormRow>
        </FilterShell>
    );
}

export function CalendarChangedFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Calendar event.changed filter (all optional)">
            <FormRow label="Calendar id" hint="Default 'primary'. Use a different calendar id if you've connected secondary calendars.">
                <input type="text" value={filter.calendarId || ''} onChange={(e) => setFilter('calendarId', e.target.value || undefined)}
                    placeholder="primary" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Status">
                <select
                    value={filter.statusEquals || ''}
                    onChange={(e) => setFilter('statusEquals', e.target.value || undefined)}
                    className={inputClass()}
                >
                    <option value="">Any</option>
                    <option value="confirmed">confirmed</option>
                    <option value="cancelled">cancelled</option>
                    <option value="tentative">tentative</option>
                </select>
            </FormRow>
            <FormRow label="Attendee email contains">
                <input type="text" value={filter.attendeeEmailContains || ''} onChange={(e) => setFilter('attendeeEmailContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
        </FilterShell>
    );
}

export function CalendarUpcomingFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Calendar event.upcoming filter">
            <FormRow label="Lead minutes" hint="Fire this many minutes before the event starts. Default 15.">
                <input
                    type="number"
                    min={1}
                    max={240}
                    value={filter.leadMinutes ?? 15}
                    onChange={(e) => setFilter('leadMinutes', e.target.value === '' ? undefined : Number(e.target.value))}
                    className={inputClass()}
                />
            </FormRow>
            <FormRow label="Calendar id">
                <input type="text" value={filter.calendarId || ''} onChange={(e) => setFilter('calendarId', e.target.value || undefined)}
                    placeholder="primary" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Include all-day events">
                <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={filter.includeAllDay === true} onChange={(e) => setFilter('includeAllDay', e.target.checked || undefined)} />
                    Yes — fire on all-day events too
                </label>
            </FormRow>
            <FormRow label="Attendee email contains">
                <input type="text" value={filter.attendeeEmailContains || ''} onChange={(e) => setFilter('attendeeEmailContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
        </FilterShell>
    );
}

export function DriveFileNewFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Drive file.new filter (all optional)">
            <FormRow label="Folder id" hint="Drive folder id. Find via drive_search or by copying from the URL: drive.google.com/drive/folders/<id>.">
                <input type="text" value={filter.folderId || ''} onChange={(e) => setFilter('folderId', e.target.value || undefined)}
                    className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="MIME type" hint="e.g. application/pdf, image/jpeg, application/vnd.google-apps.document.">
                <input type="text" value={filter.mimeType || ''} onChange={(e) => setFilter('mimeType', e.target.value || undefined)}
                    placeholder="application/pdf" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Name contains">
                <input type="text" value={filter.nameContains || ''} onChange={(e) => setFilter('nameContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Exclude my own uploads">
                <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={filter.excludeOwnUploads === true} onChange={(e) => setFilter('excludeOwnUploads', e.target.checked || undefined)} />
                    Skip files I uploaded
                </label>
            </FormRow>
        </FilterShell>
    );
}

export function NextcloudFileFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Nextcloud file filter (all optional)">
            <FormRow label="In folder" hint="Path prefix, e.g. /Invoices. Files outside this folder are skipped.">
                <input type="text" value={filter.inFolder || ''} onChange={(e) => setFilter('inFolder', e.target.value || undefined)}
                    placeholder="/Invoices" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Extension" hint="Without dot, e.g. pdf.">
                <input type="text" value={filter.extension || ''} onChange={(e) => setFilter('extension', e.target.value || undefined)}
                    placeholder="pdf" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Name contains">
                <input type="text" value={filter.nameContains || ''} onChange={(e) => setFilter('nameContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Exclude my own actions">
                <label className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={filter.excludeOwnUploads === true} onChange={(e) => setFilter('excludeOwnUploads', e.target.checked || undefined)} />
                    Skip files I created/edited
                </label>
            </FormRow>
            <div className="text-[11px] text-[var(--text-tertiary)] leading-snug">
                Manual runs use a <code>null</code> trigger payload — set a sample under Settings → Manual trigger payload to test bindings.
            </div>
        </FilterShell>
    );
}

export function NextcloudShareFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Nextcloud share.received filter">
            <FormRow label="Sharer (actor) equals" hint="Nextcloud username (uid) of the person who shared the item.">
                <input type="text" value={filter.actorEquals || ''} onChange={(e) => setFilter('actorEquals', e.target.value || undefined)}
                    className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Kind">
                <select
                    value={filter.kindEquals || ''}
                    onChange={(e) => setFilter('kindEquals', e.target.value || undefined)}
                    className={inputClass()}
                >
                    <option value="">Any (file or folder)</option>
                    <option value="file">file</option>
                    <option value="folder">folder</option>
                </select>
            </FormRow>
            <FormRow label="Name contains">
                <input type="text" value={filter.nameContains || ''} onChange={(e) => setFilter('nameContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
        </FilterShell>
    );
}

export function NextcloudActivityFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Nextcloud activity filter (advanced)">
            <FormRow label="Activity type" hint="Raw activity slug (e.g. file_created, comments, deck). Leave empty to match every type — and prefer file.new / file.changed / share.received as dedicated triggers.">
                <input type="text" value={filter.type || ''} onChange={(e) => setFilter('type', e.target.value || undefined)}
                    placeholder="comments" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Object name contains">
                <input type="text" value={filter.objectNameContains || ''} onChange={(e) => setFilter('objectNameContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Actor equals">
                <input type="text" value={filter.actorEquals || ''} onChange={(e) => setFilter('actorEquals', e.target.value || undefined)}
                    className={inputClass() + ' font-mono'} />
            </FormRow>
        </FilterShell>
    );
}

export function NextcloudNotificationFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Nextcloud notification filter">
            <FormRow label="App" hint="Source app id (e.g. spreed, files_sharing, dav, updatenotification).">
                <input type="text" value={filter.app || ''} onChange={(e) => setFilter('app', e.target.value || undefined)}
                    placeholder="spreed" className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Subject contains">
                <input type="text" value={filter.subjectContains || ''} onChange={(e) => setFilter('subjectContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
        </FilterShell>
    );
}

/**
 * Picker for the org's Ticket Assistant connections — lazy-loads the
 * list once on mount via `useAutomationApi.listTicketAssistantConnections`.
 * Falls back to a free-text input on fetch error so the user can still
 * paste a connectionId they know.
 */
function TicketAssistantConnectionPicker({ value, onChange }) {
    const api = useAutomationApi();
    const [conns, setConns] = useState(null); // null = loading; [] = loaded empty; array = loaded
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;
        api.listTicketAssistantConnections()
            .then(d => { if (alive) setConns(d.connections || []); })
            .catch(e => { if (alive) setError(e.message || 'Failed to load connections'); })
             
            .finally(() => {});
        return () => { alive = false; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (error) {
        return (
            <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value || undefined)}
                placeholder="connection id"
                className={inputClass() + ' font-mono'}
            />
        );
    }
    if (conns === null) {
        return <div className="text-xs text-[var(--text-tertiary)] py-1.5">Loading connections…</div>;
    }
    return (
        <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={inputClass()}
        >
            <option value="">Any connection</option>
            {conns.map(c => (
                <option key={c.id} value={c.id}>
                    {c.display_name || c.email_address} ({c.provider})
                </option>
            ))}
        </select>
    );
}

export function TicketAssistantTicketFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Ticket Assistant ticket.new filter">
            <FormRow label="Connection" hint="Restrict to one of the org's Ticket Assistant connections.">
                <TicketAssistantConnectionPicker
                    value={filter.connectionId}
                    onChange={(v) => setFilter('connectionId', v)}
                />
            </FormRow>
            <FormRow label="Provider">
                <select
                    value={filter.provider || ''}
                    onChange={(e) => setFilter('provider', e.target.value || undefined)}
                    className={inputClass()}
                >
                    <option value="">Any provider</option>
                    <option value="gmail">Gmail</option>
                    <option value="outlook">Outlook</option>
                    <option value="jira">Jira</option>
                    <option value="servicenow">ServiceNow</option>
                    <option value="zendesk">Zendesk</option>
                    <option value="freshservice">Freshservice</option>
                    <option value="topdesk">TopDesk</option>
                </select>
            </FormRow>
            <FormRow label="Subject contains">
                <input type="text" value={filter.subjectContains || ''} onChange={(e) => setFilter('subjectContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Body contains">
                <input type="text" value={filter.bodyContains || ''} onChange={(e) => setFilter('bodyContains', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Category equals" hint="The AI-classified category (post-summarise). Free text — no enum yet.">
                <input type="text" value={filter.categoryEquals || ''} onChange={(e) => setFilter('categoryEquals', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Priority equals">
                <select
                    value={filter.priorityEquals || ''}
                    onChange={(e) => setFilter('priorityEquals', e.target.value || undefined)}
                    className={inputClass()}
                >
                    <option value="">Any</option>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="urgent">urgent</option>
                </select>
            </FormRow>
            <FormRow label="Status equals" hint="Provider-native status (e.g. 'Open', 'In Progress') OR a normalised bucket: open / pending / resolved / closed.">
                <input type="text" value={filter.statusEquals || ''} onChange={(e) => setFilter('statusEquals', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <div className="text-[11px] text-[var(--text-tertiary)] leading-snug">
                Manual runs of this trigger use a <code>null</code> payload — set a sample under Settings → Manual trigger payload to test bindings before activating.
            </div>
        </FilterShell>
    );
}

export function TicketAssistantSyncFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Ticket Assistant sync.completed filter">
            <FormRow label="Connection">
                <TicketAssistantConnectionPicker
                    value={filter.connectionId}
                    onChange={(v) => setFilter('connectionId', v)}
                />
            </FormRow>
            <FormRow label="Outcome">
                <select
                    value={filter.outcomeEquals || ''}
                    onChange={(e) => setFilter('outcomeEquals', e.target.value || undefined)}
                    className={inputClass()}
                >
                    <option value="">Any outcome</option>
                    <option value="success">success</option>
                    <option value="partial">partial (some errors)</option>
                    <option value="error">error</option>
                </select>
            </FormRow>
        </FilterShell>
    );
}

export function SupportTicketResolvedFilterFields({ filter, setFilter }) {
    return (
        <FilterShell title="Support Inbox ticket.resolved filter (all optional)">
            <FormRow label="Inbox id" hint="Restrict to one support inbox. Leave empty to match every inbox.">
                <input type="text" value={filter.inboxId || ''} onChange={(e) => setFilter('inboxId', e.target.value || undefined)}
                    className={inputClass() + ' font-mono'} />
            </FormRow>
            <FormRow label="Category equals" hint="The AI-classified category. Free text — no enum yet.">
                <input type="text" value={filter.categoryEquals || ''} onChange={(e) => setFilter('categoryEquals', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Priority equals">
                <select
                    value={filter.priorityEquals || ''}
                    onChange={(e) => setFilter('priorityEquals', e.target.value || undefined)}
                    className={inputClass()}
                >
                    <option value="">Any</option>
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                    <option value="urgent">urgent</option>
                </select>
            </FormRow>
            <FormRow label="Tag includes" hint="Fires only when the ticket carries this tag.">
                <input type="text" value={filter.tagIncludes || ''} onChange={(e) => setFilter('tagIncludes', e.target.value || undefined)}
                    className={inputClass()} />
            </FormRow>
            <FormRow label="Resolved by">
                <select
                    value={filter.resolvedBy || ''}
                    onChange={(e) => setFilter('resolvedBy', e.target.value || undefined)}
                    className={inputClass()}
                >
                    <option value="">Any</option>
                    <option value="ai">ai</option>
                    <option value="staff">staff</option>
                </select>
            </FormRow>
            <FormRow label="Min messages" hint="Skip tickets with fewer messages than this.">
                <input
                    type="number"
                    min={1}
                    value={filter.minMessages ?? ''}
                    onChange={(e) => setFilter('minMessages', e.target.value === '' ? undefined : Number(e.target.value))}
                    className={inputClass()}
                />
            </FormRow>
            <FormRow label="Require genuine contact" hint="Default on: only real customer conversations fire. Unchecking also matches tickets without verified customer contact.">
                <label className="inline-flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={filter.requireGenuineContact !== false}
                        onChange={(e) => setFilter('requireGenuineContact', e.target.checked ? undefined : false)}
                    />
                    Only genuine customer conversations
                </label>
            </FormRow>
        </FilterShell>
    );
}

// Lookup used by AppEventFields — `<provider>.<event>` → filter sub-form.
// Unmapped combos render no filter form (the runtime still applies the DSL
// filter via applyDslFilter). Individual exports above stay for tests.
export const FILTER_FORM_BY_KEY = {
    'gmail.mail.new': GmailFilterFields,
    'gmail.label.added': GmailLabelFilterFields,
    'google-calendar.event.changed': CalendarChangedFilterFields,
    'google-calendar.event.upcoming': CalendarUpcomingFilterFields,
    'google-drive.file.new': DriveFileNewFilterFields,
    'nextcloud.file.new': NextcloudFileFilterFields,
    'nextcloud.file.changed': NextcloudFileFilterFields,
    'nextcloud.share.received': NextcloudShareFilterFields,
    'nextcloud.activity.new': NextcloudActivityFilterFields,
    'nextcloud.notification.new': NextcloudNotificationFilterFields,
    'ticket-assistant.ticket.new': TicketAssistantTicketFilterFields,
    'ticket-assistant.sync.completed': TicketAssistantSyncFilterFields,
    'support.ticket.resolved': SupportTicketResolvedFilterFields,
};
