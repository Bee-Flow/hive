import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import renderInlineMarkdown from '../markdownInline';
import { resolveBinding } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';

/**
 * App Studio runtime — 'markdown'. Spec: server/appStudio/componentSpecs.js.
 *
 * A small BLOCK renderer on top of markdownInline's bold/italic/link subset:
 * headings (#–######), unordered/ordered lists, fenced code blocks and
 * paragraphs. Deliberately NOT the chat MarkdownRenderer (mermaid/katex/
 * highlight are heavyweight and app definitions must not smuggle images or
 * raw HTML) — everything here emits escaped React elements only.
 */

const HEADING_CLS = {
    1: 'text-2xl font-semibold',
    2: 'text-xl font-semibold',
    3: 'text-lg font-semibold',
    4: 'text-base font-semibold',
    5: 'text-sm font-semibold',
    6: 'text-sm font-medium',
};

/** Parse markdown text into a flat list of block tokens. */
export function parseBlocks(text) {
    const lines = String(text ?? '').split(/\r?\n/);
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];

        if (!line.trim()) { i += 1; continue; }

        // fenced code block
        const fence = line.match(/^```(\w*)\s*$/);
        if (fence) {
            const code = [];
            i += 1;
            while (i < lines.length && !/^```\s*$/.test(lines[i])) { code.push(lines[i]); i += 1; }
            i += 1; // skip closing fence (or EOF)
            blocks.push({ kind: 'code', lang: fence[1] || null, code: code.join('\n') });
            continue;
        }

        // heading
        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
            blocks.push({ kind: 'heading', level: heading[1].length, text: heading[2] });
            i += 1;
            continue;
        }

        // unordered list
        if (/^\s*[-*]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
                i += 1;
            }
            blocks.push({ kind: 'ul', items });
            continue;
        }

        // ordered list
        if (/^\s*\d+[.)]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ''));
                i += 1;
            }
            blocks.push({ kind: 'ol', items });
            continue;
        }

        // paragraph — greedy until a blank line or another block start
        const para = [line];
        i += 1;
        while (
            i < lines.length && lines[i].trim()
            && !/^(#{1,6})\s+/.test(lines[i]) && !/^```/.test(lines[i])
            && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])
        ) {
            para.push(lines[i]);
            i += 1;
        }
        blocks.push({ kind: 'p', text: para.join(' ') });
    }
    return blocks;
}

/**
 * A fenced code block with a copy button.
 *
 * Not decoration: a code block is what an app uses to hand a person text meant
 * for somewhere ELSE — an export line, an id, a generated CSV. Without this the
 * only instruction anyone could give was "drag with the mouse from the first
 * line to the last, then Ctrl+C", which is what the quote-intake template
 * actually said. Ctrl+A does not help: it selects the whole page.
 *
 * navigator.clipboard is absent on http origins and in some embeddings, so the
 * button hides itself rather than failing on click.
 */
export function CodeBlock({ code }) {
    const [copied, setCopied] = useState(false);
    const canCopy = typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText;

    useEffect(() => {
        if (!copied) return undefined;
        const t = setTimeout(() => setCopied(false), 1600);
        return () => clearTimeout(t);
    }, [copied]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
        } catch {
            setCopied(false);       // clipboard denied — the text stays selectable
        }
    };

    return (
        <div className="app-code-block relative group">
            <pre
                className="text-xs p-3 overflow-x-auto border"
                style={{
                    background: 'var(--bg-tertiary)',
                    borderColor: 'var(--border-default)',
                    borderRadius: 'var(--app-radius)',
                    color: 'var(--text-primary)',
                }}
            >
                <code>{code}</code>
            </pre>
            {canCopy ? (
                <button
                    type="button"
                    onClick={copy}
                    aria-label={copied ? 'Copied' : 'Copy to clipboard'}
                    className="app-code-copy absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px]"
                    style={{
                        borderColor: 'var(--border-default)',
                        background: 'var(--bg-card)',
                        color: copied ? 'var(--color-success, #047857)' : 'var(--text-secondary)',
                    }}
                >
                    {copied ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            ) : null}
        </div>
    );
}

function Block({ block }) {
    switch (block.kind) {
        case 'heading': {
            const Tag = `h${block.level}`;
            return <Tag className={HEADING_CLS[block.level]}>{renderInlineMarkdown(block.text)}</Tag>;
        }
        case 'ul':
            return (
                <ul className="list-disc pl-5 flex flex-col gap-1">
                    {block.items.map((item, i) => <li key={i}>{renderInlineMarkdown(item)}</li>)}
                </ul>
            );
        case 'ol':
            return (
                <ol className="list-decimal pl-5 flex flex-col gap-1">
                    {block.items.map((item, i) => <li key={i}>{renderInlineMarkdown(item)}</li>)}
                </ol>
            );
        case 'code':
            return <CodeBlock code={block.code} />;
        case 'p':
        default:
            return <p>{renderInlineMarkdown(block.text)}</p>;
    }
}

/**
 * The block renderer for arbitrary markdown TEXT (not a node) — shared with the
 * AI chat component so model output renders through the same escaped, no-raw-HTML
 * subset the markdown component uses.
 */
export function MarkdownBlocks({ text }) {
    const blocks = parseBlocks(text);
    return <>{blocks.map((block, i) => <Block key={i} block={block} />)}</>;
}

export default function AppMarkdown({ node }) {
    const { actionState, dataState, scope } = useRuntime();
    const { content = '' } = node.props || {};
    // `contentFrom` wins when it has text — the same shape as `valueFrom` on the
    // inputs. This is what lets an action's output be DISPLAYED: before it, every
    // text component took a fixed string, so an AI summary had nowhere to go.
    const { value: bound } = resolveBinding(node.props?.contentFrom, { actionState, dataState, scope });
    const text = (typeof bound === 'string' && bound.trim()) ? bound : content;
    return (
        <div className="flex flex-col gap-2 text-sm" data-app-markdown="true">
            <MarkdownBlocks text={text} />
        </div>
    );
}
