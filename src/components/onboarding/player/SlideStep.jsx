import React from 'react';
import MarkdownRenderer from '../../MarkdownRenderer';
import { useTranslation } from '../../../hooks/useTranslation';

/**
 * SlideStep — a teaching card inside the LessonPlayer. Renders the step's markdown
 * body. Always satisfiable: the player's Next button is enabled for slides.
 */
export default function SlideStep({ step }) {
    const { t } = useTranslation();
    const title = t(step.titleKey, step.titleFallback);
    const body = t(step.bodyMdKey, step.bodyMdFallback);

    return (
        <div>
            <div className="flex items-start gap-3 mb-3">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--accent-primary) 14%, transparent)' }}
                    aria-hidden="true"
                >
                    {step.icon || '💡'}
                </div>
                <h2 className="text-lg font-bold leading-snug pt-1" style={{ color: 'var(--text-primary)' }}>
                    {title}
                </h2>
            </div>
            <div className="text-[14px] leading-relaxed learning-slide-body" style={{ color: 'var(--text-secondary)' }}>
                <MarkdownRenderer content={body} />
            </div>
        </div>
    );
}
