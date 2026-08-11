/**
 * The one colour the billing surfaces share, and why it isn't a theme token.
 *
 * `--accent-primary` in this product is a deliberately neutral grey (#9ca3af /
 * #6b7280 — see src/index.css). That reads as "disabled" on a primary
 * conversion button, so every billing surface has independently reached for
 * this blue instead: OrgInfoPanel's Subscribe/Change-plan buttons, the consumer
 * plan grid's checkout CTA, and the license-key activation panel all hardcoded
 * the same #3b82f6.
 *
 * Naming it here doesn't add a new colour — it names the one already in use, so
 * the org and personal billing screens can't drift apart again, and so there is
 * a single place to change if a real `--accent-action` token ever lands.
 *
 * Success/current-plan states are NOT this colour: those use `var(--success)`,
 * which is a genuine token and already matches the emerald those screens used.
 */
export const BILLING_ACTION = '#3b82f6';

/** Tinted variants of the same blue, for borders and subtle fills. */
export const BILLING_ACTION_BORDER = 'rgba(59,130,246,0.3)';
export const BILLING_ACTION_TINT = 'rgba(59,130,246,0.05)';
