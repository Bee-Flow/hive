/**
 * The Work-mode controls that sit in the composer toolbar: when it runs,
 * whether it repeats, and who runs it.
 *
 * Shape borrowed from what works elsewhere — Claude's "Select mode" sheet and
 * ChatGPT Work's chip row — because the useful bit is the same in both: the
 * decision is a couple of taps on a short list of sensible defaults, not a
 * form. Three chips, each opening a single-choice sheet, everything on Bee
 * Flow's own tokens.
 */
import { Clock, Repeat, Bot, Check, ChevronDown } from 'lucide-react';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    WHEN_PRESETS, COWORK_REPEAT_OPTIONS,
    resolveWhen, describeMoment, repeatLabel,
    toDateInput, toTimeInput,
} from './coworkSchedule';

// ── Sheet: a popover on desktop, a bottom sheet on phones ───────────────
function Sheet({ open, onClose, title, subtitle, isMobile, children, anchorClassName = '' }) {
    const ref = useRef(null);
    // Which way the popover opens. Above the chip is right in the chat
    // composer (it sits at the bottom of the screen); on the Cowork page the
    // composer is near the top, where opening upward runs the panel straight
    // off the viewport. Measure once per open and flip when there's no room.
    const [dropDown, setDropDown] = useState(false);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, onClose]);

    useLayoutEffect(() => {
        if (!open || isMobile) { setDropDown(false); return; }
        const el = ref.current;
        if (!el) return;
        // Read where the upward placement actually landed; a clipped top edge
        // is the signal to drop below instead.
        setDropDown(el.getBoundingClientRect().top < 8);
    }, [open, isMobile]);

    if (!open) return null;

    const panel = (
        <div
            ref={ref}
            role="dialog"
            aria-label={title}
            className={isMobile
                ? 'fixed inset-x-0 bottom-0 z-[1100] rounded-t-3xl border-t p-4 pb-6 shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar'
                : `absolute ${dropDown ? 'top-full mt-2' : 'bottom-full mb-2'} z-[1100] w-[280px] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto custom-scrollbar rounded-2xl border p-2 shadow-xl ${anchorClassName}`}
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}
        >
            {isMobile && (
                <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: 'var(--border-default)' }} />
            )}
            <div className={isMobile ? 'text-center mb-3' : 'px-2 pt-1 pb-2'}>
                <div className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</div>
                {subtitle && (
                    <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{subtitle}</div>
                )}
            </div>
            {children}
        </div>
    );

    if (!isMobile) return panel;
    return (
        <>
            <div className="fixed inset-0 z-[1090] bg-black/40" onClick={onClose} />
            {panel}
        </>
    );
}

