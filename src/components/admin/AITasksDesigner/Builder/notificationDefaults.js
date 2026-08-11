/**
 * Per-automation notification policy defaults — UI mirror.
 *
 * Kept in sync by hand with server/automation/notificationDefaults.js.
 * If you change one, change the other.
 */

export const NOTIFICATION_DEFAULTS = Object.freeze({
    onSuccess:  Object.freeze({ enabled: false, level: 'ai_task',  channels: Object.freeze(['inapp']) }),
    onError:    Object.freeze({ enabled: true,  level: 'urgent',   channels: Object.freeze(['inapp']) }),
    onApproval: Object.freeze({ enabled: true,  level: 'heads_up', channels: Object.freeze(['inapp']) }),
});

export const VALID_LEVELS = Object.freeze(['info', 'heads_up', 'urgent', 'ai_task']);

export const LEVEL_LABELS = Object.freeze({
    info:     'Info',
    heads_up: 'Heads up',
    urgent:   'Urgent',
    ai_task:  'Standard',
});

// Delivery channels (the "where"). 'inapp' (the bell) is always on and
// non-removable; 'email' is wired for real on the server. slack/push have
// no backend yet — rendered disabled ("coming soon") so the UI stays honest.
export const VALID_CHANNELS = Object.freeze(['inapp', 'email']);

export const CHANNEL_OPTIONS = Object.freeze([
    Object.freeze({ key: 'inapp', label: 'In-app bell', always: true }),
    Object.freeze({ key: 'email', label: 'Email' }),
    Object.freeze({ key: 'slack', label: 'Slack', comingSoon: true }),
    Object.freeze({ key: 'push',  label: 'Push',  comingSoon: true }),
]);

/** Short names for the canvas, where "notification" as a chip said nothing. */
export const CHANNEL_LABELS = Object.freeze({
    inapp: 'In-app',
    notification: 'In-app',   // the notification STEP's own name for the bell
    email: 'Email',
    slack: 'Slack',
    push: 'Push',
});

/**
 * A notification STEP's `channels`, in the vocabulary this UI speaks.
 *
 * The runner calls the bell `notification` on a step and `inapp` on the
 * run-level policy, and accepts either in both places
 * (core/automationRunner/engine.js `execNotification`). The UI settles on
 * `inapp` so one set of pills serves both, and maps the legacy name on the way
 * in so an existing step still shows its bell as lit.
 */
export function stepChannelsToUi(channels) {
    const raw = Array.isArray(channels) && channels.length ? channels : ['inapp'];
    return normalizeChannels(raw.map(c => (c === 'notification' ? 'inapp' : c)));
}

/**
 * Keep only known channels, always include the bell, de-dupe. Mirrors the
 * server's normalizeChannels so the UI and the runner agree on the shape.
 */
export function normalizeChannels(channels) {
    const valid = Array.isArray(channels) ? channels.filter(c => VALID_CHANNELS.includes(c)) : [];
    return Array.from(new Set(['inapp', ...valid]));
}
