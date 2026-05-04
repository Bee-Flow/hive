import React, { useEffect, useRef, useState } from 'react';
import { X, Check, Copy } from 'lucide-react';
import { ToggleRow } from './_primitives';

// Copy-to-clipboard field for the embed URL / iframe snippet. Only used
// inside this picker, so co-located here rather than in _primitives.
function CopyField({ value, t }) {
    const [copied, setCopied] = useState(false);
    const onCopy = async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch (_) { /* ignore */ }
    };
    return (
        <div className="flex gap-2">
            <input
                readOnly
                value={value}
                onFocus={(e) => e.target.select()}
                className="flex-1 min-w-0 text-xs font-mono px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-secondary)] outline-none"
            />
            <button
                type="button"
                onClick={onCopy}
                className="px-3 py-2 text-xs rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition flex items-center gap-1.5"
                title={t('agent_wizard.embed.copy') || 'Copy'}
            >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? (t('agent_wizard.embed.copied') || 'Copied') : (t('agent_wizard.embed.copy') || 'Copy')}
            </button>
        </div>
    );
}

export default function BehaviorPicker({
    t, agent, onClose,
    allowCopy, onToggleAllowCopy,
    disableExternalTools, onToggleDisableExternalTools,
    embedEnabled, onToggleEmbedEnabled,
    bubbleColor, onBubbleColor,
    bubblePosition, onBubblePosition,
    bubbleIcon, onBubbleIcon,
    memoryEnabled, onToggleMemory,
    useGeneralMemory, onToggleUseGeneralMemory,
}) {
    const popoverRef = useRef(null);
    useEffect(() => {
        const onDoc = (e) => {
            if (popoverRef.current?.contains(e.target)) return;
            if (e.target.closest?.('[data-popover-trigger="behavior"]')) return;
            onClose();
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [onClose]);

    const publicUrl = agent?.id ? `${window.location.origin}/chat/${agent.id}` : '';
    const iframeSnippet = agent?.id
        ? `<iframe src="${publicUrl}" width="400" height="600" style="border:none;border-radius:12px;"></iframe>`
        : '';
    const ICONS = ['💬', '🐝', '🤖', '❓', '👋', '✨'];

    return (
        <div
            ref={popoverRef}
            className="absolute z-30 top-full left-0 mt-2 w-[460px] max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--bg-card,#fff)] shadow-xl"
        >
            <div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--text-primary)]">{t('agent_wizard.section.behavior') || 'Behavior'}</span>
                <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X size={14} /></button>
            </div>
            <div className="p-4 space-y-4">
                <ToggleRow
                    label={t('agent_wizard.builder.memory') || 'Memory'}
                    help={t('agent_wizard.builder.memory_explainer')}
                    checked={memoryEnabled}
                    onChange={() => onToggleMemory()}
                />
                {memoryEnabled && (
                    <div className="pl-7 -mt-1">
                        <ToggleRow
                            label={t('agent_wizard.builder.memory_use_general_label')}
                            help={t('agent_wizard.builder.memory_use_general_help')}
                            checked={useGeneralMemory}
                            onChange={() => onToggleUseGeneralMemory()}
                        />
                    </div>
                )}
                <div className="border-t border-[var(--border-default)] -mx-4" />
                <ToggleRow
                    label={t('agent_wizard.behavior.allow_copy_label')}
                    help={t('agent_wizard.behavior.allow_copy_help')}
                    checked={allowCopy}
                    onChange={() => onToggleAllowCopy()}
                />
                <ToggleRow
                    label={t('agent_wizard.behavior.disable_external_label')}
                    help={t('agent_wizard.behavior.disable_external_help')}
                    checked={disableExternalTools}
                    onChange={() => onToggleDisableExternalTools()}
                />
                <ToggleRow
                    label={t('agent_wizard.behavior.embed_label')}
                    help={t('agent_wizard.behavior.embed_help')}
                    checked={embedEnabled}
                    onChange={() => onToggleEmbedEnabled()}
                />
                {embedEnabled && (
                    <div className="space-y-3 border-t border-[var(--border-default)] -mx-4 px-4 pt-4">
                        {agent?.id ? (
                            <>
                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                        {t('agent_wizard.embed.public_url') || 'Public URL'}
                                    </div>
                                    <CopyField value={publicUrl} t={t} />
                                </div>
                                <div>
                                    <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                        {t('agent_wizard.embed.iframe') || 'Iframe snippet'}
                                    </div>
                                    <CopyField value={iframeSnippet} t={t} />
                                </div>
                            </>
                        ) : (
                            <div className="text-xs text-[var(--text-tertiary)] italic">
                                {t('agent_wizard.embed.save_first') || 'Save the agent first to get the embed URL.'}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                    {t('agent_wizard.embed.bubble_color') || 'Bubble color'}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={bubbleColor}
                                        onChange={(e) => onBubbleColor(e.target.value)}
                                        className="w-8 h-8 rounded-lg border-0 cursor-pointer p-0"
                                    />
                                    <input
                                        type="text"
                                        value={bubbleColor}
                                        onChange={(e) => onBubbleColor(e.target.value)}
                                        className="flex-1 min-w-0 text-xs font-mono px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] outline-none text-[var(--text-secondary)]"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                    {t('agent_wizard.embed.position') || 'Position'}
                                </div>
                                <div className="flex gap-1">
                                    {['left', 'right'].map(pos => (
                                        <button
                                            key={pos}
                                            type="button"
                                            onClick={() => onBubblePosition(pos)}
                                            className={`flex-1 px-2 py-1.5 text-xs rounded-lg transition ${bubblePosition === pos
                                                ? 'bg-[var(--accent)]/10 text-[var(--accent)] font-medium'
                                                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                                        >
                                            {pos === 'left' ? '◀ Left' : 'Right ▶'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] mb-1.5">
                                {t('agent_wizard.embed.icon') || 'Icon'}
                            </div>
                            <div className="flex gap-1">
                                {ICONS.map(icon => (
                                    <button
                                        key={icon}
                                        type="button"
                                        onClick={() => onBubbleIcon(icon)}
                                        className={`w-9 h-9 rounded-lg text-base flex items-center justify-center transition ${bubbleIcon === icon
                                            ? 'ring-2 ring-[var(--accent)] bg-[var(--bg-secondary)]'
                                            : 'bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
                                    >
                                        {icon}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
