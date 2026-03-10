import React, { useState } from 'react';
import { X, Sparkles, Image, Loader2, Download } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

const ASPECT_RATIOS = [
    { label: '1:1', value: '1:1', icon: '⬛' },
    { label: '16:9', value: '16:9', icon: '🖥️' },
    { label: '9:16', value: '9:16', icon: '📱' },
    { label: '4:3', value: '4:3', icon: '🖼️' },
    { label: '3:4', value: '3:4', icon: '📋' },
];

const ImageGenerationModal = ({ isOpen, onClose, onImageGenerated }) => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [result, setResult] = useState(null); // { imageBase64, mimeType, text }

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!prompt.trim() || loading) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await authFetch(`${API_BASE}/ai/chat/generate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt.trim(), aspectRatio }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to generate image');
            }

            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddToChat = () => {
        if (!result) return;
        const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
        onImageGenerated?.({
            name: `generated-${Date.now()}.png`,
            type: result.mimeType || 'image/png',
            size: Math.round(result.imageBase64.length * 0.75),
            content: dataUrl,
            source: 'ai-generated',
        });
        // Reset and close
        setPrompt('');
        setResult(null);
        setError(null);
        onClose();
    };

    const handleDownload = () => {
        if (!result) return;
        const link = document.createElement('a');
        link.href = `data:${result.mimeType};base64,${result.imageBase64}`;
        link.download = `generated-${Date.now()}.png`;
        link.click();
    };

    const handleClose = () => {
        setPrompt('');
        setResult(null);
        setError(null);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={handleClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative w-full max-w-lg mx-4 rounded-2xl border shadow-2xl overflow-hidden"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #4285f4, #ea4335, #fbbc04, #34a853)' }}>
                            <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>AI Image Generation</h3>
                            <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Powered by Google Gemini</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                        style={{ color: 'var(--text-tertiary)' }}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {/* Prompt */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                            Describe the image you want to create
                        </label>
                        <textarea
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="A cute robot painting a sunset on a canvas, digital art style..."
                            rows={3}
                            className="w-full px-3.5 py-2.5 rounded-xl border text-sm resize-none outline-none focus:border-blue-500/50 transition-colors"
                            style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleGenerate();
                                }
                            }}
                            autoFocus
                        />
                    </div>

                    {/* Aspect Ratio */}
                    <div>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                            Aspect Ratio
                        </label>
                        <div className="flex gap-1.5">
                            {ASPECT_RATIOS.map(ar => (
                                <button
                                    key={ar.value}
                                    onClick={() => setAspectRatio(ar.value)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${aspectRatio === ar.value
                                            ? 'ring-1 ring-blue-500/40'
                                            : 'hover:bg-white/5'
                                        }`}
                                    style={{
                                        background: aspectRatio === ar.value ? 'rgba(66, 133, 244, 0.15)' : 'var(--bg-tertiary)',
                                        color: aspectRatio === ar.value ? '#4285f4' : 'var(--text-secondary)',
                                        border: `1px solid ${aspectRatio === ar.value ? 'rgba(66, 133, 244, 0.3)' : 'var(--border-subtle)'}`,
                                    }}
                                >
                                    <span>{ar.icon}</span>
                                    <span>{ar.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="px-3.5 py-2.5 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Generated Image Preview */}
                    {result && (
                        <div className="space-y-3">
                            <div className="relative rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-subtle)' }}>
                                <img
                                    src={`data:${result.mimeType};base64,${result.imageBase64}`}
                                    alt="Generated image"
                                    className="w-full h-auto max-h-[400px] object-contain"
                                    style={{ background: 'var(--bg-tertiary)' }}
                                />
                            </div>
                            {result.text && (
                                <p className="text-xs px-1" style={{ color: 'var(--text-tertiary)' }}>
                                    {result.text}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div className="flex items-center gap-2">
                        {result && (
                            <>
                                <button
                                    onClick={handleDownload}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
                                    style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Download
                                </button>
                                <button
                                    onClick={handleAddToChat}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors"
                                    style={{ background: '#4285f4' }}
                                >
                                    <Image className="w-3.5 h-3.5" />
                                    Add to Chat
                                </button>
                            </>
                        )}
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={!prompt.trim() || loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: loading ? 'rgba(66, 133, 244, 0.5)' : 'linear-gradient(135deg, #4285f4, #34a853)' }}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                {result ? 'Regenerate' : 'Generate'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageGenerationModal;
