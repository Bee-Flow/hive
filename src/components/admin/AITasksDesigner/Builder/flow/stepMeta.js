/**
 * Single source of truth for the user-facing name of reusable building blocks.
 *
 * The wire identifier is `block` (kind='block', step type `call_block`) to
 * avoid colliding with the generic "step" node concept — exactly the
 * Flowlet⇄`layer_*` split. Everything the user reads ("Step", "Steps") comes
 * from here so the brand name is a single edit.
 */

export const STEP_LABEL = 'Step';
export const STEP_LABEL_PLURAL = 'Steps';
export const STEP_CATEGORY = 'Steps';

// Default node label when a call_block step has no title yet.
export const STEP_NODE_DEFAULT = 'Step';
