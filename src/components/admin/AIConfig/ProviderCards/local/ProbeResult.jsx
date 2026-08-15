// Result of a "Test connection" probe against a self-hosted runtime.
//
// Reachability alone isn't the useful answer — an admin wants to know what the
// box is actually serving, because that is what will (or won't) appear in the
// tier picker. So a successful probe lists the model ids it found.

import React from 'react';
import { CAT_COLORS } from '../../../../../utils/modelMeta';

const MAX_SHOWN = 12;

const ProbeResult = ({ result }) => {
    if (!result) return null;

    if (!result.ok) {
        return (
            <p className="text-xs mt-2" style={{ color: 'rgb(248,113,113)' }}>
                ✕ {result.error || 'Could not reach that address'}
            </p>
        );
    }

    const extra = result.models.length - MAX_SHOWN;
    return (
        <div className="mt-2">
            <p className="text-xs" style={{ color: 'rgb(74,222,128)' }}>
                ✓ Reachable{result.version ? ` (v${result.version})` : ''} — {result.modelCount} model{result.modelCount !== 1 ? 's' : ''}
                {result.error ? `. ${result.error}` : ''}
            </p>
            {result.models?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {result.models.slice(0, MAX_SHOWN).map(m => (
                        <span
                            key={m.id}
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{ background: CAT_COLORS[m.cat] || 'rgba(107,114,128,0.2)', color: 'var(--text-muted)' }}
                        >
                            {m.id}
                        </span>
                    ))}
                    {extra > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5" style={{ color: 'var(--text-muted)' }}>
                            +{extra} more
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProbeResult;
