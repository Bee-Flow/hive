/**
 * Per-automation notification policy defaults — UI mirror.
 *
 * Kept in sync by hand with server/automation/notificationDefaults.js.
 * If you change one, change the other.
 */

export const NOTIFICATION_DEFAULTS = Object.freeze({
    onSuccess:  Object.freeze({ enabled: false, level: 'ai_task' }),
    onError:    Object.freeze({ enabled: true,  level: 'urgent' }),
    onApproval: Object.freeze({ enabled: true,  level: 'heads_up' }),
});

export const VALID_LEVELS = Object.freeze(['info', 'heads_up', 'urgent', 'ai_task']);

export const LEVEL_LABELS = Object.freeze({
    info:     'Info',
    heads_up: 'Heads up',
    urgent:   'Urgent',
    ai_task:  'Standard',
});
