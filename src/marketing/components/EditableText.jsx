import React, { useEffect, useRef } from 'react';

/**
 * Click-to-edit text node, used inside the marketing site when it renders
 * with `?preview=1`. In normal mode it renders as a plain element.
 *
 * Inline editing rules:
 *   - The node becomes contentEditable.
 *   - On blur, posts {type: 'cms-edit', path, value} to the parent window.
 *   - The node is memoized so React never overwrites the user's keystrokes
 *     mid-edit (path-keyed equality).
 *
 * Path syntax:  dot-segmented, with array indices written as plain dots.
 *   "hero.lead"
 *   "features.items.0.title"
 *
 * The parent panel resolves these into the content tree.
 */

let _previewModeCache = null;
function isPreviewMode() {
    if (_previewModeCache !== null) return _previewModeCache;
    if (typeof window === 'undefined') return false;
    _previewModeCache = new URLSearchParams(window.location.search).has('preview');
    return _previewModeCache;
}

const EditableText = React.memo(function EditableText({
    path,
    as: Tag = 'span',
    children,
    className = '',
    placeholder,
    multiline = false,
    style,
}) {
    const ref = useRef(null);
    const initialRef = useRef(children);

    // Set the initial textContent once. We deliberately do NOT keep this in
    // sync with the `children` prop so re-renders driven by sibling edits
    // never clobber the user's caret position.
    useEffect(() => {
        if (!ref.current) return;
        if (ref.current.textContent === '' && initialRef.current) {
            ref.current.textContent = String(initialRef.current);
        }
    }, []);

    // If we're not in preview mode, render as plain text — no edit affordance.
    if (!isPreviewMode()) {
        return <Tag className={className} style={style}>{children}</Tag>;
    }

    const handleBlur = (e) => {
        const next = (e.currentTarget.textContent || '').replace(/ /g, ' ');
        const prev = String(children ?? '');
        if (next !== prev) {
            window.parent?.postMessage(
                { type: 'cms-edit', path, value: next },
                '*'
            );
        }
    };

    const handleKeyDown = (e) => {
        // Block paragraph breaks for single-line fields; commit on Enter.
        if (!multiline && e.key === 'Enter') {
            e.preventDefault();
            e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
            // Discard: restore original text and blur without firing change.
            e.currentTarget.textContent = String(initialRef.current ?? '');
            e.currentTarget.blur();
        }
    };

    const handleFocus = () => {
        // Capture the value at focus-time as the "original" — used by Esc.
        if (ref.current) initialRef.current = ref.current.textContent;
    };

    return (
        <Tag
            ref={ref}
            className={`${className} cms-editable`.trim()}
            style={style}
            contentEditable
            suppressContentEditableWarning
            spellCheck="true"
            data-cms-path={path}
            data-cms-empty={!children ? 'true' : undefined}
            data-cms-placeholder={placeholder}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
        >
            {children /* rendered once on mount; React.memo prevents updates */}
        </Tag>
    );
}, (prev, next) => prev.path === next.path);

export default EditableText;
