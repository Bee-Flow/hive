import { useRef, useState } from 'react';
import { useFormField } from '../formContext';
import { resolveBinding, walkPath } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { Field, INPUT_CLASS, inputStyle } from '../uiBits';
import useValueFrom from '../useValueFrom';

/**
 * App Studio runtime — 'input_textarea'. Spec: server/appStudio/componentSpecs.js.
 *
 * SLASH SNIPPETS: bind `snippets` to a table of saved texts and typing "/" opens
 * an inline picker that narrows as you type. A saved-reply table is only worth
 * having if it is reachable WHILE writing — a modal three clicks away is not
 * what anyone means by a shortcut, and the shortcut column was pure decoration
 * until this existed.
 */

/** The `/word` being typed immediately before the caret, if any. */
export function activeToken(text, caret) {
    const upto = String(text ?? '').slice(0, caret);
    const slash = upto.lastIndexOf('/');
    if (slash === -1) return null;
    // Only at a word boundary, so a URL or a date never opens the picker.
    if (slash > 0 && !/\s/.test(upto[slash - 1])) return null;
    const term = upto.slice(slash + 1);
    if (/\s/.test(term)) return null;                 // the token ended
    return { start: slash, term };
}

/** Snippets whose shortcut or title matches the typed term. */
export function matchSnippets(rows, term, { keyField, labelField }) {
    const q = String(term || '').toLowerCase();
    return (Array.isArray(rows) ? rows : [])
        .filter((r) => r && typeof r === 'object')
        .filter((r) => {
            if (!q) return true;
            const key = String(walkPath(r, keyField) ?? '').toLowerCase().replace(/^\//, '');
            const label = String(walkPath(r, labelField) ?? '').toLowerCase();
            return key.startsWith(q) || label.includes(q);
        })
        .slice(0, 8);
}

export default function AppInputTextarea({ node }) {
    const { mode, actionState, dataState, scope } = useRuntime();
    const {
        name, label = 'Message', placeholder = null, required = false, rows = 4,
        snippetKey = 'shortcut', snippetBody = 'body', snippetLabel = 'title',
    } = node.props || {};
    const { value, setValue, error } = useFormField({ name, defaultValue: null, required, label });
    // Lets an AI draft or a canned reply fill this field from outside the form.
    useValueFrom(node, setValue);

    const { value: snippetRows } = resolveBinding(node.props?.snippets, { actionState, dataState, scope });
    const [token, setToken] = useState(null);
    const [active, setActive] = useState(0);
    const ref = useRef(null);

    const isRun = mode === 'run';
    const matches = token ? matchSnippets(snippetRows, token.term, { keyField: snippetKey, labelField: snippetLabel }) : [];
    const open = isRun && Boolean(token) && matches.length > 0;

    const sync = (el) => {
        if (!isRun || !Array.isArray(snippetRows) || !snippetRows.length) return;
        const next = activeToken(el.value, el.selectionStart ?? el.value.length);
        setToken(next);
        setActive(0);
    };

    const insert = (row) => {
        const body = String(walkPath(row, snippetBody) ?? '');
        const text = String(value ?? '');
        const caret = ref.current?.selectionStart ?? text.length;
        // Replace the `/term` itself — leaving it behind would ship the shortcut
        // to the customer.
        const next = text.slice(0, token.start) + body + text.slice(caret);
        setValue(next);
        setToken(null);
        requestAnimationFrame(() => {
            const el = ref.current;
            if (!el) return;
            const pos = token.start + body.length;
            el.focus();
            el.setSelectionRange(pos, pos);
        });
    };

    const onKeyDown = (e) => {
        if (!open) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % matches.length); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + matches.length) % matches.length); }
        else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insert(matches[active]); }
        else if (e.key === 'Escape') { setToken(null); }
    };

    const id = `${node.id}-input`;
    return (
        <Field id={id} label={label} required={required} error={error}>
            <div className="relative">
                <textarea
                    id={id}
                    ref={ref}
                    name={name}
                    rows={Number.isFinite(rows) ? rows : 4}
                    value={value ?? ''}
                    placeholder={placeholder || undefined}
                    aria-required={required || undefined}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    onChange={(e) => { setValue(e.target.value); sync(e.target); }}
                    onKeyDown={onKeyDown}
                    onKeyUp={(e) => sync(e.target)}
                    onClick={(e) => sync(e.target)}
                    onBlur={() => setToken(null)}
                    className={`${INPUT_CLASS} resize-y`}
                    style={inputStyle(error)}
                />
                {open ? (
                    <ul
                        data-app-snippets="true"
                        className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto border shadow-lg"
                        style={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)' }}
                    >
                        {matches.map((row, i) => (
                            <li key={i}>
                                <button
                                    type="button"
                                    // onMouseDown, not onClick: blur fires first
                                    // and would close the list before the click.
                                    onMouseDown={(e) => { e.preventDefault(); insert(row); }}
                                    onMouseEnter={() => setActive(i)}
                                    aria-selected={i === active}
                                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left"
                                    style={i === active ? { background: 'var(--app-primary-soft)' } : undefined}
                                >
                                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                        {String(walkPath(row, snippetLabel) ?? '')}
                                    </span>
                                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                        {String(walkPath(row, snippetKey) ?? '')}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        </Field>
    );
}
