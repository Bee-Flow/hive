import React from 'react';

/**
 * Per-provider filter builder. Mirrors the matcher shapes in
 * server/automation/triggerBus.js (matchGmailMailFilter,
 * matchCalendarChangedFilter, etc.) so what the user fills in here is
 * exactly what the runtime checks against the inbound event.
 *
 * Unsupported providers fall through to a JSON textarea — never block the
 * user from writing arbitrary filter shapes if the dedicated UI doesn't
 * cover their case yet.
 */

function inputClass() {
    return 'w-full px-3 py-2 rounded-lg border bg-[var(--bg-card)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)] transition-colors';
}

function inputStyle() {
    return { borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' };
}

function Field({ label, hint, children }) {
    return (
        <div className="mb-3">
            <label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">{label}</label>
            {children}
            {hint && <div className="text-[11px] text-[var(--text-tertiary)] mt-1">{hint}</div>}
        </div>
    );
}

function CSVInput({ value, onChange, placeholder }) {
    const text = Array.isArray(value) ? value.join(', ') : (value || '');
    return (
        <input
            type="text"
            value={text}
            onChange={(e) => {
                const parts = e.target.value
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean);
                onChange(parts.length === 0 ? undefined : parts);
            }}
            placeholder={placeholder}
            className={inputClass()}
            style={inputStyle()}
        />
    );
}

function GmailFilter({ filter, onChange, expert }) {
    const set = (key, v) => onChange({ ...filter, [key]: v === '' || v === undefined || v === null ? undefined : v });
    return (
        <>
            <Field label="From contains">
                <input
                    type="text"
                    value={filter.from || ''}
                    onChange={(e) => set('from', e.target.value)}
                    placeholder="boss@example.com"
                    className={inputClass()}
                    style={inputStyle()}
                />
            </Field>
            <Field label="To contains">
                <input
                    type="text"
                    value={filter.to || ''}
                    onChange={(e) => set('to', e.target.value)}
                    placeholder="me@example.com"
                    className={inputClass()}
                    style={inputStyle()}
                />
            </Field>
            <Field label="Subject contains">
                <input
                    type="text"
                    value={filter.subjectContains || ''}
                    onChange={(e) => set('subjectContains', e.target.value)}
                    placeholder="invoice"
                    className={inputClass()}
                    style={inputStyle()}
                />
            </Field>
            <Field label="Has any of these labels (comma-separated)">
                <CSVInput value={filter.labelIds} onChange={(v) => set('labelIds', v)} placeholder="IMPORTANT, Label_3" />
            </Field>
            <Field label="Exclude messages with labels">
                <CSVInput value={filter.excludeLabelIds} onChange={(v) => set('excludeLabelIds', v)} placeholder="SPAM" />
            </Field>
            <div className="flex items-center gap-4 mb-2">
                <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
                    <input
                        type="checkbox"
                        checked={!!filter.hasAttachment}
                        onChange={(e) => set('hasAttachment', e.target.checked || undefined)}
                    />
                    Has attachment
                </label>
                <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)]">
                    <input
                        type="checkbox"
                        checked={!!filter.excludeFromSelf}
                        onChange={(e) => set('excludeFromSelf', e.target.checked || undefined)}
                    />
                    Exclude messages I sent
                </label>
            </div>
            {expert && (
                <Field
                    label="Subject regex (expert)"
                    hint="JS regex against the Subject header. Capped at 200 chars; invalid patterns fail-closed."
                >
                    <input
                        type="text"
                        value={filter.subjectRegex || ''}
                        onChange={(e) => set('subjectRegex', e.target.value)}
                        placeholder="^Order #\d+"
                        className={inputClass()}
                        style={inputStyle()}
                    />
                </Field>
            )}
        </>
    );
}

