import React, { useEffect, useMemo, useRef, useState } from 'react';
import mermaid from 'mermaid';

let mermaidInitialized = false;
function ensureInit() {
    if (mermaidInitialized) return;
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict', flowchart: { htmlLabels: false } });
    mermaidInitialized = true;
}

function escapeLabel(s) {
    return String(s || '').replace(/[\n"]/g, ' ').replace(/[\[\]{}()<>|]/g, ' ').slice(0, 60);
}

function nodeShape(step) {
    const id = step.id;
    const t = step.type;
    const label = escapeLabel(step.label || step.tool || step.type || id);
    if (t === 'trigger') return `${id}([" ${label} "])`;
    if (t === 'condition') return `${id}{{" ${label} "}}`;
    if (t === 'loop') return `${id}[/" ${label} "/]`;
    if (t === 'code') return `${id}[[" ${label} "]]`;
    if (t === 'notification') return `${id}>" ${label} "]`;
    return `${id}[" ${label} "]`;
}

function buildMermaid(def, runStatusByStep) {
    if (!def || !def.trigger) return 'flowchart LR\n  empty["(empty draft)"]';
    const lines = ['flowchart LR'];
    const allSteps = [def.trigger, ...(def.steps || [])];
    for (const s of allSteps) lines.push('  ' + nodeShape(s));
    for (const e of (def.edges || [])) {
        const lbl = e.label ? `|${escapeLabel(e.label)}|` : '';
        lines.push(`  ${e.from} -->${lbl} ${e.to}`);
    }
    // Style by status
    if (runStatusByStep) {
        for (const [stepId, status] of Object.entries(runStatusByStep)) {
            let cls = 'sNeutral';
            if (status === 'success') cls = 'sOk';
            else if (status === 'error') cls = 'sErr';
            else if (status === 'running') cls = 'sRun';
            lines.push(`  class ${stepId} ${cls};`);
        }
    }
    lines.push('  classDef sOk fill:#dcfce7,stroke:#16a34a;');
    lines.push('  classDef sErr fill:#fee2e2,stroke:#dc2626;');
    lines.push('  classDef sRun fill:#fef3c7,stroke:#d97706;');
    lines.push('  classDef sNeutral fill:#f3f4f6,stroke:#9ca3af;');
    return lines.join('\n');
}

export default function DiagramPane({ definition, runSteps = [], onNodeClick }) {
    ensureInit();
    const [svg, setSvg] = useState('');
    const [err, setErr] = useState(null);
    const ref = useRef(null);

    const statusByStep = useMemo(() => {
        const m = {};
        for (const r of runSteps) m[r.stepId] = r.status;
        return m;
    }, [runSteps]);

    const code = useMemo(() => buildMermaid(definition, statusByStep), [definition, statusByStep]);

    useEffect(() => {
        let cancelled = false;
        const id = `diagram-${Math.random().toString(36).slice(2)}`;
        mermaid.render(id, code).then(({ svg }) => {
            if (!cancelled) setSvg(svg);
        }).catch(e => {
            if (!cancelled) setErr(e.message || 'Diagram render failed');
        });
        return () => { cancelled = true; };
    }, [code]);

    // Wire click handlers post-render so the parent can open the inspector.
    useEffect(() => {
        if (!ref.current || !onNodeClick) return;
        const nodes = ref.current.querySelectorAll('.node');
        const handlers = [];
        nodes.forEach(node => {
            const id = node.id?.replace(/^flowchart-/, '').split('-')[0];
            if (!id) return;
            const fn = () => onNodeClick(id);
            node.style.cursor = 'pointer';
            node.addEventListener('click', fn);
            handlers.push([node, fn]);
        });
        return () => handlers.forEach(([n, f]) => n.removeEventListener('click', f));
    }, [svg, onNodeClick]);

    if (err) return <div style={{ color: '#dc2626', padding: 16 }}>{err}</div>;
    return (
        <div ref={ref} style={{ overflow: 'auto', padding: 12 }} dangerouslySetInnerHTML={{ __html: svg }} />
    );
}
