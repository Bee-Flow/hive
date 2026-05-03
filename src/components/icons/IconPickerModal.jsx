import React, { useState, useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { Camera, Upload, X, Loader2, Sparkles, Image as ImageIcon, Smile } from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';

export function IconPickerModal({ isOpen, onClose, iconKey, iconLabel, defaultEmoji, currentCustom, onApply, nanoBananaSettings }) {
    const [tab, setTab] = useState('emoji');
    const [prompt, setPrompt] = useState('');
    const [generating, setGenerating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const fileInputRef = useRef(null);

    if (!isOpen) return null;

    const handleEmojiClick = (emojiData) => {
        onApply({ type: 'emoji', value: emojiData.emoji });
    };

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            alert('File too large. Max 2MB.');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('icon', file);

        try {
            const res = await authFetch(`${API_BASE}/api/icons/upload`, {
                method: 'POST',
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                onApply({ type: 'image', value: data.url });
            } else {
                alert('Upload failed');
            }
        } catch (err) {
            console.error('Upload Error:', err);
        }
        setUploading(false);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setGenerating(true);
        try {
            const res = await authFetch(`${API_BASE}/api/icons/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    model: nanoBananaSettings?.image?.model,
                    aspectRatio: '1:1',
                }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.url) onApply({ type: 'image', value: data.url });
                else alert('Generation returned no image.');
            } else {
                const data = await res.json().catch(() => ({}));
                alert(data.error || 'Generation failed. Make sure the Google API key is configured.');
            }
        } catch (err) {
            console.error('Generate Error:', err);
            alert('Generation failed: ' + err.message);
        }
        setGenerating(false);
    };

    const handleClear = () => onApply(null);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl shadow-2xl border overflow-hidden flex flex-col" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <span>Change emoji:</span>
                            {defaultEmoji && <span className="text-xl leading-none" aria-hidden>{defaultEmoji}</span>}
                            <span>{iconLabel || iconKey}</span>
                        </h2>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            Pick an emoji, upload an image, or generate one with AI. Default: {defaultEmoji || iconKey}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                        <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                </div>

                <div className="flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <button onClick={() => setTab('emoji')} className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2`} style={{ borderColor: tab === 'emoji' ? 'var(--accent-primary)' : 'transparent', color: tab === 'emoji' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                        <span className="flex items-center justify-center gap-2"><Smile className="w-4 h-4"/> Emoji</span>
                    </button>
                    <button onClick={() => setTab('image')} className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2`} style={{ borderColor: tab === 'image' ? 'var(--accent-primary)' : 'transparent', color: tab === 'image' ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                        <span className="flex items-center justify-center gap-2"><Upload className="w-4 h-4"/> Upload</span>
                    </button>
                    <button onClick={() => setTab('nano')} className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2`} style={{ borderColor: tab === 'nano' ? '#f59e0b' : 'transparent', color: tab === 'nano' ? '#f59e0b' : 'var(--text-secondary)' }}>
                        <span className="flex items-center justify-center gap-2"><Sparkles className="w-4 h-4"/> AI Gen</span>
                    </button>
                </div>

                <div className="flex-1 p-4 min-h-[350px] flex">
                    {tab === 'emoji' && (
                        <div className="w-full h-full flex items-center justify-center">
                            <EmojiPicker onEmojiClick={handleEmojiClick} width="100%" />
                        </div>
                    )}

                    {tab === 'image' && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4">
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                            <div 
                                onClick={handleUploadClick}
                                className="w-full max-w-xs aspect-square border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                                style={{ borderColor: 'var(--border-subtle)' }}
                            >
                                {uploading ? <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: 'var(--accent-primary)' }} /> : <ImageIcon className="w-8 h-8 mb-3" style={{ color: 'var(--text-muted)' }} />}
                                <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Click to upload</h3>
                                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PNG, JPG, WEBP (Max 2MB)</p>
                            </div>
                        </div>
                    )}

                    {tab === 'nano' && (
                        <div className="flex-1 flex flex-col">
                            <p className="text-sm mb-4 p-3 rounded-lg border flex items-start gap-2" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)', color: 'var(--text-primary)' }}>
                                🍌 <span><strong>Nano Banana:</strong> Describe the icon you want to generate. It will use your configured Nano Banana settings.</span>
                            </p>
                            <textarea
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                placeholder="A minimalist 3D icon of a glowing orb..."
                                className="w-full p-3 rounded-xl border resize-none h-32 text-sm focus:outline-none focus:ring-1"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', outlineColor: '#f59e0b' }}
                            />
                            <div className="mt-auto pt-4 flex justify-end">
                                <button
                                    onClick={handleGenerate}
                                    disabled={generating || !prompt.trim()}
                                    className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-medium shadow-md shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
                                >
                                    {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    Generate Icon
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t flex justify-between items-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}>
                    <button 
                        onClick={handleClear}
                        disabled={!currentCustom}
                        className="text-sm text-red-500 px-4 py-2 rounded-lg font-medium transition-colors hover:bg-red-500 hover:bg-opacity-10 disabled:opacity-50 disabled:hover:bg-transparent"
                    >
                        Reset to Default
                    </button>
                    {currentCustom && (
                        <div className="flex items-center gap-3 text-sm font-medium px-4 py-2 rounded-lg shadow-sm border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Current:</span>
                            {currentCustom.type === 'emoji' ? (
                                <span className="text-xl">{currentCustom.value}</span>
                            ) : (
                                <img src={currentCustom.value} alt="" className="w-6 h-6 object-contain" />
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default IconPickerModal;