function GoogleCalendarFilter({ filter, onChange }) {
    const set = (key, v) => onChange({ ...filter, [key]: v === '' ? undefined : v });
    return (
        <>
            <Field label="Calendar id" hint="Default 'primary' if blank.">
                <input
                    type="text"
                    value={filter.calendarId || ''}
                    onChange={(e) => set('calendarId', e.target.value)}
                    placeholder="primary"
                    className={inputClass()}
                    style={inputStyle()}
                />
            </Field>
            <Field label="Summary contains">
                <input
                    type="text"
                    value={filter.summaryContains || ''}
                    onChange={(e) => set('summaryContains', e.target.value)}
                    placeholder="standup"
                    className={inputClass()}
                    style={inputStyle()}
                />
            </Field>
            <Field label="Attendee contains">
                <input
                    type="text"
                    value={filter.attendeeContains || ''}
                    onChange={(e) => set('attendeeContains', e.target.value)}
                    placeholder="@example.com"
                    className={inputClass()}
                    style={inputStyle()}
                />
            </Field>
        </>
    );
}

function MsGraphMailFilter({ filter, onChange }) {
    const set = (key, v) => onChange({ ...filter, [key]: v === '' ? undefined : v });
    return (
        <>
            <Field label="From contains">
                <input
                    type="text"
                    value={filter.fromContains || ''}
                    onChange={(e) => set('fromContains', e.target.value)}
                    placeholder="boss@example.com"
                    className={inputClass()}
                    style={inputStyle()}
                />
            </Field>
            <Field label="Subject contains">
                <input
                    type="text"
                    value={filter.subjectContains || ''}
                    onChange={(e) => set('subjectContains', e.target.value)}
                    placeholder="invoice"
                    className={inputClass()}
                    style={inputStyle()}
                />
            </Field>
            <Field label="Importance">
                <select
                    value={filter.importance || ''}
                    onChange={(e) => set('importance', e.target.value)}
                    className={inputClass()}
                    style={inputStyle()}
                >
                    <option value="">Any</option>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                </select>
            </Field>
        </>
    );
}

