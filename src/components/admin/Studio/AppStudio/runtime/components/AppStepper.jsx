import { Check } from 'lucide-react';
import AppIcon from '../../../../../AppIcon';
import { resolveBinding } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { ROLE_COLORS } from '../styleResolver';
import { Skeleton } from '../uiBits';

/**
 * App Studio runtime — 'stepper'. Spec: server/appStudio/componentSpecs.js.
 *
 * The stages of a process with the current one marked, so a record's position
 * is visible instead of inferred from a dropdown's selected value.
 *
 * A value that matches no step leaves every step "upcoming" rather than
 * guessing — that state is real (a record can hold a status somebody removed
 * from the vocabulary), and pretending it is step 1 would be a lie about where
 * the work stands.
 *
 * Clickable only in run mode with onRowClick wired: the payload is the STEP
 * ({value, label, index}), not a row, so an action can read form.value the same
 * way it reads a select's.
 */

function toneColor(tone) {
    return ROLE_COLORS[tone] || ROLE_COLORS.primary;
}

export default function AppStepper({ node }) {
    const { mode, runAction, actionState, dataState, scope } = useRuntime();
    const {
        steps = [],
        orientation = 'horizontal',
        tone = 'primary',
        showLabels = true,
    } = node.props || {};
    const { value, isLoading } = resolveBinding(node.props?.value, { actionState, dataState, scope });

    if (isLoading) return <Skeleton className="h-8 w-full" />;
    if (!Array.isArray(steps) || steps.length === 0) return null;

    const current = value === null || value === undefined ? '' : String(value);
    const currentIndex = steps.findIndex((s) => String(s?.value) === current);
    const color = toneColor(tone);
    const clickable = mode === 'run' && !!node.onRowClick;
    const vertical = orientation === 'vertical';

    return (
        <div
            className={`app-stepper w-full min-w-0 flex ${vertical ? 'flex-col gap-1' : 'items-start gap-1'}`}
            data-app-stepper="true"
            data-orientation={orientation}
            role="list"
            aria-label="Progress"
        >
            {steps.map((step, i) => {
                // Everything before the current step is done; with no match at
                // all nothing is done, which is the honest rendering.
                const isDone = currentIndex >= 0 && i < currentIndex;
                const isCurrent = currentIndex === i;
                const label = step?.label || step?.value || '';
                const state = isCurrent ? 'current' : isDone ? 'done' : 'upcoming';

                const marker = (
                    <span
                        className="app-stepper-marker inline-flex items-center justify-center shrink-0 rounded-full"
                        data-state={state}
                        style={isDone || isCurrent
                            ? { background: color, color: '#fff', borderColor: color }
                            : { borderColor: 'var(--border-default)', color: 'var(--text-muted)' }}
                        aria-hidden="true"
                    >
                        {isDone
                            ? <Check className="w-3 h-3" />
                            : step?.icon
                                ? <AppIcon name={step.icon} className="w-3 h-3" />
                                : <span className="text-[10px] font-semibold">{i + 1}</span>}
                    </span>
                );

                const text = showLabels ? (
                    <span
                        className="app-stepper-label text-xs font-medium truncate"
                        style={{ color: isCurrent ? color : isDone ? 'var(--text-secondary)' : 'var(--text-muted)' }}
                    >
                        {label}
                    </span>
                ) : null;

                const body = vertical ? (
                    <span className="flex items-center gap-2 min-w-0">{marker}{text}</span>
                ) : (
                    <span className="flex flex-col items-center gap-1 min-w-0">{marker}{text}</span>
                );

                const content = clickable ? (
                    <button
                        type="button"
                        onClick={() => runAction(node.onRowClick, {
                            formValues: { value: step?.value ?? null, label, index: i },
                            item: step,
                            index: i,
                            value: step?.value ?? null,
                        })}
                        className="app-stepper-step min-w-0 rounded-md px-1 py-0.5"
                        aria-current={isCurrent ? 'step' : undefined}
                    >
                        {body}
                    </button>
                ) : (
                    <span className="app-stepper-step min-w-0 px-1 py-0.5" aria-current={isCurrent ? 'step' : undefined}>
                        {body}
                    </span>
                );

                return (
                    <div
                        key={step?.value ?? i}
                        role="listitem"
                        data-state={state}
                        className={vertical ? 'flex flex-col' : 'flex-1 min-w-0 flex items-center gap-1'}
                    >
                        {content}
                        {/* The connector between steps: filled up to the current
                            one so the "how far along" reads without counting. */}
                        {i < steps.length - 1 ? (
                            <span
                                className={`app-stepper-line ${vertical ? 'app-stepper-line--v' : 'flex-1'}`}
                                style={{ background: isDone ? color : 'var(--border-default)' }}
                                aria-hidden="true"
                            />
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}
