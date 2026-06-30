import React, { useMemo, useState } from 'react';
import SuggestionCard from './SuggestionCard';
import SegmentedControl from '../../../shared/SegmentedControl';

/**
 * SuggestionsSection — renders the suggestion grid, splitting results into
 * "From your activity" (observed, suggestion.groundedIn === 'activity') vs
 * "Ideas" (everything else). When BOTH groups are present a SegmentedControl
 * lets the user filter; otherwise we just render the single group as a plain
 * grid (no chrome).
 *
 * Grounding is feature-detected: before the backend tags suggestions, every
 * card lands in "Ideas" and the filter never appears, so behaviour is
 * unchanged.
 *
 * Dismissed/built state is passed down per-card so they grey out in place.
 */
export default function SuggestionsSection({
    suggestions = [],
    onBuildDirectly,
    onAskForChanges,
    onDismiss,
    dismissed,       // Set of ids
    builtIds,        // Set of ids
}) {
    const isActivity = (s) => s && s.groundedIn === 'activity';

    const { activity, ideas } = useMemo(() => {
        const a = [];
        const b = [];
        for (const s of suggestions) (isActivity(s) ? a : b).push(s);
        return { activity: a, ideas: b };
    }, [suggestions]);

    const hasBoth = activity.length > 0 && ideas.length > 0;
    const [filter, setFilter] = useState('all'); // 'all' | 'activity' | 'ideas'

    const visible = useMemo(() => {
        if (!hasBoth || filter === 'all') return suggestions;
        return filter === 'activity' ? activity : ideas;
    }, [hasBoth, filter, suggestions, activity, ideas]);

    if (!suggestions.length) return null;

    return (
        <div>
            {hasBoth && (
                <div className="flex justify-center mb-3">
                    <SegmentedControl
                        size="sm"
                        ariaLabel="Filter suggestions"
                        value={filter}
                        onChange={setFilter}
                        options={[
                            { value: 'all', label: 'All' },
                            { value: 'activity', label: `From your activity (${activity.length})` },
                            { value: 'ideas', label: `Ideas (${ideas.length})` },
                        ]}
                    />
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {visible.map((s) => (
                    <SuggestionCard
                        key={s.id}
                        suggestion={s}
                        onBuildDirectly={onBuildDirectly}
                        onAskForChanges={onAskForChanges}
                        onDismiss={onDismiss}
                        dismissed={dismissed?.has?.(s.id)}
                        built={builtIds?.has?.(s.id)}
                        muted={dismissed?.has?.(s.id) || builtIds?.has?.(s.id)}
                    />
                ))}
            </div>
        </div>
    );
}
