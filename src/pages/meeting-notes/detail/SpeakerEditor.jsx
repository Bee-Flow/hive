import React, { useMemo, useState } from 'react';
import { Loader2, Merge, Undo2 } from 'lucide-react';
import Modal from '../../../components/shared/Modal';
import { SPEAKER_COLORS } from '../../../config/meetingNotesConfig';
import { formatSpeakerLabel, getSpeakerColor } from '../lib/format';

/**
 * Owner-only modal to clean up speaker labels on a transcription:
 *   - Rename a speaker by editing its name inline.
 *   - Merge two speakers into one by picking a target from the "Merge with…"
 *     dropdown; the merged row inherits the longer-speaking name by default
 *     and stays editable.
 *
 * The component keeps two pieces of staged state:
 *   - `nameByOriginal`     — current edited name keyed by the ORIGINAL speaker id
 *   - `mergedInto`         — original id → original id of the merge target
 * On save we collapse those into the route payload { renames, merges }.
 */
export default function SpeakerEditor({ open, onClose, meeting, onSave }) {
    const speakers = useMemo(() => Array.isArray(meeting?.speakers) ? meeting.speakers : [], [meeting]);

    // Original ids → stable; staged edits are keyed by these.
    const [nameByOriginal, setNameByOriginal] = useState(() => Object.fromEntries(speakers.map(s => [s.id, s.id])));
    const [mergedInto, setMergedInto] = useState({}); // sourceId → targetId
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Reset staged state when the modal (re-)opens with new data.
    React.useEffect(() => {
        if (!open) return;
        setNameByOriginal(Object.fromEntries(speakers.map(s => [s.id, s.id])));
        setMergedInto({});
        setError(null);
    }, [open, speakers]);

    /** The current effective target for a source id, following any merge chain. */
    function resolveTarget(id) {
        const seen = new Set();
        let cur = id;
        while (mergedInto[cur] && !seen.has(cur)) {
            seen.add(cur);
            cur = mergedInto[cur];
        }
        return cur;
    }

    // Group originals by their merge target so we can render one row per
    // surviving speaker. Each row carries: the target id, the displayed
    // name, total speakingSeconds (sum of merged), and the original ids
    // that fold into it (so we know what to put in `from`).
    const rows = useMemo(() => {
        const byTarget = new Map();
        for (const s of speakers) {
            const target = resolveTarget(s.id);
            if (!byTarget.has(target)) {
                byTarget.set(target, {
                    targetId: target,
                    name: nameByOriginal[target] ?? target,
                    speakingSeconds: 0,
                    sources: [],
                });
            }
            const row = byTarget.get(target);
            row.speakingSeconds += Number(s.speakingSeconds || 0);
            row.sources.push(s.id);
        }
        // Sort by speaking time (longest first) — matches the legend order.
        return Array.from(byTarget.values()).sort((a, b) => b.speakingSeconds - a.speakingSeconds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [speakers, nameByOriginal, mergedInto]);

    const isDirty = useMemo(() => {
        if (Object.keys(mergedInto).length > 0) return true;
        for (const s of speakers) {
            if ((nameByOriginal[s.id] ?? s.id) !== s.id) return true;
        }
        return false;
    }, [speakers, nameByOriginal, mergedInto]);

    function rename(targetId, newName) {
        setNameByOriginal(prev => ({ ...prev, [targetId]: newName }));
    }

    function mergeInto(sourceTargetId, destTargetId) {
        if (sourceTargetId === destTargetId) return;
        setMergedInto(prev => ({ ...prev, [sourceTargetId]: destTargetId }));
        // Use the longer-speaking name as the default for the merged row.
        const src = rows.find(r => r.targetId === sourceTargetId);
        const dest = rows.find(r => r.targetId === destTargetId);
        if (src && dest && src.speakingSeconds > dest.speakingSeconds) {
            setNameByOriginal(prev => ({ ...prev, [destTargetId]: nameByOriginal[sourceTargetId] ?? sourceTargetId }));
        }
    }

    function undoMerge(sourceTargetId) {
        setMergedInto(prev => {
            const next = { ...prev };
            delete next[sourceTargetId];
            return next;
        });
    }

    async function handleSave() {
        if (!isDirty || saving) return;
        setSaving(true);
        setError(null);

        // Build payload. Merges first (collapse all source originals into
        // their final target original id). Renames second (final name per
        // surviving target).
        const merges = [];
        const renames = {};

        const finalTargetByOriginal = {};
        for (const s of speakers) {
            finalTargetByOriginal[s.id] = resolveTarget(s.id);
        }
        // Group originals by their final target.
        const groups = {};
        for (const [orig, target] of Object.entries(finalTargetByOriginal)) {
            if (!groups[target]) groups[target] = [];
            groups[target].push(orig);
        }

        for (const [target, originals] of Object.entries(groups)) {
            const finalName = (nameByOriginal[target] ?? target).trim() || target;
            const sources = originals.filter(o => o !== target);
            if (sources.length > 0) {
                merges.push({ from: [target, ...sources], into: finalName });
            } else if (finalName !== target) {
                renames[target] = finalName;
            }
            // If `finalName === target` and no merges, no-op for this group.
        }

        try {
            const updated = await onSave({ renames, merges });
            if (updated) onClose?.();
        } catch (e) {
            setError(e?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    }

    const formatSec = (secs) => {
        if (!secs || !Number.isFinite(secs)) return '0:00';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = Math.floor(secs % 60);
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Edit speakers"
            description="Rename a speaker, or merge two speakers into one. Changes apply to the transcript, speaker list and exports."
            size="md"
            footer={
                <div className="flex items-center justify-end gap-2">
                    {error && <span className="text-xs text-rose-500 mr-auto">{error}</span>}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-lg text-sm"
                        style={{ color: 'var(--text-secondary)' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!isDirty || saving}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                        style={{ background: 'var(--accent-primary)' }}
                    >
                        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Save changes
                    </button>
                </div>
            }
        >
            <div className="flex flex-col gap-2">
                {rows.length === 0 && (
                    <div className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
                        No speakers yet.
                    </div>
                )}
                {rows.map((row) => {
                    const color = getSpeakerColor(row.targetId, SPEAKER_COLORS);
                    const otherRows = rows.filter(r => r.targetId !== row.targetId);
                    const merged = row.sources.length > 1;
                    return (
                        <div
                            key={row.targetId}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg border"
                            style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                        >
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                            <input
                                value={row.name}
                                onChange={(e) => rename(row.targetId, e.target.value)}
                                placeholder={formatSpeakerLabel(row.targetId)}
                                className="flex-1 min-w-0 px-2 py-1 rounded text-sm border outline-none"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                            />
                            <span className="text-[11px] tabular-nums whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                                {formatSec(row.speakingSeconds)}
                            </span>
                            {merged ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        // Undo the most recent merge into this target — remove every
                                        // mergedInto entry whose target is this row's id.
                                        const sourcesToUndo = Object.entries(mergedInto)
                                            .filter(([, t]) => resolveTarget(t) === row.targetId)
                                            .map(([s]) => s);
                                        sourcesToUndo.forEach(undoMerge);
                                    }}
                                    title="Undo merge"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border"
                                    style={{ background: 'transparent', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
                                >
                                    <Undo2 className="w-3 h-3" />
                                    Undo
                                </button>
                            ) : (
                                <MergeSelect
                                    others={otherRows}
                                    onPick={(destId) => mergeInto(row.targetId, destId)}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </Modal>
    );
}

function MergeSelect({ others, onPick }) {
    const [open, setOpen] = useState(false);
    const ref = React.useRef(null);

    React.useEffect(() => {
        if (!open) return undefined;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    if (others.length === 0) return null;

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(v => !v)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border"
                style={{ background: 'transparent', borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}
            >
                <Merge className="w-3 h-3" />
                Merge with…
            </button>
            {open && (
                <div
                    className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded-lg shadow-lg border overflow-hidden"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
                >
                    {others.map(o => (
                        <button
                            key={o.targetId}
                            type="button"
                            onClick={() => { onPick(o.targetId); setOpen(false); }}
                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--bg-tertiary)] truncate"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            {o.name || formatSpeakerLabel(o.targetId)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