function SheetOption({ selected, icon: Icon, label, hint, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            role="option"
            aria-selected={selected}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-[var(--bg-secondary)]"
            // Selection is carried by weight + a tinted ground + the check,
            // NOT by recolouring the label to the accent: an org whose accent
            // is a pale grey would render the chosen row FAINTER than the
            // others, which reads as disabled. The accent stays on the check.
            style={selected ? { background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' } : undefined}
        >
            {Icon && (
                <Icon
                    className="w-4 h-4 flex-shrink-0"
                    style={{ color: selected ? 'var(--text-primary)' : 'var(--text-tertiary)' }}
                />
            )}
            <span className="flex-1 min-w-0">
                <span
                    className={`block text-[13px] truncate ${selected ? 'font-semibold' : 'font-medium'}`}
                    style={{ color: 'var(--text-primary)' }}
                >
                    {label}
                </span>
                {hint && (
                    <span className="block text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>{hint}</span>
                )}
            </span>
            {selected && <Check className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-primary)' }} strokeWidth={2.5} />}
        </button>
    );
}

function Chip({ icon: Icon, label, active, onClick, testId }) {
    return (
        <button
            type="button"
            onClick={onClick}
            data-testid={testId}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[11.5px] transition-colors max-w-[190px] ${active ? 'font-semibold' : 'font-medium'}`}
            // Same reasoning as SheetOption: the accent tints the ground and
            // the border, the label stays on --text-primary so a pale org
            // accent can't make a set chip read as the faded one.
            style={{
                borderColor: active ? 'color-mix(in srgb, var(--accent-primary) 45%, transparent)' : 'var(--border-subtle)',
                background: active ? 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' : 'var(--bg-secondary)',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
        >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{label}</span>
            <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
        </button>
    );
}

export default function CoworkOptionsBar({
    when, onWhenChange,          // { presetId, date, time }
    repeatInterval, onRepeatChange,
    agentId, onAgentChange,
    agents = [],
    isMobile = false,
}) {
    const [openSheet, setOpenSheet] = useState(null); // 'when' | 'repeat' | 'agent'
    const close = () => setOpenSheet(null);

    const preset = WHEN_PRESETS.find(p => p.id === when.presetId) || WHEN_PRESETS[0];
    const resolved = resolveWhen(when.presetId, when);
    const whenLabel = when.presetId === 'now'
        ? 'Now'
        : (resolved ? describeMoment(resolved) : 'Pick a moment');
    const selectedAgent = agents.find(a => a.id === agentId) || null;

    const pickPreset = (id) => {
        if (id === 'custom') {
            // Seed the custom inputs from whatever is currently selected so the
            // date/time fields never open empty.
            const seed = resolved || resolveWhen('in_1h');
            onWhenChange({ presetId: 'custom', date: when.date || toDateInput(seed), time: when.time || toTimeInput(seed) });
            return; // keep the sheet open — the inputs live in it
        }
        onWhenChange({ ...when, presetId: id });
        close();
    };

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {/* When */}
            <div className="relative">
                <Chip
                    icon={Clock}
                    label={whenLabel}
                    active={when.presetId !== 'now'}
                    onClick={() => setOpenSheet(openSheet === 'when' ? null : 'when')}
                    testId="cowork-when-chip"
                />
                <Sheet
                    open={openSheet === 'when'}
                    onClose={close}
                    isMobile={isMobile}
                    title="When should this run?"
                    subtitle="Bee Flow delivers the result to your notifications."
                >
                    <div role="listbox" aria-label="When">
                        {WHEN_PRESETS.map(p => (
                            <SheetOption
                                key={p.id}
                                selected={p.id === preset.id}
                                label={p.label}
                                hint={p.hint}
                                onClick={() => pickPreset(p.id)}
                            />
                        ))}
                    </div>
                    {when.presetId === 'custom' && (
                        <div className="grid grid-cols-2 gap-2 px-3 pt-2 pb-1">
                            <input
                                type="date"
                                value={when.date}
                                onChange={e => onWhenChange({ ...when, presetId: 'custom', date: e.target.value })}
                                aria-label="Date"
                                data-testid="cowork-when-date"
                                className="px-2.5 py-2 rounded-lg border bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                                style={{ borderColor: 'var(--border-subtle)' }}
                            />
                            <input
                                type="time"
                                value={when.time}
                                onChange={e => onWhenChange({ ...when, presetId: 'custom', time: e.target.value })}
                                aria-label="Time"
                                data-testid="cowork-when-time"
                                className="px-2.5 py-2 rounded-lg border bg-[var(--bg-card)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                                style={{ borderColor: 'var(--border-subtle)' }}
                            />
                        </div>
                    )}
                </Sheet>
            </div>

            {/* Repeat */}
            <div className="relative">
                <Chip
                    icon={Repeat}
                    label={repeatLabel(repeatInterval)}
                    active={!!repeatInterval}
                    onClick={() => setOpenSheet(openSheet === 'repeat' ? null : 'repeat')}
                    testId="cowork-repeat-chip"
                />
                <Sheet
                    open={openSheet === 'repeat'}
                    onClose={close}
                    isMobile={isMobile}
                    title="How often?"
                    subtitle="Repeating work keeps running until you pause it."
                >
                    <div role="listbox" aria-label="Repeat">
                        {COWORK_REPEAT_OPTIONS.map(o => (
                            <SheetOption
                                key={o.value || 'once'}
                                selected={(repeatInterval || '') === o.value}
                                label={o.label}
                                onClick={() => { onRepeatChange(o.value); close(); }}
                            />
                        ))}
                    </div>
                </Sheet>
            </div>

            {/* Run as agent — only when the account actually has agents to pick */}
            {agents.length > 0 && (
                <div className="relative">
                    <Chip
                        icon={Bot}
                        label={selectedAgent ? selectedAgent.name : 'No agent'}
                        active={!!selectedAgent}
                        onClick={() => setOpenSheet(openSheet === 'agent' ? null : 'agent')}
                        testId="cowork-agent-chip"
                    />
                    <Sheet
                        open={openSheet === 'agent'}
                        onClose={close}
                        isMobile={isMobile}
                        title="Who does the work?"
                        subtitle="An agent brings its own skills, knowledge and connected apps."
                    >
                        <div role="listbox" aria-label="Run as agent" className="max-h-[260px] overflow-y-auto custom-scrollbar">
                            <SheetOption
                                selected={!agentId}
                                label="No agent"
                                hint="Runs as a plain prompt"
                                onClick={() => { onAgentChange(''); close(); }}
                            />
                            {agents.map(a => (
                                <SheetOption
                                    key={a.id}
                                    selected={agentId === a.id}
                                    label={a.name || 'Untitled agent'}
                                    hint={a.description || null}
                                    onClick={() => { onAgentChange(a.id); close(); }}
                                />
                            ))}
                        </div>
                    </Sheet>
                </div>
            )}
        </div>
    );
}
