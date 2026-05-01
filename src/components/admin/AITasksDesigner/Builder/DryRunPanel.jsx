import React from 'react';
import { Eye } from 'lucide-react';

/**
 * Renders a dry-run preview: per-step "would have called X with Y" plus
 * any synthesised side-effect outputs.
 */
export default function DryRunPanel({ run, steps }) {
    if (!run) return null;
    return (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#92400e', marginBottom: 8 }}>
                <Eye size={16} /> Dry-run preview ({run.status})
            </div>
            {run.summary && <div style={{ fontSize: 13, color: '#78350f', marginBottom: 8 }}>{run.summary}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {steps.map(s => {
                    const wouldCall = s.output && (s.output._dryRun || s.output.wouldNotify);
                    return (
                        <div key={`${s.stepId}-${s.attempts}`} style={{ background: '#fff', border: '1px solid #fde68a', padding: 8, borderRadius: 6, fontSize: 12 }}>
                            <div style={{ fontWeight: 600 }}>{s.stepId} <span style={{ color: '#6b7280', fontWeight: 400 }}>({s.stepType})</span></div>
                            {wouldCall && (
                                <div style={{ color: '#92400e', marginTop: 4 }}>
                                    {s.output.wouldNotify
                                        ? <>Would notify on <strong>{(s.output.wouldNotify.channels || []).join(', ')}</strong>: <em>{s.output.wouldNotify.title}</em></>
                                        : <>Would call <code>{s.output.wouldHaveCalled}</code> with <code>{JSON.stringify(s.output.withArgs)}</code></>}
                                </div>
                            )}
                            {!wouldCall && s.output && (
                                <pre style={{ marginTop: 4, fontSize: 11, overflow: 'auto', maxHeight: 160 }}>{JSON.stringify(s.output, null, 2)}</pre>
                            )}
                            {s.error && <div style={{ color: '#dc2626', marginTop: 4 }}>{s.error}</div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
