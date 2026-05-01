import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Code, Palette, Cpu } from 'lucide-react';

const MonacoEditor = lazy(() =>
    import('@monaco-editor/react')
        .then(m => {
            if (!m.default) throw new Error('Monaco default export missing');
            return { default: m.default };
        })
        .catch(err => {
            console.error('[WebpageEditor] Monaco failed to load:', err);
            return { default: null };
        })
);

const SLOTS = [
    { id: 'html', label: 'index.html', language: 'html', icon: Code },
    { id: 'css', label: 'style.css', language: 'css', icon: Palette },
    { id: 'js', label: 'script.js', language: 'javascript', icon: Cpu },
];

export default function WebpageEditor({
    activeFile, onActiveFileChange,
    html, css, js,
    onChange, sizes,
    theme = 'light',
    onCursorChange,
}) {
    const valuesByFile = { html, css, js };
    const editorRef = useRef(null);
    const [monacoFailed, setMonacoFailed] = useState(false);

    const handleMount = (editor, monaco) => {
        if (!editor) { setMonacoFailed(true); return; }
        editorRef.current = editor;
        try {
            monaco.languages.html.htmlDefaults.setOptions({
                format: { tabSize: 2, insertSpaces: true, wrapLineLength: 120 },
                suggest: { html5: true },
            });
        } catch (_) {}
        try {
            monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
                noSemanticValidation: true,
                noSyntaxValidation: false,
            });
        } catch (_) {}
        if (onCursorChange) {
            editor.onDidChangeCursorPosition(e => {
                onCursorChange({ line: e.position.lineNumber, col: e.position.column });
            });
        }
    };

    return (
        <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--bg-primary)' }}>
            <div className="shrink-0 flex items-center border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                {SLOTS.map(slot => {
                    const isActive = slot.id === activeFile;
                    const size = sizes?.[slot.id] || 0;
                    const Icon = slot.icon;
                    return (
                        <button
                            key={slot.id}
                            onClick={() => onActiveFileChange(slot.id)}
                            className="flex items-center gap-1.5 px-3 py-2 text-[12px] border-r transition-colors"
                            style={{
                                borderColor: 'var(--border-subtle)',
                                color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                background: isActive ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                                fontWeight: isActive ? 600 : 400,
                                borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            }}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{slot.label}</span>
                            {size > 0 && (
                                <span className="ml-1 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                    {size < 1024 ? `${size}B` : `${(size / 1024).toFixed(1)}KB`}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="flex-1 min-h-0">
                {monacoFailed ? (
                    <textarea
                        className="w-full h-full p-3 text-xs font-mono resize-none outline-none"
                        style={{ background: theme === 'dark' ? '#1e1e1e' : '#fff', color: theme === 'dark' ? '#ccc' : '#1e1e1e' }}
                        value={valuesByFile[activeFile] || ''}
                        onChange={(e) => onChange(activeFile, e.target.value)}
                        spellCheck={false}
                    />
                ) : (
                    <Suspense fallback={<div className="p-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>Loading editor…</div>}>
                        <MonacoEditor
                            height="100%"
                            language={SLOTS.find(s => s.id === activeFile)?.language || 'html'}
                            value={valuesByFile[activeFile] || ''}
                            onChange={(v) => onChange(activeFile, v ?? '')}
                            onMount={(editor, monaco) => {
                                if (!editor) { setMonacoFailed(true); return; }
                                handleMount(editor, monaco);
                            }}
                            theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                wordWrap: 'on',
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                tabSize: 2,
                                insertSpaces: true,
                                renderWhitespace: 'selection',
                                formatOnPaste: true,
                                formatOnType: false,
                                quickSuggestions: { other: true, comments: false, strings: false },
                            }}
                        />
                    </Suspense>
                )}
            </div>
        </div>
    );
}
