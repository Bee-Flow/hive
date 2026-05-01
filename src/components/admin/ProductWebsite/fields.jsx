import React, { useState } from 'react';
import { API_BASE, authFetch } from '../../../utils/helpers';
import AppIcon from '../../AppIcon';

// Shared input class to match other admin panels.
const inputClass =
    'w-full px-3 py-2 rounded-md text-sm border bg-[var(--bg-tertiary)] ' +
    'border-[var(--border-default)] text-[var(--text-primary)] ' +
    'focus:outline-none focus:border-[var(--accent-primary)] transition-colors';

export function FieldRow({ label, hint, children }) {
    return (
        <div className="flex flex-col gap-1.5 mb-3">
            {label ? (
                <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>
            ) : null}
            {children}
            {hint ? <span className="text-xs text-[var(--text-muted)]">{hint}</span> : null}
        </div>
    );
}

export function TextField({ value, onChange, placeholder, label, hint }) {
    return (
        <FieldRow label={label} hint={hint}>
            <input
                type="text"
                className={inputClass}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
            />
        </FieldRow>
    );
}

export function TextArea({ value, onChange, placeholder, label, hint, rows = 3 }) {
    return (
        <FieldRow label={label} hint={hint}>
            <textarea
                className={inputClass}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
            />
        </FieldRow>
    );
}

export function Toggle({ value, onChange, label }) {
    return (
        <label className="flex items-center justify-between gap-3 mb-3 cursor-pointer">
            <span className="text-sm text-[var(--text-primary)]">{label}</span>
            <span
                onClick={() => onChange(!value)}
                className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-[var(--accent-primary)]' : 'bg-[var(--border-default)]'}`}
            >
                <span
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
                />
            </span>
        </label>
    );
}

export function IconField({ value, onChange, label }) {
    return (
        <FieldRow label={label} hint="Lucide icon name (PascalCase) — e.g. ShieldCheck, Mail, Brain">
            <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-md flex items-center justify-center bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--accent-primary)]">
                    {value ? <AppIcon name={value} className="w-5 h-5" /> : <span className="text-xs text-[var(--text-muted)]">?</span>}
                </div>
                <input
                    type="text"
                    className={inputClass}
                    value={value || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="ShieldCheck"
                />
            </div>
        </FieldRow>
    );
}

export function ImageField({ value, onChange, label }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    const handleFile = async (file) => {
        if (!file) return;
        setUploading(true);
        setError(null);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await authFetch(`${API_BASE}/api/cms/admin/upload`, {
                method: 'POST',
                body: fd,
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Upload failed (${res.status})`);
            }
            const data = await res.json();
            onChange(data.url);
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <FieldRow label={label}>
            <div className="flex items-start gap-3">
                <div className="w-16 h-16 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-default)] overflow-hidden flex items-center justify-center text-xs text-[var(--text-muted)]">
                    {value ? <img src={value} alt="" className="w-full h-full object-contain" /> : '—'}
                </div>
                <div className="flex-1 flex flex-col gap-2">
                    <input
                        type="text"
                        className={inputClass}
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder="https://… or /api/cms/asset/cms/…"
                    />
                    <div className="flex items-center gap-2">
                        <label className="px-3 py-1.5 text-xs rounded-md cursor-pointer bg-[var(--bg-tertiary)] border border-[var(--border-default)] hover:border-[var(--accent-primary)] transition-colors">
                            {uploading ? 'Uploading…' : 'Upload image'}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploading}
                                onChange={(e) => handleFile(e.target.files?.[0])}
                            />
                        </label>
                        {value ? (
                            <button
                                type="button"
                                onClick={() => onChange('')}
                                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                            >
                                Remove
                            </button>
                        ) : null}
                    </div>
                    {error ? <span className="text-xs text-red-400">{error}</span> : null}
                </div>
            </div>
        </FieldRow>
    );
}

/**
 * RepeatableList — generic add/remove/reorder for an array field.
 * `renderItem(item, update)` is responsible for rendering one row's fields.
 */
export function RepeatableList({ items = [], onChange, renderItem, makeNew, label, addLabel = 'Add item' }) {
    const update = (idx, next) => {
        const copy = [...items];
        copy[idx] = next;
        onChange(copy);
    };
    const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
    const move = (idx, dir) => {
        const j = idx + dir;
        if (j < 0 || j >= items.length) return;
        const copy = [...items];
        [copy[idx], copy[j]] = [copy[j], copy[idx]];
        onChange(copy);
    };

    return (
        <div className="mb-3">
            {label ? (
                <div className="text-xs font-medium text-[var(--text-secondary)] mb-2">{label}</div>
            ) : null}
            <div className="flex flex-col gap-3">
                {items.map((item, idx) => (
                    <div
                        key={idx}
                        className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-[var(--text-muted)]">#{idx + 1}</span>
                            <div className="flex items-center gap-1">
                                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                                        className="px-2 py-0.5 text-xs rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30">↑</button>
                                <button type="button" onClick={() => move(idx,  1)} disabled={idx === items.length - 1}
                                        className="px-2 py-0.5 text-xs rounded hover:bg-[var(--bg-tertiary)] disabled:opacity-30">↓</button>
                                <button type="button" onClick={() => remove(idx)}
                                        className="px-2 py-0.5 text-xs rounded text-red-400 hover:bg-red-500/10">Remove</button>
                            </div>
                        </div>
                        {renderItem(item, (next) => update(idx, next), idx)}
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={() => onChange([...items, makeNew ? makeNew() : {}])}
                className="mt-2 px-3 py-1.5 text-xs rounded-md border border-dashed border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] transition-colors"
            >
                + {addLabel}
            </button>
        </div>
    );
}

export const inputCls = inputClass;
