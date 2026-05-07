import React, { useLayoutEffect, useRef } from 'react';

/**
 * Click-to-edit text node, used inside the marketing site when it renders
 * with `?preview=1`. In normal mode it renders as a plain element.
 *
 * Two-way sync between side panel and inline preview:
 *   - Inline edits → on blur, post `cms-edit { path, value }` upstream.
 *   - Side-panel edits → arrive as a fresh `children` prop. We push that
 *     into the contentEditable element via useLayoutEffect, but only when
 *     the user isn't actively typing into it — so the caret never jumps
 *     mid-edit. We also do NOT pass `children` as JSX child of the Tag,
 *     since React would otherwise reconcile the text node and clobber
 *     mid-edit content; useLayoutEffect is the single source of truth
 *     for the element's textContent.
 *
 * Path syntax: dot-segmented, with array indices written as plain dots
 *   "hero.lead"
 *   "features.items.0.title"
 */

let _previewModeCache = null;
function isPreviewMode() {
    if (_previewModeCache !== null) return _previewModeCache;
    if (typeof window === 'undefined') return false;
    _previewModeCache = new URLSearchParams(window.location.search).has('preview');
    return _previewModeCache;
}

export default function EditableText({
    path,
    as: Tag = 'span',
    children,
    className = '',
    placeholder,
    multiline = false,
    style,
}) {
    const ref = useRef(null);
    // String form is the "external truth" — what the side panel believes
    // the value to be. We compare against textContent in the sync effect
    // below to decide whether to push it into the DOM.
    const childrenStr = String(children ?? '');
    // Capture-on-focus snapshot so Escape can restore it.
    const focusValueRef = useRef(childrenStr);

    // If we're not in preview mode, render as plain text — no edit affordance.
    if (!isPreviewMode()) {
        return <Tag className={className} style={style}>{children}</Tag>;
    }

    // Sync external prop changes into the contentEditable element. Bails
    // when the element is focused so the user's typing isn't disturbed —
    // their pending text is committed via handleBlur. Runs after every
    // render rather than on a `[childrenStr]` dep so newly-mounted nodes
    // pick up their initial textContent before paint.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (typeof document !== 'undefined' && document.activeElement === el) return;
        if (el.textContent !== childrenStr) {
            el.textContent = childrenStr;
        }
        // Keep data-cms-empty in lock-step with content so the CSS
        // placeholder (rendered via ::before from data-cms-placeholder)
        // doesn't double up with the user's text.
        if (childrenStr) el.removeAttribute('data-cms-empty');
        else             el.setAttribute('data-cms-empty', 'true');
    });

    const handleBlur = (e) => {
        const next = (e.currentTarget.textContent || '').replace(/ /g, ' ');
        const prev = childrenStr;
        if (next) e.currentTarget.removeAttribute('data-cms-empty');
        else      e.currentTarget.setAttribute('data-cms-empty', 'true');
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
            // Discard: restore the value at focus-time and blur without
            // firing change.
            e.currentTarget.textContent = focusValueRef.current;
            e.currentTarget.blur();
        }
    };

    const handleFocus = () => {
        // Capture the value at focus-time as the "original" — used by Esc
        // and to compare against blur-time content for change detection.
        if (ref.current) focusValueRef.current = ref.current.textContent || '';
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
            data-cms-placeholder={placeholder}
            onBlur={handleBlur}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            // No children here on purpose — useLayoutEffect owns textContent.
        />
    );
}