function NextcloudFilter({ filter, onChange, eventType }) {
    const set = (key, v) => onChange({ ...filter, [key]: v === '' || v === undefined ? undefined : v });

    // Per-event-type structured fields. We branch on the event so the user
    // sees the right shape (file vs share vs deck vs talk vs calendar).
    if (eventType?.startsWith('deck.card')) {
        return (
            <>
                <Field label="Board ID">
                    <input type="text" value={filter.boardId || ''} onChange={(e) => set('boardId', e.target.value)} className={inputClass()} style={inputStyle()} />
                </Field>
                <Field label="Stack ID">
                    <input type="text" value={filter.stackId || ''} onChange={(e) => set('stackId', e.target.value)} className={inputClass()} style={inputStyle()} />
                </Field>
                <Field label="Title contains">
                    <input type="text" value={filter.titleContains || ''} onChange={(e) => set('titleContains', e.target.value)} className={inputClass()} style={inputStyle()} />
                </Field>
                {eventType === 'deck.card.moved' && (
                    <>
                        <Field label="From stack id">
                            <input type="text" value={filter.fromStackId || ''} onChange={(e) => set('fromStackId', e.target.value)} className={inputClass()} style={inputStyle()} />
                        </Field>
                        <Field label="To stack id">
                            <input type="text" value={filter.toStackId || ''} onChange={(e) => set('toStackId', e.target.value)} className={inputClass()} style={inputStyle()} />
                        </Field>
                    </>
                )}
            </>
        );
    }
    if (eventType?.startsWith('talk.')) {
        return (
            <>
                <Field label="Room token">
                    <input type="text" value={filter.roomToken || ''} onChange={(e) => set('roomToken', e.target.value)} className={inputClass()} style={inputStyle()} />
                </Field>
                <Field label="Room name contains">
                    <input type="text" value={filter.roomNameContains || ''} onChange={(e) => set('roomNameContains', e.target.value)} className={inputClass()} style={inputStyle()} />
                </Field>
                <Field label="Message contains">
                    <input type="text" value={filter.messageContains || ''} onChange={(e) => set('messageContains', e.target.value)} className={inputClass()} style={inputStyle()} />
                </Field>
                <Field label="Actor equals">
                    <input type="text" value={filter.actorEquals || ''} onChange={(e) => set('actorEquals', e.target.value)} className={inputClass()} style={inputStyle()} />
                </Field>
                <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] mt-2">
                    <input type="checkbox" checked={!!filter.excludeOwnMessages} onChange={(e) => set('excludeOwnMessages', e.target.checked || undefined)} />
                    Exclude my own messages
                </label>
            </>
        );
    }
    if (eventType?.startsWith('calendar.event')) {
        return (
            <>
                <Field label="Calendar id">
                    <input type="text" value={filter.calendarId || ''} onChange={(e) => set('calendarId', e.target.value)} placeholder="personal" className={inputClass()} style={inputStyle()} />
                </Field>
                <Field label="Summary contains">
                    <input type="text" value={filter.summaryContains || ''} onChange={(e) => set('summaryContains', e.target.value)} className={inputClass()} style={inputStyle()} />
                </Field>
                <Field label="Attendee contains">
                    <input type="text" value={filter.attendeeContains || ''} onChange={(e) => set('attendeeContains', e.target.value)} className={inputClass()} style={inputStyle()} />
                </Field>
                {eventType === 'calendar.event.upcoming' && (
                    <Field label="Lead time (minutes)" hint="How many minutes before the event starts to fire (default 15).">
                        <input type="number" min="0" value={filter.leadMinutes ?? ''} onChange={(e) => set('leadMinutes', e.target.value === '' ? undefined : Number(e.target.value))} className={inputClass()} style={inputStyle()} />
                    </Field>
                )}
            </>
        );
    }
    if (eventType?.startsWith('share.')) {
        return (
            <>
                <Field label="Path / name contains">
                    <input type="text" value={filter.nameContains || ''} onChange={(e) => set('nameContains', e.target.value)} className={inputClass()} style={inputStyle()} />
                </Field>
                <Field label="Actor equals">
                    <input type="text" value={filter.actorEquals || ''} onChange={(e) => set('actorEquals', e.target.value)} className={inputClass()} style={inputStyle()} />
                </Field>
                <Field label="Kind">
                    <select value={filter.kindEquals || ''} onChange={(e) => set('kindEquals', e.target.value)} className={inputClass()} style={inputStyle()}>
                        <option value="">Any</option>
                        <option value="file">File</option>
                        <option value="folder">Folder</option>
                    </select>
                </Field>
                <Field label="Share type">
                    <select value={filter.shareType || ''} onChange={(e) => set('shareType', e.target.value)} className={inputClass()} style={inputStyle()}>
                        <option value="">Any</option>
                        <option value="link">Public link</option>
                        <option value="user">User</option>
                        <option value="group">Group</option>
                        <option value="federated">Federated</option>
                    </select>
                </Field>
            </>
        );
    }
    // Default — file events (file.new / file.changed / file.deleted /
    // file.renamed / file.commented / file.tagged) all share path/name/extension semantics.
    return (
        <>
            <Field label="In folder (path prefix)">
                <input type="text" value={filter.inFolder || filter.pathPrefix || ''} onChange={(e) => set(eventType?.startsWith('file.') ? 'inFolder' : 'pathPrefix', e.target.value)} placeholder="/Documents/" className={inputClass()} style={inputStyle()} />
            </Field>
            <Field label="Extension">
                <input type="text" value={filter.extension || ''} onChange={(e) => set('extension', e.target.value)} placeholder="pdf" className={inputClass()} style={inputStyle()} />
            </Field>
            <Field label="Name contains">
                <input type="text" value={filter.nameContains || ''} onChange={(e) => set('nameContains', e.target.value)} className={inputClass()} style={inputStyle()} />
            </Field>
            <Field label="Actor in (comma-separated)">
                <CSVInput value={filter.actorIn} onChange={(v) => set('actorIn', v)} placeholder="alice,bob" />
            </Field>
            <label className="flex items-center gap-2 text-[13px] text-[var(--text-primary)] mt-2">
                <input type="checkbox" checked={!!filter.excludeOwnUploads} onChange={(e) => set('excludeOwnUploads', e.target.checked || undefined)} />
                Exclude my own uploads
            </label>
        </>
    );
}

/**
 * Power-user "rich filter" combinator: any / none / expr / age. Mirrors
 * the server-side DSL in triggerBus.js applyDslFilter so the UI surfaces
 * exactly what the runtime evaluates.
 */
