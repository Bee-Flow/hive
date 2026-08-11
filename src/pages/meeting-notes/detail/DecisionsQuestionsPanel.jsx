import { CircleHelp, Clock, Gavel } from 'lucide-react';
import React from 'react';
import useTranslation from '../../../hooks/useTranslation';
// The strict parser (null for junk) — an unreadable model timestamp must lose
// its chip, not seek to 0:00. Same rule as ActionItemsList.
import { toSeconds } from '../lib/timelineMarkers';

/**
 * The two structured artifacts extracted alongside action items: decisions
 * that were made, and the questions raised (open ones badged). Renders
 * nothing at all for older notes that predate the extraction — no empty
 * cards, no upgrade nag; Regenerate backfills them.
 */
export default function DecisionsQuestionsPanel({ decisions = [], questions = [], onSeek }) {
    const { t } = useTranslation();
    if (!decisions.length && !questions.length) return null;

    return (
        <div className="flex flex-col gap-3">
            {decisions.length > 0 && (
                <ArtifactCard
                    icon={<Gavel className="w-4 h-4" />}
                    title={t('meeting_notes.decisions', 'Decisions')}
                    count={decisions.length}
                >
                    {decisions.map((d) => (
                        <ArtifactRow key={d.id} text={d.text} timestamp={d.timestamp} onSeek={onSeek} />
                    ))}
                </ArtifactCard>
            )}
            {questions.length > 0 && (
                <ArtifactCard
                    icon={<CircleHelp className="w-4 h-4" />}
                    title={t('meeting_notes.questions', 'Questions')}
                    // The total, matching the rows below it — unlike action
                    // items these are not a checklist, and a count of only the
                    // open ones read as a miscount next to five listed rows.
                    count={questions.length}
                >
                    {questions.map((q) => (
                        <ArtifactRow key={q.id} text={q.text} timestamp={q.timestamp} onSeek={onSeek}
                            badge={q.open
                                ? { label: t('meeting_notes.question_open', 'open'), tone: 'open' }
                                : { label: t('meeting_notes.question_answered', 'answered'), tone: 'muted' }}
                        />
                    ))}
                </ArtifactCard>
            )}
        </div>
    );
}

function ArtifactCard({ icon, title, count, children }) {
    return (
        <div>
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-2" style={{ color: 'var(--text-primary)' }}>
                {icon}
                {title}
                {count > 0 && (
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                        {count}
                    </span>
                )}
            </h2>
            <ul
                className="divide-y rounded-xl border"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}
            >
                {children}
            </ul>
        </div>
    );
}

function ArtifactRow({ text, timestamp, badge, onSeek }) {
    const seconds = toSeconds(timestamp);
    return (
        <li className="px-3 py-2.5" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-start gap-2">
                <span className="flex-1 min-w-0 text-sm" style={{ color: 'var(--text-primary)' }}>{text}</span>
                {badge && (
                    <span
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                        style={badge.tone === 'open'
                            ? { background: 'color-mix(in srgb, #f59e0b 15%, transparent)', color: '#b45309' }
                            : { background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                    >
                        {badge.label}
                    </span>
                )}
            </div>
            {onSeek && seconds !== null && (
                <button
                    type="button"
                    onClick={() => onSeek(seconds)}
                    className="inline-flex items-center gap-1 mt-1 text-[11px] hover:text-[var(--accent-primary)] transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                >
                    <Clock className="w-3 h-3" />
                    {timestamp}
                </button>
            )}
        </li>
    );
}
