import React from 'react';
import ExpressionInput from './ExpressionInput';

/**
 * FormulaField — the BLOCK presentation of ExpressionInput, kept as its own
 * name because seven call sites and four test files already speak it.
 *
 * Everything it used to do now lives in ExpressionInput (the two presentations)
 * and useExpressionEditing (the behaviour), so the inline filter-row editor
 * gets the picker, the live parse error and the evaluated preview that only
 * this one had.
 *
 * One behaviour change came with the move: the condition-builder escape is now
 * offered only when the caller says a boolean is wanted (`expectsBoolean`).
 * It used to appear wherever a definition and a node were passed — including
 * computed props and chart data, where clicking it rewrote a working value
 * expression into a comparison.
 *
 * `value` is the raw expression string; onChange emits the raw string.
 */
export default function FormulaField(props) {
    return <ExpressionInput variant="block" {...props} />;
}
