import { useState } from 'react';
import Illustration from '../../../../shared/illustrations';

/**
 * App Studio runtime — tiny shared visual primitives for the 19 components.
 * Everything uses platform tokens for text/surfaces and --app-* vars for
 * accent/radius/spacing, per the runtime theming contract (see themeVars.js).
 */

export const EM_DASH = '—';

/** Shimmering placeholder block shown while a bound action is running. */
export function Skeleton({ className = '', style }) {
    return <div className={`app-skeleton ${className}`} style={style} aria-hidden="true" data-app-skeleton="true" />;
}

/** A stack of skeleton lines (data components while loading). */
export function SkeletonLines({ lines = 3 }) {
    return (
        <div className="flex flex-col gap-2" data-app-loading="true">
            {Array.from({ length: lines }, (_, i) => (
                <Skeleton key={i} className="h-4" style={{ width: `${100 - i * 18}%` }} />
            ))}
        </div>
    );
}

/** Muted empty-state line (a component's emptyText prop). */
/**
 * The empty state of a bound component.
 *
 * `h-full` + centring matters more than it sounds: inside a pane the component
 * usually has height 'fill', so an unstyled div pinned the message to the top
 * left of a tall empty box and the screen read as broken rather than as empty.
 * With no height around it (a grid cell) h-full is inert and this looks exactly
 * as it did.
 */
export function EmptyText({ text, icon: Icon = null, title = null, art = null }) {
    // The one-line form is UNCHANGED (every existing caller passes only `text`).
    // With an icon, a title or a scene it becomes a composed empty state — the
    // shape the rest of the product uses (shared/EmptyState) — so a component
    // that has nothing to show still looks designed rather than unfinished.
    if (!Icon && !title && !art) {
        return (
            <div
                className="flex h-full min-h-0 items-center justify-center text-sm py-1 text-center"
                style={{ color: 'var(--text-muted)' }}
            >
                {text || 'Nothing to show yet.'}
            </div>
        );
    }
    return (
        <div className="flex h-full min-h-0 flex-col items-center justify-center gap-1.5 py-6 text-center">
            {art ? (
                <span className="mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    <Illustration name={art} />
                </span>
            ) : Icon ? (
                <span
                    className="inline-flex h-9 w-9 items-center justify-center"
                    style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)', borderRadius: 'var(--app-radius)' }}
                    aria-hidden="true"
                >
                    <Icon className="w-4 h-4" />
                </span>
            ) : null}
            {title ? (
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</span>
            ) : null}
            <span className="text-sm max-w-xs" style={{ color: 'var(--text-muted)' }}>
                {text || 'Nothing to show yet.'}
            </span>
        </div>
    );
}

/** Label + control + inline error frame shared by all input components. */
export function Field({ id, label, required, error, children }) {
    return (
        <div className="flex flex-col gap-1 text-left">
            {label ? (
                <label htmlFor={id} className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {label}
                    {required ? <span aria-hidden="true" style={{ color: 'var(--error)' }}> *</span> : null}
                </label>
            ) : null}
            {children}
            {error ? (
                <p id={id ? `${id}-error` : undefined} className="text-xs" role="alert" style={{ color: 'var(--error)' }}>{error}</p>
            ) : null}
        </div>
    );
}

/*
 * A 1px border-colour change bound to :focus was the whole focus indicator, in
 * a colour the APP AUTHOR picks — so on a pale primary it could be well under
 * the 3:1 SC 1.4.11 asks, and it fired on mouse clicks too. The outline is a
 * real ring, on :focus-visible, in a token that contrasts by construction.
 */
const FOCUS_OUTLINE = 'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--text-secondary)]';

export const INPUT_CLASS = `w-full border px-2.5 py-1.5 text-sm ${FOCUS_OUTLINE}`;

export function inputStyle(error) {
    return {
        background: 'var(--bg-primary)',
        borderColor: error ? 'var(--error)' : 'var(--border-default)',
        color: 'var(--text-primary)',
        borderRadius: 'var(--app-radius)',
    };
}

