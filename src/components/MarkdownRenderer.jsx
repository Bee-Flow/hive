import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import cpp from 'highlight.js/lib/languages/cpp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import markdown from 'highlight.js/lib/languages/markdown';
import 'highlight.js/styles/github-dark.min.css';
import LiveAppRenderer from './LiveAppRenderer';
import FormRenderer from './FormRenderer';
import PageRenderer from './PageRenderer';
import ResearchRenderer from './ResearchRenderer';
import TestReportRenderer from './TestReportRenderer';
import QuoteRenderer from './QuoteRenderer';
import VegaLiteRenderer from './VegaLiteRenderer';
import MapEmbedRenderer from './MapEmbedRenderer';
import BuildingIndicator from './BuildingIndicator';

// Register languages
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('java', java);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('cs', csharp);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', cpp);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('rb', ruby);
hljs.registerLanguage('php', php);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);

// Code block with language header, copy button, and optional collapsing
const COLLAPSE_HEIGHT = 200; // px
const CollapsibleCodeBlock = ({ className, children, ...props }) => {
    const [expanded, setExpanded] = useState(false);
    const [needsCollapse, setNeedsCollapse] = useState(false);
    const [copied, setCopied] = useState(false);
    const codeRef = useRef(null);
    const measuredRef = useRef(false);

    // Extract language from className
    const langMatch = /language-([\w-]+)/.exec(className || '');
    const language = langMatch ? langMatch[1] : '';

    // Pretty language labels
    const langLabels = {
        python: 'Python', py: 'Python', javascript: 'JavaScript', js: 'JavaScript',
        typescript: 'TypeScript', ts: 'TypeScript', jsx: 'JSX', tsx: 'TSX',
        html: 'HTML', css: 'CSS', json: 'JSON', bash: 'Bash', sh: 'Shell',
        sql: 'SQL', yaml: 'YAML', yml: 'YAML', markdown: 'Markdown', md: 'Markdown',
        java: 'Java', cpp: 'C++', c: 'C', rust: 'Rust', go: 'Go', ruby: 'Ruby',
        php: 'PHP', swift: 'Swift', kotlin: 'Kotlin', r: 'R', lua: 'Lua',
        xml: 'XML', csv: 'CSV', toml: 'TOML', ini: 'INI', dockerfile: 'Dockerfile',
    };
    const displayLang = langLabels[language.toLowerCase()] || (language ? language.charAt(0).toUpperCase() + language.slice(1) : '');

    // Determine if this is a short snippet (1-2 lines, no explicit language)
    const codeText = String(children).replace(/\n$/, '');
    const lineCount = codeText.split('\n').length;
    const isCompact = lineCount <= 2 && !language;

    // Only measure once after initial render to prevent flicker
    useEffect(() => {
        if (!measuredRef.current && codeRef.current && codeRef.current.scrollHeight > COLLAPSE_HEIGHT + 40) {
            setNeedsCollapse(true);
            measuredRef.current = true;
        }
    }, []);

    // Re-measure when content changes significantly (from streaming), but debounced
    useEffect(() => {
        if (measuredRef.current) return;
        const timer = setTimeout(() => {
            if (codeRef.current && codeRef.current.scrollHeight > COLLAPSE_HEIGHT + 40) {
                setNeedsCollapse(true);
                measuredRef.current = true;
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [children]);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(codeText).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    }, [codeText]);

    // Use a local state for highlighting to allow debouncing during streaming
    const [highlightedHtml, setHighlightedHtml] = useState(null);
    const lastHighlightText = useRef('');

    useEffect(() => {
        // Skip highlighting if text hasn't changed
        if (codeText === lastHighlightText.current) return;

        // If it's a very short snippet or we are in a high-frequency update state,
        // we might want to delay the expensive highlighting.
        const debounceMs = codeText.length > 1000 ? 300 : 150;

        const timer = setTimeout(() => {
            try {
                let html = '';
                if (language && hljs.getLanguage(language)) {
                    html = hljs.highlight(codeText, { language }).value;
                } else {
                    html = hljs.highlightAuto(codeText).value;
                }
                setHighlightedHtml(html);
                lastHighlightText.current = codeText;
            } catch (err) {
                console.error('Highlight error:', err);
                setHighlightedHtml(null);
            }
        }, debounceMs);

        return () => clearTimeout(timer);
    }, [codeText, language]);

    // Compact rendering for small snippets (no header) — keep as simple inline-style
    if (isCompact) {
        return (
            <code
                className="inline-code"
                style={{ display: 'inline' }}
            >
                {codeText}
            </code>
        );
    }

    return (
        <div style={{
            borderRadius: '8px',
            overflow: 'hidden',
            margin: '0.4rem 0',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: '#1e1e2e',
        }}>
            {/* Header bar */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 10px',
                background: 'rgba(255,255,255,0.05)',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                fontSize: '11px', fontWeight: 600,
                color: '#94a3b8',
                userSelect: 'none',
            }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ opacity: 0.6 }}>●</span>
                    {displayLang || 'Code'}
                </span>
                <button
                    onClick={handleCopy}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: copied ? '#10b981' : '#94a3b8',
                        fontSize: '11px', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: '3px',
                        padding: '2px 6px', borderRadius: '4px',
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                    {copied ? (
                        <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Copied
                        </>
                    ) : (
                        <>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                            Copy
                        </>
                    )}
                </button>
            </div>

            {/* Code content */}
            <div style={{ position: 'relative' }}>
                <pre ref={codeRef} className="hljs" style={{
                    maxHeight: needsCollapse && !expanded ? `${COLLAPSE_HEIGHT}px` : 'none',
                    overflow: 'hidden',
                    transition: 'max-height 0.25s ease',
                    margin: 0,
                    padding: '0.6rem 0.75rem',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 0,
                    fontSize: '0.83rem',
                    lineHeight: '1.4',
                    fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
                }}>
                    {highlightedHtml ? (
                        <code className={className} dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                    ) : (
                        <code className={className} {...props}>{children}</code>
                    )}
                </pre>
                {needsCollapse && !expanded && (
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50px',
                        background: 'linear-gradient(transparent, #1e1e2e)',
                        pointerEvents: 'none',
                    }} />
                )}
            </div>
            {needsCollapse && (
                <button onClick={() => setExpanded(e => !e)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        width: '100%', padding: '3px 0',
                        border: 'none', background: 'rgba(255,255,255,0.03)', cursor: 'pointer',
                        fontSize: '11px', fontWeight: 600,
                        color: 'var(--accent-primary)',
                        justifyContent: 'center',
                        borderTop: '1px solid var(--border-subtle)',
                    }}>
                    {expanded ? '▲ Show less' : '▼ Show more'}
                </button>
            )}
        </div>
    );
};

