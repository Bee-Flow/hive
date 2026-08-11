// Shared drag/drop plumbing for the mapping fields (BindingField / TemplateField
// / PathField / FieldKeyCombobox). Each re-declared the identical onDragOver +
// path-extraction for `application/x-binding-path` drags from the VariableTree;
// the per-field drop ACTION (insert vs replace vs last-segment) stays local.

const BINDING_MIME = 'application/x-binding-path';

/**
 * dragstart handler: publish a variable path as a binding drag.
 *
 * Lives here rather than in VariableTree (which re-exports it) because the
 * VariablePicker popover is a drag source too, and pulling a React component
 * module in for a four-line DOM helper is the wrong dependency direction.
 */
export function startPathDrag(e, path) {
    e.dataTransfer.setData('text/plain', path);
    e.dataTransfer.setData(BINDING_MIME, path);
    e.dataTransfer.effectAllowed = 'copy';
}

/** dragover handler: accept binding drags and show the copy cursor. */
export function onBindingDragOver(e) {
    if (e.dataTransfer?.types?.includes(BINDING_MIME)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }
}

/**
 * Read the dropped binding path, calling preventDefault when present.
 * Returns the path string, or null when the drop carries no path.
 */
export function getBindingDropPath(e) {
    const path = e.dataTransfer.getData(BINDING_MIME) || e.dataTransfer.getData('text/plain');
    if (!path) return null;
    e.preventDefault();
    return path;
}
