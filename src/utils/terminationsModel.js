// Shared pure model for the Terminations analytics panels (admin MonitoringPanel
// + org settings). The two panels' render trees diverged across design kits and
// i18n, but this domain logic is identical and lives here as the single source.

/** Termination-type render order (shared by both panels). */
export const TYPE_ORDER = ['max_tokens', 'max_iterations', 'error', 'aborted'];

export const LARGE_INPUT_TOKEN_THRESHOLD = 8000;
export const LARGE_ATTACHMENT_BYTES_THRESHOLD = 256 * 1024; // 256 KB

/**
 * Heuristic: a stop is "input-driven" when the prompt/attachment was unusually
 * large — surfaces the case where a big upload leaves no room for output.
 *
 * Token-based checks apply only when `showTokens` is true (self-hosted /
 * cloud-admin). The cloud customer view passes false so the badge is
 * attachment-driven only and never leaks token magnitude. The admin panel
 * omits the argument (defaults true) → all checks, as before.
 */
export function isLargeInput(row, showTokens = true) {
    if ((row.attachment_bytes || 0) >= LARGE_ATTACHMENT_BYTES_THRESHOLD) return true;
    if (!showTokens) return false;
    if ((row.prompt_tokens || 0) >= LARGE_INPUT_TOKEN_THRESHOLD) return true;
    const total = (row.prompt_tokens || 0) + (row.completion_tokens || 0);
    if (total > 0 && (row.prompt_tokens / total) >= 0.85 && row.termination_type === 'max_tokens') return true;
    return false;
}
