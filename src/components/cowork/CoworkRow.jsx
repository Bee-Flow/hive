/**
 * One row in the Cowork list.
 *
 * Merges the two rows this feature used to have: the Studio row (status,
 * repeat, next run, agent) and the Work card (a two-line preview of what the
 * thing actually does). The preview is the part people recognise items by —
 * titles are auto-derived from the brief and half of them start the same way.
 */
import { Bot, Clock, Repeat } from 'lucide-react';
import React from 'react';
import { describeMoment, repeatLabel } from './coworkSchedule';
import { relativeTime } from './coworkFormat';
import { coworkStatus } from './coworkStatus';

export default function CoworkRow({ item, selected, onSelect }) {
    const status = coworkStatus(item);
    const StatusIcon = status.icon;

    return (
        <button
            type="button"
            data-testid="cowork-row"
            data-cowork-id={item.id}
            aria-current={selected ? 'true' : undefined}
            onClick={() => onSelect(item.id)}
            className="w-full text-left px-3 py-2.5 rounded-xl border transition-colors hover:border-[var(--border-default)]"
            style={{
                background: selected ? 'var(--bg-tertiary)' : 'transparent',
                borderColor: selected ? 'var(--border-default)' : 'transparent',
            }}
        >
            <div className="flex items-center gap-2 min-w-0">
                <StatusIcon
                    className={`w-3.5 h-3.5 flex-shrink-0 ${status.spin ? 'animate-spin' : ''} ${status.solid}`}
                />
                <span className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {item.title || 'Untitled cowork'}
                </span>
            </div>

            {item.prompt && (
                <p
                    className="mt-1 text-[11.5px] leading-snug line-clamp-2"
                    style={{ color: 'var(--text-secondary)' }}
                >
                    {item.prompt}
                </p>
            )}

            <div
                className="mt-1.5 flex items-center gap-2.5 text-[11px] flex-wrap"
                style={{ color: 'var(--text-tertiary)' }}
            >
                {item.repeatInterval && (
                    <span className="inline-flex items-center gap-1">
                        <Repeat className="w-3 h-3" />{repeatLabel(item.repeatInterval)}
                    </span>
                )}
                {item.isActive && item.nextRunAt && (
                    <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />{describeMoment(item.nextRunAt)}
                    </span>
                )}
                {item.lastRunAt && <span>ran {relativeTime(item.lastRunAt)}</span>}
                {item.agentName && (
                    <span className="inline-flex items-center gap-1">
                        <Bot className="w-3 h-3" />{item.agentName}
                    </span>
                )}
            </div>
        </button>
    );
}
