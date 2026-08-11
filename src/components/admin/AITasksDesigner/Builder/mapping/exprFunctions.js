/**
 * FE mirror of the server's restricted-expression function whitelist.
 *
 * The whitelist now lives in the SHARED, isomorphic engine (`@shared/expr`),
 * which both the server (via server/automation/expr.js) and this file import —
 * so there is no hand-maintained list to drift. The lockstep test still pins
 * FE === server by loading the server re-export. The condition builder's
 * operator registry in ../utils/conditionModel.js serialises to these helpers.
 */
export { EXPR_FUNCTIONS, EXPR_FUNCTION_NAMES } from '@shared/expr/engine.mjs';

// Operator cheatsheet for the syntax-help panel (grammar lives server-side
// in expr.js — comparators, boolean logic, arithmetic, ternary, parens).
export const EXPR_OPERATOR_GROUPS = [
    { label: 'Compare', ops: '==  !=  >  >=  <  <=' },
    { label: 'Combine', ops: '&& (and)   || (or)   ! (not)' },
    { label: 'Maths', ops: '+  -  *  /  %' },
    { label: 'Choose', ops: 'condition ? a : b' },
    { label: 'Paths', ops: 'steps.step1.output.field   item.name   list[0]' },
];
