/**
 * radius — helper for tokenised border-radius in inline styles.
 *
 * Inline `borderRadius: '12px'` ignores `--radius-scale`. Prefer
 *   style={{ borderRadius: r('md') }}
 * for any new code so corner roundness obeys the admin's preset.
 *
 * Existing inline radii across the codebase will be swept opportunistically;
 * use this helper for new code only.
 */
export type RadiusToken = 'sm' | 'md' | 'lg' | 'xl';

export function r(token: RadiusToken = 'md'): string {
    return `var(--radius-${token})`;
}

export default r;