const MarkdownRenderer = ({ content, className = '', onFormSubmit, formId, isFormSubmitted, savedFormData = {}, isLoading = false, ...props }) => {
    // Throttle content updates to prevent flickering during streaming
    const THROTTLE_MS = 150;
    const [renderContent, setRenderContent] = useState(content);
    const lastUpdateRef = useRef(Date.now());
    const timerRef = useRef(null);

    useEffect(() => {
        const now = Date.now();
        const elapsed = now - lastUpdateRef.current;

        if (elapsed >= THROTTLE_MS) {
            setRenderContent(content);
            lastUpdateRef.current = now;
        } else {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
                setRenderContent(content);
                lastUpdateRef.current = Date.now();
            }, THROTTLE_MS - elapsed);
        }

        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [content]);

    // Handle null/undefined/non-string content
    if (!renderContent) return null;

    // Ensure content is a string - handle multimodal format or objects
    let textContent = renderContent;
    if (typeof renderContent !== 'string') {
        if (Array.isArray(renderContent)) {
            // Multimodal array format - extract text
            const textBlock = renderContent.find(b => b.type === 'text');
            textContent = textBlock?.text || '';
        } else if (typeof renderContent === 'object') {
            // Object format - try to stringify or extract text
            textContent = renderContent.text || JSON.stringify(renderContent);
        } else {
            textContent = String(renderContent);
        }
    }

    if (!textContent) return null;

    // Detect unclosed code blocks for specific languages and extract partial code
    const detectUnclosedCodeBlock = (text) => {
        // Guard: ensure text is a string
        if (typeof text !== 'string') return null;

        const appLanguages = ['html-app', 'js-app', 'app', 'html-live', 'javascript-app'];

        for (const lang of appLanguages) {
            const openPattern = new RegExp('```' + lang + '\\s*\\n', 'g');
            const matches = text.match(openPattern);
            if (matches) {
                // Count opening tags
                const openCount = matches.length;
                // Count closing tags after the opening
                const lastOpenIndex = text.lastIndexOf('```' + lang);
                const afterOpen = text.slice(lastOpenIndex + lang.length + 3);
                const closeMatches = afterOpen.match(/```/g);
                const closeCount = closeMatches ? closeMatches.length : 0;

                if (openCount > closeCount) {
                    // Extract the partial code (everything after the opening tag)
                    const codeStart = lastOpenIndex + lang.length + 4; // +4 for "```" + newline
                    const partialCode = text.slice(codeStart);
                    return { language: lang, partialCode };
                }
            }
        }
        return null;
    };

    // Detect and strip wrapping code blocks (to handle streaming/partial content)
    const stripWrappingCodeBlock = (text) => {
        if (typeof text !== 'string') return text;

        let cleaned = text;

        // 1. Remove opening fence (greedy, handles partial stream)
        // Match start of string, with optional leading whitespace
        const startMatch = cleaned.match(/^\s*```(?:markdown|md|text)?\n/i);
        if (startMatch) {
            cleaned = cleaned.substring(startMatch[0].length);
        }

        // 2. Remove closing fence (if present at end)
        // Match newline + ``` + optional trailing whitespace
        const endMatch = cleaned.match(/\n```\s*$/);
        if (endMatch) {
            cleaned = cleaned.substring(0, endMatch.index);
        }

        return cleaned;
    };

    const cleanContent = stripWrappingCodeBlock(textContent);

    const unclosedBlock = detectUnclosedCodeBlock(cleanContent);

    return (
        <div className={`markdown-content ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    // Code blocks with syntax highlighting style
                    code({ node, inline, className, children, ...props }) {
                        // Match language tag including hyphens (e.g., json-form, html-app)
                        const match = /language-([\w-]+)/.exec(className || '');
                        const language = match ? match[1] : '';
                        const codeString = String(children).replace(/\n$/, '');

                        // Workspace blocks are no longer rendered inline — workspace content
                        // is handled via workspace_write tool calls and the WorkspacePanel.
                        const isWorkspace = language === 'workspace' ||
                            language === 'workspace-selection' ||
                            (className || '').includes('language-workspace') ||
                            (className || '').includes('language-workspace-selection');

                        if (!inline && isWorkspace) {
                            return null; // Hidden — workspace tool handles display
                        }

                        // Check if this is a form code block
                        const isForm = language === 'json-form' ||
                            language === 'form' ||
                            language === 'form-json';

                        if (!inline && isForm) {
                            // Check if form JSON is valid/complete
                            try {
                                JSON.parse(codeString);
                                return (
                                    <FormRenderer
                                        code={codeString}
                                        title="Form"
                                        onSubmit={onFormSubmit}
                                        initialSubmitted={isFormSubmitted}
                                        initialFormData={savedFormData}
                                    />
                                );
                            } catch {
                                // Form JSON is incomplete - show loading indicator
                                return (
                                    <div className="my-2 flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Creating form...</span>
                                    </div>
                                );
                            }
                        }

                        // Check if this is a page code block
                        const isPage = language === 'json-page' ||
                            language === 'page' ||
                            language === 'page-json';

                        if (!inline && isPage) {
                            // Check if page JSON is valid/complete
                            try {
                                JSON.parse(codeString);
                                return (
                                    <div style={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        overflow: 'hidden',
                                        whiteSpace: 'normal', // Override parent <pre> whitespace
                                        fontFamily: 'var(--font-family, sans-serif)' // Reset font from monospace
                                    }}>
                                        <PageRenderer
                                            code={codeString}
                                            onAction={(action) => console.log('Page action:', action)}
                                        />
                                    </div>
                                );
                            } catch {
                                // Page JSON is incomplete - show loading indicator
                                return (
                                    <div className="my-2 flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Creating page...</span>
                                    </div>
                                );
                            }
                        }

                        // Check if this is a research code block
                        const isResearch = language === 'json-research' ||
                            language === 'research' ||
                            language === 'research-json';

                        if (!inline && isResearch) {
                            try {
                                const researchData = JSON.parse(codeString);
                                return (
                                    <div style={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        overflow: 'hidden',
                                        whiteSpace: 'normal',
                                        fontFamily: 'var(--font-family, sans-serif)'
                                    }}>
                                        <ResearchRenderer data={researchData} />
                                    </div>
                                );
                            } catch {
                                return (
                                    <div className="my-2 flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Building research report...</span>
                                    </div>
                                );
                            }
                        }

                        // Check if this is a test report code block
                        const isTestReport = language === 'json-test-report' ||
                            language === 'test-report' ||
                            language === 'test-report-json';

                        if (!inline && isTestReport) {
                            try {
                                const testData = JSON.parse(codeString);
                                return (
                                    <div style={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        overflow: 'hidden',
                                        whiteSpace: 'normal',
                                        fontFamily: 'var(--font-family, sans-serif)'
                                    }}>
                                        <TestReportRenderer data={testData} />
                                    </div>
                                );
                            } catch {
                                return (
                                    <div className="my-2 flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Building test report...</span>
                                    </div>
                                );
                            }
                        }

                        // Check if this is a quote/offerte code block
                        const isQuote = language === 'quote' ||
                            language === 'offerte' ||
                            language === 'json-quote' ||
                            language === 'json-offerte';

                        if (!inline && isQuote) {
                            try {
                                const quoteData = JSON.parse(codeString);
                                return (
                                    <QuoteRenderer
                                        data={quoteData}
                                        onClose={() => { }}
                                    />
                                );
                            } catch {
                                // Quote JSON is incomplete - show loading indicator
                                return (
                                    <div className="my-2 flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Creating quote...</span>
                                    </div>
                                );
                            }
                        }

                        // Check if this is a Vega-Lite chart code block
                        const isVegaLite = language === 'vega-lite' ||
                            language === 'vegalite' ||
                            language === 'vega';

                        if (!inline && isVegaLite) {
                            // While still streaming, always show loading — don't attempt partial renders
                            if (isLoading) {
                                return (
                                    <div className="my-2 flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Rendering chart...</span>
                                    </div>
                                );
                            }
                            try {
                                JSON.parse(codeString);
                                return (
                                    <div style={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        overflow: 'visible',
                                        whiteSpace: 'normal',
                                        fontFamily: 'var(--font-family, sans-serif)'
                                    }}>
                                        <VegaLiteRenderer spec={codeString} />
                                    </div>
                                );
                            } catch {
                                // Vega-Lite JSON is incomplete - show loading
                                return (
                                    <div className="my-2 flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Rendering chart...</span>
                                    </div>
                                );
                            }
                        }

                        // Check if this is a map embed code block
                        const isMapEmbed = language === 'map-embed' ||
                            language === 'map' ||
                            language === 'maps';

                        if (!inline && isMapEmbed) {
                            if (isLoading) {
                                return (
                                    <div className="my-2 flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading map...</span>
                                    </div>
                                );
                            }
                            try {
                                const mapData = JSON.parse(codeString);
                                return (
                                    <div style={{
                                        width: '100%',
                                        maxWidth: '100%',
                                        overflow: 'hidden',
                                        whiteSpace: 'normal',
                                        fontFamily: 'var(--font-family, sans-serif)'
                                    }}>
                                        <MapEmbedRenderer
                                            embedUrl={mapData.embedUrl}
                                            title={mapData.title || 'Map'}
                                            mapsLink={mapData.mapsLink}
                                        />
                                    </div>
                                );
                            } catch {
                                return (
                                    <div className="my-2 flex items-center gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
                                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading map...</span>
                                    </div>
                                );
                            }
                        }

                        // Check if this is an app code block (html-app, js-app, app)
                        const isApp = language === 'html-app' ||
                            language === 'js-app' ||
                            language === 'app' ||
                            language === 'html-live' ||
                            language === 'javascript-app';

                        // Check if it's a full HTML document or substantial HTML
                        const looksLikeApp = !inline && (
                            codeString.includes('<!DOCTYPE') ||
                            codeString.includes('<html') ||
                            (codeString.includes('<body') && codeString.includes('<script')) ||
                            (codeString.includes('<style') && codeString.includes('<div'))
                        );

                        if (!inline && (isApp || (language === 'html' && looksLikeApp))) {
                            // Check if HTML looks complete (has closing tags)
                            const isComplete = codeString.includes('</html>') ||
                                codeString.includes('</body>') ||
                                (codeString.includes('</div>') && codeString.trim().endsWith('>'));

                            // If the code block is incomplete, don't render anything here
                            // The loading indicator will be shown at the bottom via unclosedBlock detection
                            if (!isComplete || unclosedBlock) {
                                // Return null - the BuildingIndicator at bottom handles the UX
                                return null;
                            }

                            return (
                                <LiveAppRenderer
                                    code={codeString}
                                    language={language.replace('-app', '').replace('-live', '')}
                                    title={language.includes('app') ? 'Interactive App' : 'HTML Preview'}
                                />
                            );
                        }

                        return inline ? (
                            <code className="inline-code" {...props}>
                                {children}
                            </code>
                        ) : (
                            <CollapsibleCodeBlock className={className} {...props}>
                                {children}
                            </CollapsibleCodeBlock>
                        );
                    },
                    // Links — anchor links scroll within message, external open in new tab
                    a({ node, children, href, ...props }) {
                        if (href && href.startsWith('#')) {
                            return (
                                <a
                                    href={href}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        const fragment = href.slice(1).toLowerCase().replace(/[^a-z0-9]/g, '');
                                        const container = e.currentTarget.closest('.markdown-content');
                                        if (!container) return;

                                        // Try exact ID match first
                                        let target = container.querySelector(`[id="${href.slice(1)}"]`);

                                        // Fuzzy: search all headings and compare normalized text
                                        if (!target) {
                                            const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
                                            for (const h of headings) {
                                                const hText = (h.textContent || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                                if (hText.includes(fragment) || fragment.includes(hText)) {
                                                    target = h;
                                                    break;
                                                }
                                            }
                                        }

                                        if (target) {
                                            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }
                                    }}
                                    {...props}
                                >
                                    {children}
                                </a>
                            );
                        }
                        return (
                            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                                {children}
                            </a>
                        );
                    },
                    // Headings with auto-generated IDs for anchor links (table of contents)
                    ...(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].reduce((acc, tag) => {
                        acc[tag] = ({ node, children, ...hProps }) => {
                            const extractText = (child) => {
                                if (typeof child === 'string') return child;
                                if (child?.props?.children) {
                                    return React.Children.toArray(child.props.children).map(extractText).join('');
                                }
                                return '';
                            };
                            const text = React.Children.toArray(children).map(extractText).join('');
                            const slug = text
                                .toLowerCase()
                                .replace(/[^\p{L}\p{N}\s-]/gu, '')
                                .replace(/\s+/g, '-')
                                .replace(/-+/g, '-')
                                .replace(/^-|-$/g, '');
                            return React.createElement(tag, { id: slug, 'data-heading': text, ...hProps }, children);
                        };
                        return acc;
                    }, {})),
                    // Tables with proper styling
                    table({ node, children, ...props }) {
                        return (
                            <div className="table-wrapper">
                                <table {...props}>{children}</table>
                            </div>
                        );
                    },
                    // Paragraphs - render as div to prevent hydration errors from nested block elements
                    p({ node, children, ...props }) {
                        // Check if children contain block-level elements
                        const hasBlockChild = React.Children.toArray(children).some(child => {
                            if (React.isValidElement(child)) {
                                const type = child.type;
                                // Check for common block elements
                                return type === 'pre' || type === 'div' || type === 'table' ||
                                    type === 'ul' || type === 'ol' || type === 'blockquote' ||
                                    (typeof type === 'function' && child.props?.className?.includes('code-block'));
                            }
                            return false;
                        });

                        // If contains block elements, render as div instead of p
                        if (hasBlockChild) {
                            return <div {...props}>{children}</div>;
                        }
                        return <p {...props}>{children}</p>;
                    },
                    // Allow overriding/extending components
                    ...(props.components || {})
                }}
            >
                {cleanContent}
            </ReactMarkdown>

            {/* Show AI-powered loading indicator when an html-app code block is unclosed */}
            {unclosedBlock && (
                <BuildingIndicator
                    code={unclosedBlock.partialCode}
                    language={unclosedBlock.language}
                />
            )}
        </div>
    );
};

export default React.memo(MarkdownRenderer);
