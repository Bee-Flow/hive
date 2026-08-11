/**
 * Shared expression language — single source of truth for both the automation
 * runtime (server, via server/automation/expr.js which re-requires this) and
 * App Studio (client, via the `@shared` Vite alias).
 *
 * See engine.mjs for the grammar + safety model and functions.mjs for the
 * whitelist. Requires Node ≥22.12 on the server (require(esm)); pinned in
 * server/package.json engines.
 */
export {
    parseExpr,
    compile,
    evaluate,
    tryEvaluate,
    ExprError,
    FUNCTIONS,
    EXPR_FUNCTIONS,
    EXPR_FUNCTION_NAMES,
} from './engine.mjs';
