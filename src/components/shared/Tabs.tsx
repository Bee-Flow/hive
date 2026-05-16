import React, { useCallback, useId, useRef } from 'react';

/**
 * Tabs — controlled tab bar. Replaces the hand-rolled tab implementations
 * in SubscriptionsPanel, GuardrailsPanel, IntegrationsAdminPanel, etc.
 *
 *   <Tabs
 *     value={tab}
 *     onChange={setTab}
 *     items={[
 *       { id: 'plans', label: 'Plans' },
 *       { id: 'orgs',  label: 'Organizations' },
 *     ]}
 *   />
 *   {tab === 'plans' && <PlansSection />}
 *
 * Pairs with `hooks/useUrlTab.js` so that a panel using this primitive
 * gets URL-syncable, back-button-aware tabs without extra work — feed
 * the hook's `[value, setValue]` directly into `value` + `onChange`.
 *
 * Keyboard handling matches ARIA Authoring Practices: ArrowLeft/Right
 * move focus and selection; Home/End jump to first/last.
 */

export interface TabItem<TId extends string = string> {
    id: TId;
    label: React.ReactNode;
    /** Optional badge / count to the right of the label. */
    badge?: React.ReactNode;
    /** Optional leading icon. */
    icon?: React.ReactNode;
    disabled?: boolean;
}

export interface TabsProps<TId extends string = string> {
    value: TId;
    onChange: (id: TId) => void;
    items: readonly TabItem<TId>[];
    /** Accessible name describing what the tabset controls. */
    ariaLabel?: string;
    /** Compact vs. roomy density. */
    size?: 'sm' | 'md';
    className?: string;
}

export default function Tabs<TId extends string = string>({
    value,
    onChange,
    items,
    ariaLabel,
    size = 'md',
    className = '',
}: TabsProps<TId>) {
    const baseId = useId();
    const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const handleKeyDown = useCallback((e: React.KeyboardEvent, currentIdx: number) => {
        const enabled = items.map((it, i) => ({ it, i })).filter(({ it }) => !it.disabled);
        if (enabled.length === 0) return;
        const currentEnabledPos = enabled.findIndex(({ i }) => i === currentIdx);
        let nextEnabledPos = currentEnabledPos;
        if (e.key === 'ArrowLeft') nextEnabledPos = (currentEnabledPos - 1 + enabled.length) % enabled.length;
        else if (e.key === 'ArrowRight') nextEnabledPos = (currentEnabledPos + 1) % enabled.length;
        else if (e.key === 'Home') nextEnabledPos = 0;
        else if (e.key === 'End') nextEnabledPos = enabled.length - 1;
        else return;
        e.preventDefault();
        const target = enabled[nextEnabledPos].it;
        onChange(target.id);
        buttonRefs.current[target.id]?.focus();
    }, [items, onChange]);

    const padding = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';

    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className={`flex items-center gap-1 border-b border-[var(--border-subtle)] ${className}`}
        >
            {items.map((item, idx) => {
                const selected = item.id === value;
                const tabId = `${baseId}-tab-${item.id}`;
                const panelId = `${baseId}-panel-${item.id}`;
                return (
                    <button
                        key={item.id}
                        ref={(el) => { buttonRefs.current[item.id] = el; }}
                        id={tabId}
                        role="tab"
                        type="button"
                        aria-selected={selected}
                        aria-controls={panelId}
                        tabIndex={selected ? 0 : -1}
                        disabled={item.disabled}
                        onClick={() => onChange(item.id)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        className={
                            `inline-flex items-center gap-2 rounded-t-md transition-colors ${padding} ` +
                            'disabled:opacity-50 disabled:cursor-not-allowed ' +
                            (selected
                                ? 'text-[var(--text-primary)] border-b-2 border-[var(--accent-primary)] -mb-px'
                                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-white/5')
                        }
                    >
                        {item.icon}
                        <span>{item.label}</span>
                        {item.badge != null && (
                            <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold bg-white/10">
                                {item.badge}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
