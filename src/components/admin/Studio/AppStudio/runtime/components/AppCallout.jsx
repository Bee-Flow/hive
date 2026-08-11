import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import renderInlineMarkdown from '../markdownInline';

/** App Studio runtime — 'callout'. Spec: server/appStudio/componentSpecs.js. */

// House status hexes (emerald/amber/red/sky family — see shared/statusTokens.ts).
const TONES = {
    info: { color: '#0ea5e9', Icon: Info },
    success: { color: '#10b981', Icon: CheckCircle2 },
    warning: { color: '#f59e0b', Icon: AlertTriangle },
    danger: { color: '#ef4444', Icon: AlertCircle },
};

export default function AppCallout({ node }) {
    const { title = null, text = '', tone = 'info' } = node.props || {};
    const { color, Icon } = TONES[tone] || TONES.info;
    return (
        <div
            className="flex items-start gap-2.5 px-3 py-2.5 text-sm"
            style={{
                background: `${color}1a`, // ~10% alpha tint
                borderLeft: `3px solid ${color}`,
                borderRadius: 'var(--app-radius)',
                color: 'var(--text-primary)',
            }}
        >
            <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color }} aria-hidden="true" />
            <div className="min-w-0">
                {title ? <div className="font-medium">{title}</div> : null}
                <div style={{ color: 'var(--text-secondary)' }}>{renderInlineMarkdown(text)}</div>
            </div>
        </div>
    );
}
