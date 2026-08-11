import { Bold, Eye, Italic, Link2, List, Pencil } from 'lucide-react';
import { useRef, useState } from 'react';
import { useFormField } from '../formContext';
import { renderInlineMarkdown } from '../markdownInline';
import { Field } from '../uiBits';
import useValueFrom from '../useValueFrom';

/**
 * App Studio runtime — 'input_richtext'. Spec: server/appStudio/componentSpecs.js.
 *
 * A lightweight, self-contained markdown editor: a formatting toolbar that
 * wraps the current textarea selection in markdown tokens, plus a live preview
 * toggle (reusing the runtime's markdown-subset renderer). It SUBMITS MARKDOWN
 * (the spec's value type), stays deterministic in tests, and pulls in no heavy
 * editor engine — so the whole AppStudio tree keeps rendering offline.
 */

export default function AppInputRichtext({ node }) {
    const { name, label = 'Content', required = false, defaultValue = null } = node.props || {};
    const { value, setValue, error } = useFormField({ name, defaultValue: defaultValue ?? '', required, label });
    useValueFrom(node, setValue);
    const [preview, setPreview] = useState(false);
    const areaRef = useRef(null);
    const id = `${node.id}-input`;
    const text = value ?? '';

    /** Wrap (or line-prefix) the current selection with markdown tokens. */
    const surround = (before, after = before, linePrefix = false) => {
        const el = areaRef.current;
        if (!el) return;
        const start = el.selectionStart ?? text.length;
        const end = el.selectionEnd ?? text.length;
        const selected = text.slice(start, end);
        let next;
        let caret;
        if (linePrefix) {
            const body = selected || 'List item';
            const prefixed = body.split('\n').map((line) => `${before}${line}`).join('\n');
            next = text.slice(0, start) + prefixed + text.slice(end);
            caret = start + prefixed.length;
        } else {
            const body = selected || 'text';
            next = text.slice(0, start) + before + body + after + text.slice(end);
            caret = start + before.length + body.length + after.length;
        }
        setValue(next);
        requestAnimationFrame(() => {
            if (areaRef.current) {
                areaRef.current.focus();
                areaRef.current.setSelectionRange(caret, caret);
            }
        });
    };

    // In preview the textarea is unmounted, so `surround` bailed at `if (!el)`
    // and Bold/Italic/Link/List were silent no-ops — clicked, nothing happened,
    // no message, no switch back. A disabled button says what an inert one
    // could not.
    const btn = (key, Icon, onClick, title) => (
        <button
            key={key}
            type="button"
            title={preview ? `${title} — leave preview to edit` : title}
            aria-label={title}
            onClick={onClick}
            disabled={preview}
            className="inline-flex items-center justify-center w-7 h-7 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: 'var(--text-secondary)', borderRadius: 'var(--app-radius)' }}
        >
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
    );

    return (
        <Field id={id} label={label} required={required} error={error}>
            <div
                className="flex flex-col border overflow-hidden"
                style={{ borderColor: error ? 'var(--error)' : 'var(--border-default)', borderRadius: 'var(--app-radius)', background: 'var(--bg-primary)' }}
            >
                <div
                    className="flex items-center gap-0.5 px-1.5 py-1 border-b"
                    style={{ borderColor: 'var(--border-default)', background: 'var(--bg-tertiary)' }}
                    role="toolbar"
                    aria-label="Formatting"
                >
                    {btn('bold', Bold, () => surround('**'), 'Bold')}
                    {btn('italic', Italic, () => surround('*'), 'Italic')}
                    {btn('link', Link2, () => surround('[', '](https://)'), 'Link')}
                    {btn('list', List, () => surround('- ', '', true), 'Bullet list')}
                    <button
                        type="button"
                        onClick={() => setPreview((p) => !p)}
                        aria-pressed={preview}
                        title={preview ? 'Edit' : 'Preview'}
                        className="ml-auto inline-flex items-center gap-1 px-2 h-7 text-xs"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        {preview ? <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> : <Eye className="w-3.5 h-3.5" aria-hidden="true" />}
                        {preview ? 'Edit' : 'Preview'}
                    </button>
                </div>
                {preview ? (
                    <div
                        className="px-2.5 py-2 text-sm min-h-[6rem] whitespace-pre-wrap"
                        style={{ color: 'var(--text-primary)' }}
                        data-app-richtext-preview="true"
                    >
                        {text.trim() ? renderInlineMarkdown(text) : <span style={{ color: 'var(--text-muted)' }}>Nothing to preview.</span>}
                    </div>
                ) : (
                    <textarea
                        ref={areaRef}
                        id={id}
                        name={name}
                        rows={5}
                        value={text}
                        aria-required={required || undefined}
                        aria-invalid={error ? true : undefined}
                        aria-describedby={error ? `${id}-error` : undefined}
                        onChange={(e) => setValue(e.target.value)}
                        className="w-full px-2.5 py-2 text-sm outline-none resize-y bg-transparent"
                        style={{ color: 'var(--text-primary)' }}
                        placeholder="Write in **markdown**…"
                    />
                )}
            </div>
        </Field>
    );
}