// Fields worth showing INSTEAD of an object, in preference order.
const OBJECT_LABEL_KEYS = ['name', 'title', 'label', 'value'];

/**
 * Summarise an array/object/Date. A binding that points at a dataset or
 * records result (rather than at a field on one) resolves to one of these, and
 * raw JSON is never a useful thing to paint at an end user. Nothing here
 * recurses into a nested container — a cyclic value must not hang a render.
 */
function summarize(value) {
    if (Array.isArray(value)) {
        if (value.length === 0) return EM_DASH;
        if (value.length > 1) return `${value.length.toLocaleString()} items`;
        const only = value[0];
        return only == null || typeof only !== 'object' ? displayValue(only) : '1 item';
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? EM_DASH : value.toLocaleDateString();
    for (const key of OBJECT_LABEL_KEYS) {
        const inner = value[key];
        if (inner != null && inner !== '' && typeof inner !== 'object') return displayValue(inner);
    }
    const count = Object.keys(value).length;
    return count ? `${count.toLocaleString()} fields` : EM_DASH;
}

/** Format a leaf value for display; null/undefined render as an em-dash. */
export function displayValue(value) {
    if (value == null || value === '') return EM_DASH;
    if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : EM_DASH;
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return summarize(value);
    return String(value);
}

/**
 * Keep the last resolved value on screen while a binding REFETCHES.
 *
 * Changing a filter swaps the data cache key, so every component bound to it
 * goes back to `isLoading` until the new rows land — which blanks the whole
 * screen between responses. Wrapping resolveBinding in this hook shows the
 * previous rows during that window; the loading state only survives until the
 * component has something of its own to show.
 */
export function useStickyBinding({ value, isLoading, error = null, errorCode = null }) {
    // Derived state, adjusted during render rather than in an effect: an effect
    // would land a frame late, which is exactly the frame that blanks.
    const [last, setLast] = useState(undefined);
    if (!isLoading) {
        if (last !== value) setLast(value);
        return { value, isLoading: false, error, errorCode };
    }
    if (last === undefined) return { value: undefined, isLoading: true, error, errorCode };
    return { value: last, isLoading: false, error, errorCode };
}

/**
 * A bound component whose fetch FAILED.
 *
 * Every data component read `{ value, isLoading }` and dropped `error`, so a
 * failed query rendered the ordinary empty state: "Nothing here yet." A viewer
 * whose connector is not linked, or whose request 500s, was told their mailbox
 * was empty. This says what happened, and — when the fix is theirs to make —
 * what to do about it.
 */
export function ErrorText({ error, errorCode = null, onRetry = null }) {
    const needsConnection = errorCode === 'connection_required';
    return (
        <div
            className="flex h-full min-h-0 flex-col items-center justify-center gap-1.5 py-4 text-center"
            role="alert"
            data-app-error="true"
        >
            <span className="text-sm" style={{ color: 'var(--error)' }}>
                {needsConnection ? 'This needs a connection first.' : 'This could not be loaded.'}
            </span>
            {error ? (
                <span className="text-xs max-w-xs" style={{ color: 'var(--text-muted)' }}>{String(error)}</span>
            ) : null}
            {onRetry && !needsConnection ? (
                <button
                    type="button"
                    onClick={onRetry}
                    className={`mt-1 px-2.5 py-1 text-xs border ${FOCUS_OUTLINE}`}
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-primary)', borderRadius: 'var(--app-radius)' }}
                >
                    Try again
                </button>
            ) : null}
        </div>
    );
}

/**
 * What a bound component should render right now: its data, a skeleton, or the
 * failure. One helper so the fourteen of them cannot disagree about it again.
 * Returns null when there is data to draw.
 */
export function bindingFallback({ error, errorCode, isLoading, value, emptyText, lines = 3, onRetry = null }) {
    if (error) return <ErrorText error={error} errorCode={errorCode} onRetry={onRetry} />;
    if (isLoading) return <SkeletonLines lines={lines} />;
    const empty = value == null || (Array.isArray(value) && value.length === 0);
    if (empty) return <EmptyText text={emptyText} />;
    return null;
}
