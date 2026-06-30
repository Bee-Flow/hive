/**
 * Pure formatters/helpers for the routines list + editor (§WS5, extracted
 * verbatim from AITasksDesigner/index.jsx).
 */

const REPEAT_OPTIONS = [
    { value: '',          label: 'One-time (no repeat)' },
    { value: 'daily',     label: 'Daily' },
    { value: 'weekdays',  label: 'Weekdays (Mon–Fri)' },
    { value: 'weekly',    label: 'Weekly' },
    { value: 'biweekly',  label: 'Every 2 weeks' },
    { value: 'monthly',   label: 'Monthly' },
    { value: 'quarterly', label: 'Every 3 months' },
    { value: 'yearly',    label: 'Yearly' },
];

function repeatLabel(value) {
    const opt = REPEAT_OPTIONS.find(o => o.value === (value || ''));
    return opt ? opt.label : value;
}

function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
}

function formatNextRun(dateStr) {
    if (!dateStr) return '—';
    const dt = new Date(dateStr);
    const now = new Date();
    const isToday = dt.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = dt.toDateString() === tomorrow.toDateString();
    const timeStr = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${timeStr}`;
    if (isTomorrow) return `Tomorrow at ${timeStr}`;
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ` at ${timeStr}`;
}

/**
 * Compose the message handed to the automation builder when a user implements a
 * "Find repeating work" suggestion. It's the model's self-contained buildPrompt
 * PLUS the concrete grounding from the scan (what was actually observed, which
 * apps, the suggested trigger, est. time saved) so the builder AI has the full
 * search context "where needed" — not just a title. Every field is already
 * PII-filtered server-side (stripTokens); we only append lines that exist.
 */
function buildMessageFromSuggestion(s) {
    if (!s) return '';
    const base = String(s.buildPrompt || '').trim();
    const ctx = [];
    const ev = s.evidence;
    const evSummary = ev && typeof ev === 'object' ? ev.summary : (typeof ev === 'string' ? ev : '');
    if (evSummary) ctx.push(`- Observed in your tools: ${evSummary}`);
    if (ev && typeof ev === 'object' && Array.isArray(ev.signals) && ev.signals.length) {
        const sig = ev.signals.slice(0, 6).map((x) => {
            const count = x.count != null ? ` ×${x.count}` : '';
            const recent = x.lastUsedDays != null ? `, last ${x.lastUsedDays}d` : '';
            return `${x.tool || x.integration || ''}${count}${recent}`.trim();
        }).filter(Boolean).join('; ');
        if (sig) ctx.push(`- Signals: ${sig}`);
    }
    if (Array.isArray(s.requiredIntegrations) && s.requiredIntegrations.length) {
        ctx.push(`- Apps to use: ${s.requiredIntegrations.join(', ')}`);
    }
    if (Array.isArray(s.unavailableIntegrations) && s.unavailableIntegrations.length) {
        ctx.push(`- Not yet connected (mention if a connection is needed): ${s.unavailableIntegrations.join(', ')}`);
    }
    if (s.triggerKind) ctx.push(`- Suggested trigger: ${s.triggerKind}`);
    const mins = s.value && typeof s.value === 'object' ? s.value.minutesSavedPerMonth : s.timeSavedMinutes;
    if (mins) ctx.push(`- Estimated time saved: ~${mins} min/month`);
    if (!ctx.length) return base;
    return [
        base,
        '',
        'Context from the "Find repeating work" scan (already privacy-filtered — use it to build the automation precisely):',
        ...ctx,
    ].join('\n');
}

export { REPEAT_OPTIONS, repeatLabel, timeAgo, formatNextRun, buildMessageFromSuggestion };
