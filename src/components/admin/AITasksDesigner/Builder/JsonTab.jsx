import React, { useEffect, useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * Read-only JSON view of the entire automation. Power-user surface — when
 * the user wants to copy the full definition, audit it, or send it to
 * support. Edits happen via the chat builder, the per-step inspector,
 * or the Settings tab — keeping this view read-only avoids ambiguous
 * "which save wins" semantics.
 *
 * Lazy Monaco; falls back to a <pre> when the editor module fails to
 * load (offline, blocking extension).
 */
export default function JsonTab({ automation }) {
    const [Monaco, setMonaco] = useState(null);
    const [monacoFailed, setMonacoFailed] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        let alive = true;
        import('@monaco-editor/react')
            .then(mod => { if (alive) setMonaco(() => mod.default); })
            .catch(() => { if (alive) setMonacoFailed(true); });
        return () => { alive = false; };
    }, []);

    const text = JSON.stringify(automation || {}, null, 2);

    const onCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (_) {
            /* clipboard unsupported — silent */
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
                <div className="text-xs text-[var(--text-tertiary)]">
                    Read-only. Edit via the chat or the per-step inspector.
                </div>
                <button
                    onClick={onCopy}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-[var(--bg-primary)] border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition"
                >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className="flex-1 min-h-0">
                {Monaco && !monacoFailed ? (
                    <Monaco
                        height="100%"
                        defaultLanguage="json"
                        value={text}
                        options={{
                            readOnly: true,
                            minimap: { enabled: false },
                            fontSize: 12,
                            wordWrap: 'on',
                            scrollBeyondLastLine: false,
                            renderLineHighlight: 'gutter',
                            domReadOnly: true,
                        }}
                        theme="vs-dark"
                    />
                ) : (
                    <pre className="h-full overflow-auto bg-[var(--bg-secondary)] text-[var(--text-primary)] font-mono text-xs p-4 whitespace-pre-wrap break-words">
                        {text}
                    </pre>
                )}
            </div>
        </div>
    );
}
