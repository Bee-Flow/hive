import React, { createContext, useContext, useLayoutEffect, useRef } from 'react';

/**
 * Identifies which page block the editable text lives inside.
 * ProductWebsite.jsx wraps each rendered block's subtree in a provider set
 * to that block's unique `id`. EditableText reads it and stamps it onto the
 * `cms-edit` message, so the panel can write to the exact block that was
 * edited — paths alone are block-type-relative (e.g. "content.columns.0…")
 * and collide when a page has two blocks of the same type. Default `null`
 * means "not inside a block" (site chrome: header/footer), which the panel
 * routes by path prefix instead.
 */
export const BlockIdContext = createContext(null);

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
    // Which block this editable belongs to (null for site chrome). Stamped
    // onto cms-edit so the panel writes to this exact block, not the first
    // block of the same type.
    const blockId = useContext(BlockIdContext);
    // String form is the "external truth" — what the side panel believes
    // the value to be. We compare against textContent in the sync effect
    // below to decide whether to push it into the DOM.
    const childrenStr = String(children ?? '');
    // Capture-on-focus snapshot so Escape can restore it.
    const focusValueRef = useRef(childrenStr);
    const previewMode = isPreviewMode();

    // Multi-line fields keep their newlines: `white-space: pre-wrap` makes
    // a stored "\n" render as a real line break in both preview and the
    // live site. Caller-supplied `style` still wins if it sets the prop.
    const mergedStyle = multiline ? { whiteSpace: 'pre-wrap', ...style } : style;

    // Sync external prop changes into the contentEditable element. Bails
    // when the element is focused so the user's typing isn't disturbed —
    // their pending text is committed via handleBlur. Runs after every
    // render rather than on a `[childrenStr]` dep so newly-mounted nodes
    // pick up their initial textContent before paint. No-op when not in
    // preview mode (we render a plain Tag in that case, ref isn't set).
    useLayoutEffect(() => {
        if (!previewMode) return;
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

    // If we're not in preview mode, render as plain text — no edit affordance.
    if (!previewMode) {
        return <Tag className={className} style={mergedStyle}>{children}</Tag>;
    }

    const handleBlur = (e) => {
        // Multi-line fields read `innerText` so newlines the user typed
        // (browsers store them as <div>/<br> inside contentEditable)
        // survive as "\n"; `textContent` would silently flatten them.
        const raw = multiline
            ? (e.currentTarget.innerText || '')
            : (e.currentTarget.textContent || '');
        const next = (raw).replace(/ /g, ' ');
        const prev = childrenStr;
        if (next) e.currentTarget.removeAttribute('data-cms-empty');
        else      e.currentTarget.setAttribute('data-cms-empty', 'true');
        if (next !== prev) {
            window.parent?.postMessage(
                { type: 'cms-edit', blockId, path, value: next },
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
        // Mirror the write path's target: when the user starts editing a
        // field, tell the panel to highlight THIS block, so the left-panel
        // selection tracks the block being edited (same blockId the blur
        // cms-edit will write to). Chrome editables (blockId null) don't map
        // to a page block, so they leave block selection untouched.
        if (blockId) {
            window.parent?.postMessage(
                { type: 'cms-select', blockId },
                '*'
            );
        }
    };

    return (
        <Tag
            ref={ref}
            className={`${className} cms-editable`.trim()}
            style={mergedStyle}
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
