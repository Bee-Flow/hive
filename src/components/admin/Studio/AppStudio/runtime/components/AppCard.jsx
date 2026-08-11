import { isFill, spaceSteps } from '../styleResolver';

/**
 * App Studio runtime — 'card' (container). Spec: server/appStudio/componentSpecs.js.
 * The grid CELL is the card surface (padding/background/radius come from the
 * node's style knobs via resolveNodeStyle); this component only renders the
 * optional header and the children on the card's own 12-column grid.
 */

export default function AppCard({ node, children }) {
    const { title = null, description = null } = node.props || {};
    const gap = Number.isFinite(node.style?.gap) ? node.style.gap : 3;
    // "A card wrapping a data grid" is the dashboard idiom, so a card that
    // swallows fill kills it one level in: the header keeps its size, the grid
    // takes the rest.
    const fill = isFill(node);
    return (
        <div className={`app-card flex flex-col${fill ? ' app-fill h-full min-h-0' : ''}`} style={{ gap: spaceSteps(2) }}>
            {(title || description) ? (
                <div className={fill ? 'shrink-0' : undefined}>
                    {title ? <div className="font-medium">{title}</div> : null}
                    {description ? (
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{description}</div>
                    ) : null}
                </div>
            ) : null}
            <div
                className={`app-grid${fill ? ' flex-1 min-h-0' : ''}`}
                style={{
                    gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                    gap: spaceSteps(gap),
                    ...(fill ? { gridTemplateRows: 'minmax(0, 1fr)' } : null),
                }}
            >
                {children}
            </div>
        </div>
    );
}
