import React from 'react';
import { X } from 'lucide-react';

/**
 * Right-side detail panel for a step. Shows resolved inputs, last
 * output (from the most recent dry-run), and any error.
 */
export default function StepInspector({ step, runStep, onClose }) {
    if (!step) return null;
    return (
        <div style={{
            position: 'absolute', top: 0, right: 0, height: '100%', width: 360,
            background: '#fff', borderLeft: '1px solid #e5e7eb', overflowY: 'auto',
            boxShadow: '-4px 0 12px rgba(0,0,0,0.06)', zIndex: 5,
        }}>
            <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>{step.type}</div>
                    <div style={{ fontWeight: 600 }}>{step.label || step.tool || step.id}</div>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <X size={18} />
                </button>
            </div>
            <Section title="Definition">
                <Pre value={step} />
            </Section>
            {runStep && (
                <>
                    <Section title={`Last run — ${runStep.status}`}>
                        <Pre value={{ input: runStep.input, output: runStep.output, error: runStep.error }} />
                    </Section>
                </>
            )}
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div style={{ padding: 12, borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
            {children}
        </div>
    );
}
function Pre({ value }) {
    return (
        <pre style={{ background: '#fafafa', padding: 8, borderRadius: 6, fontSize: 12, overflow: 'auto', maxHeight: 320 }}>
            {JSON.stringify(value, null, 2)}
        </pre>
    );
}
