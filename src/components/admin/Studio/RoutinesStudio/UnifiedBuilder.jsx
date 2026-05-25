import React, { useState } from 'react';
import scopedStorage from '../../../../utils/scopedStorage';

/**
 * Unified Builder shell (§1 scaffolding).
 *
 * Replaces the Quick / AI / Expert mode picker with one canvas that
 * carries two orthogonal toggles:
 *   - Density: 'compact' (linear stepper) vs 'canvas' (full ReactFlow)
 *   - AI assist: on/off side rail mounting the existing BuilderShell chat
 *
 * Phase 2 work migrates the existing RoutineEditor.jsx to mount this
 * component. For now this file establishes the contract + persistence
 * so per-view code (CompactView, CanvasView) can target it.
 *
 * Density + AI-assist preferences persist via scopedStorage so power
 * users keep their layout across sessions.
 */

export default function UnifiedBuilder({ children }) {
    // Phase 2 will accept automation/onBack/user as props and wire the
    // view router (CompactView vs CanvasView) plus the AI side rail.
    // Today the component just hydrates the toggle state from
    // scopedStorage and exposes it via data-* attributes so styling
    // and migration paths can already query the active density.
    const [density] = useState(() => scopedStorage.getItem('routinesDensity') || 'canvas');
    const [aiAssist] = useState(() => scopedStorage.getItem('routinesAiAssist') !== '0');

    return (
        <div className="flex flex-col h-full min-h-0" data-density={density} data-ai-assist={aiAssist ? 'on' : 'off'}>
            {children}
        </div>
    );
}
