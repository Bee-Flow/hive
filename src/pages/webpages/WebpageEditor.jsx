import React, { Suspense, lazy, useRef, useState } from 'react';

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

const LANGUAGES = { html: 'html', css: 'css', js: 'javascript' };

export default function WebpageEditor({
    activeFile,
    html, css, js,
    onChange,
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
        <div className="flex flex-col h-full min-h-0" style={{ background: 'var(--vsc-editor-bg)' }}>
            <div className="flex-1 min-h-0">
                {monacoFailed ? (
                    <textarea
                        className="w-full h-full p-3 text-xs font-mono resize-none outline-none"
                        style={{ background: 'var(--vsc-editor-bg)', color: 'var(--vsc-fg)' }}
                        value={valuesByFile[activeFile] || ''}
                        onChange={(e) => onChange(activeFile, e.target.value)}
                        spellCheck={false}
                    />
                ) : (
                    <Suspense fallback={<div className="p-4 text-xs" style={{ color: 'var(--vsc-fg-muted)' }}>Loading editor…</div>}>
                        <MonacoEditor
                            height="100%"
                            language={LANGUAGES[activeFile] || 'html'}
                            value={valuesByFile[activeFile] || ''}
                            onChange={(v) => onChange(activeFile, v ?? '')}
                            onMount={(editor, monaco) => {
                                if (!editor) { setMonacoFailed(true); return; }
                                handleMount(editor, monaco);
                            }}
                            theme={theme === 'dark' ? 'vs-dark' : 'vs'}
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