function DslExtras({ filter, onChange }) {
    const set = (key, v) => onChange({ ...filter, [key]: v === '' || v === undefined || v === null ? undefined : v });
    const setAge = (key, v) => onChange({
        ...filter,
        age: { ...(filter.age || {}), [key]: v === '' || v === undefined ? undefined : Number(v) },
    });
    return (
        <div className="mt-4 pt-4 border-t border-dashed border-[var(--border-default)]">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] mb-2">Advanced (rich filter DSL)</div>
            <Field
                label="Expression"
                hint='Boolean expression evaluated against the trigger payload. Reference fields as `trigger.<field>`. Example: `trigger.size > 1024 * 1024`.'
            >
                <input type="text" value={filter.expr || ''} onChange={(e) => set('expr', e.target.value)} placeholder="trigger.size > 1024 * 1024" className={inputClass()} style={inputStyle()} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Older than (minutes)">
                    <input type="number" min="0" value={filter.age?.olderThanMinutes ?? ''} onChange={(e) => setAge('olderThanMinutes', e.target.value)} className={inputClass()} style={inputStyle()} />
                </Field>
                <Field label="Newer than (minutes)">
                    <input type="number" min="0" value={filter.age?.newerThanMinutes ?? ''} onChange={(e) => setAge('newerThanMinutes', e.target.value)} className={inputClass()} style={inputStyle()} />
                </Field>
            </div>
        </div>
    );
}

function RawFilterEditor({ filter, onChange }) {
    const [text, setText] = React.useState(JSON.stringify(filter || {}, null, 2));
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        // Sync external updates only when local buffer hasn't been edited.
        try {
            const current = JSON.parse(text);
            if (JSON.stringify(current) !== JSON.stringify(filter || {})) {
                setText(JSON.stringify(filter || {}, null, 2));
            }
        } catch {
            // user is mid-edit; leave alone
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

    const tryCommit = (next) => {
        setText(next);
        try {
            const parsed = JSON.parse(next || '{}');
            setError(null);
            onChange(parsed);
        } catch (e) {
            setError(e.message);
        }
    };

    return (
        <Field label="Raw filter JSON" hint="Used when the structured fields don't cover your case.">
            <textarea
                value={text}
                onChange={(e) => tryCommit(e.target.value)}
                rows={6}
                spellCheck={false}
                className="w-full px-3 py-2 rounded-lg border bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)] font-mono outline-none focus:border-[var(--accent-primary)] transition-colors"
                style={inputStyle()}
            />
            {error && <div className="text-[11px] text-red-600 mt-1">{error}</div>}
        </Field>
    );
}

const PROVIDER_LABEL = {
    gmail: 'Gmail',
    'google-calendar': 'Google Calendar',
    'google-drive': 'Google Drive',
    msgraph: 'Microsoft 365',
    nextcloud: 'Nextcloud',
    'ticket-assistant': 'Ticket Assistant',
};

export default function TriggerFilterBuilder({ provider, eventType, filter = {}, onChange, expert = false }) {
    const safe = filter && typeof filter === 'object' ? filter : {};

    const Editor = (() => {
        if (provider === 'gmail') return <GmailFilter filter={safe} onChange={onChange} expert={expert} />;
        if (provider === 'google-calendar') return <GoogleCalendarFilter filter={safe} onChange={onChange} />;
        if (provider === 'msgraph' && (eventType === 'mail.new' || eventType === 'mail.flagged'))
            return <MsGraphMailFilter filter={safe} onChange={onChange} />;
        if (provider === 'nextcloud') return <NextcloudFilter filter={safe} onChange={onChange} eventType={eventType} />;
        // No structured editor — fall through to raw JSON.
        return <RawFilterEditor filter={safe} onChange={onChange} />;
    })();

    // Rich-filter DSL is universal — every provider/event benefits from
    // any/none/expr/age combinators. Surface it for non-Gmail providers
    // when expert mode is on (Gmail keeps its existing per-event regex
    // toggle to avoid two ways to do the same thing).
    const showDsl = expert && provider !== 'gmail';

    return (
        <div>
            <div className="text-[11px] text-[var(--text-tertiary)] mb-2">
                Filter for {PROVIDER_LABEL[provider] || provider} · {eventType}
            </div>
            {Editor}
            {showDsl && <DslExtras filter={safe} onChange={onChange} />}
            {expert && (provider === 'gmail' || provider === 'google-calendar' || provider === 'nextcloud'
                || (provider === 'msgraph' && (eventType === 'mail.new' || eventType === 'mail.flagged')))
                && <RawFilterEditor filter={safe} onChange={onChange} />}
        </div>
    );
}
