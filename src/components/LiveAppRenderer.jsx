import React, { useState, useMemo, useEffect } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

/**
 * LiveAppRenderer - Renders HTML/JS code in a sandboxed iframe
 * Used for AI-generated one-pager apps
 */
const LiveAppRenderer = ({ code, language = 'html', title = 'App Preview' }) => {
    const [showCode, setShowCode] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const [showOverlay, setShowOverlay] = useState(false);
    const [showPublishModal, setShowPublishModal] = useState(false);
    const [publishForm, setPublishForm] = useState({ name: '', description: '' });
    const [publishing, setPublishing] = useState(false);
    const [publishSuccess, setPublishSuccess] = useState(false);

    // Close overlay on escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') setShowOverlay(false);
        };
        if (showOverlay) {
            document.addEventListener('keydown', handleEsc);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = '';
        };
    }, [showOverlay]);

    // Generate the full HTML document for the iframe
    const iframeContent = useMemo(() => {
        // If it's already full HTML, use it directly
        if (code.trim().toLowerCase().startsWith('<!doctype') ||
            code.trim().toLowerCase().startsWith('<html')) {
            return code;
        }

        // Wrap JavaScript in HTML
        if (language === 'javascript' || language === 'js') {
            return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 16px;
            background: #1a1a2e;
            color: #eee;
            min-height: 100vh;
        }
        button { 
            padding: 8px 16px; 
            border-radius: 8px; 
            border: none; 
            background: linear-gradient(135deg, #8b5cf6, #6366f1);
            color: white;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }
        button:hover { transform: scale(1.02); }
        input, select { 
            padding: 8px 12px; 
            border-radius: 8px; 
            border: 1px solid #333;
            background: #16162a;
            color: #eee;
            font-size: 14px;
        }
        .container { max-width: 600px; margin: 0 auto; }
    </style>
</head>
<body>
    <div id="app"></div>
    <script>${code}</script>
</body>
</html>`;
        }

        // Wrap HTML snippet in full document
        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a2e;
            color: #eee;
            min-height: 100vh;
        }
    </style>
</head>
<body>
    ${code}
</body>
</html>`;
    }, [code, language]);

    // Use srcDoc instead of a blob: URL — blob: URLs are blocked by the
    // CSP's default-src 'self' fallback (frame-src is not explicitly set).
    // srcDoc inlines HTML directly into the iframe and is exempt from frame-src.

    // Publish app to marketplace
    const handlePublish = async () => {
        if (!publishForm.name.trim()) return;
        setPublishing(true);
        try {
            const res = await authFetch(`${API_BASE}/apps`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: publishForm.name,
                    description: publishForm.description,
                    code: iframeContent
                })
            });
            if (res.ok) {
                setPublishSuccess(true);
                setTimeout(() => {
                    setShowPublishModal(false);
                    setPublishSuccess(false);
                    setPublishForm({ name: '', description: '' });
                }, 1500);
            } else {
                console.error('Failed to publish app');
            }
        } catch (err) {
            console.error('Error publishing app:', err);
        } finally {
            setPublishing(false);
        }
    };

    return (
        <>
            <div
                className="my-2 rounded-xl overflow-hidden"
                style={{
                    background: 'var(--bg-primary)',
                    width: 'calc(100% + 2rem)',
                    marginLeft: '-1rem',
                    marginRight: '-1rem'
                }}
            >
                {/* Content - Always show, no header */}
                <div>
                    {showCode ? (
                        <pre className="p-4 text-xs overflow-auto" style={{ color: 'var(--text-secondary)', background: 'var(--bg-primary)' }}>
                            <code>{code}</code>
                        </pre>
                    ) : (
                        <div className="relative">
                            <iframe
                                srcDoc={iframeContent}
                                className="w-full border-0"
                                style={{ minHeight: '600px', height: 'auto', background: 'white' }}
                                sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                                title={title}
                            />
                            {/* Floating controls */}
                            <div className="absolute top-2 right-2 flex items-center gap-1 p-1 rounded-lg" style={{ background: 'rgba(0,0,0,0.6)' }}>
                                <button
                                    onClick={() => setShowCode(!showCode)}
                                    className="p-1.5 rounded hover:bg-white/20 transition-all"
                                    title={showCode ? "Show preview" : "Show code"}
                                >
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setShowOverlay(true)}
                                    className="p-1.5 rounded hover:bg-white/20 transition-all"
                                    title="Open fullscreen"
                                >
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setShowPublishModal(true)}
                                    className="p-1.5 rounded hover:bg-white/20 transition-all"
                                    title="Publish to Marketplace"
                                >
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Fullscreen Overlay */}
            {showOverlay && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}
                    onClick={(e) => e.target === e.currentTarget && setShowOverlay(false)}
                >
                    <div
                        className="w-full max-w-5xl h-[85vh] rounded-2xl overflow-hidden flex flex-col"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}
                    >
                        {/* Overlay Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</div>
                                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Press ESC or click outside to close</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Toggle Code/Preview in Overlay */}
                                <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                                    <button
                                        onClick={() => setShowCode(false)}
                                        className={`px-4 py-2 text-sm transition-all ${!showCode ? 'font-medium' : ''}`}
                                        style={{
                                            background: !showCode ? 'var(--accent-primary)' : 'transparent',
                                            color: !showCode ? 'white' : 'var(--text-muted)'
                                        }}
                                    >
                                        Preview
                                    </button>
                                    <button
                                        onClick={() => setShowCode(true)}
                                        className={`px-4 py-2 text-sm transition-all ${showCode ? 'font-medium' : ''}`}
                                        style={{
                                            background: showCode ? 'var(--accent-primary)' : 'transparent',
                                            color: showCode ? 'white' : 'var(--text-muted)'
                                        }}
                                    >
                                        Code
                                    </button>
                                </div>
                                {/* Close Button */}
                                <button
                                    onClick={() => setShowOverlay(false)}
                                    className="p-2 rounded-xl hover:bg-white/10 transition-all"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--text-muted)' }}>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Overlay Content */}
                        <div className="flex-1 overflow-hidden">
                            {showCode ? (
                                <pre className="h-full p-6 text-sm overflow-auto" style={{ color: 'var(--text-secondary)', background: 'var(--bg-primary)' }}>
                                    <code>{code}</code>
                                </pre>
                            ) : (
                                <iframe
                                    srcDoc={iframeContent}
                                    className="w-full h-full border-0"
                                    style={{ background: 'white' }}
                                    sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
                                    title={title}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Publish Modal */}
            {showPublishModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)' }}
                    onClick={(e) => e.target === e.currentTarget && setShowPublishModal(false)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl p-6"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}
                    >
                        <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                            Publish to App Marketplace
                        </h3>
                        {publishSuccess ? (
                            <div className="flex items-center gap-3 py-4">
                                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span className="text-green-400 font-medium">Published successfully!</span>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                                            App Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={publishForm.name}
                                            onChange={(e) => setPublishForm({ ...publishForm, name: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border"
                                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            placeholder="My Awesome App"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                                            Description
                                        </label>
                                        <textarea
                                            value={publishForm.description}
                                            onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })}
                                            className="w-full px-4 py-2.5 rounded-xl border resize-none"
                                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' }}
                                            rows={3}
                                            placeholder="Describe what your app does..."
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button
                                        onClick={() => setShowPublishModal(false)}
                                        className="flex-1 py-2.5 rounded-xl font-medium transition-all"
                                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handlePublish}
                                        disabled={!publishForm.name.trim() || publishing}
                                        className="flex-1 py-2.5 rounded-xl font-medium text-white transition-all disabled:opacity-50"
                                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                                    >
                                        {publishing ? 'Publishing...' : 'Publish'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default LiveAppRenderer;
