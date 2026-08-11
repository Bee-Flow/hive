import { isFill, spaceSteps } from '../styleResolver';

/**
 * App Studio runtime — 'container' (container). Spec: server/appStudio/componentSpecs.js.
 * A chrome-free card: no header, no default surface — the grid CELL carries
 * whatever padding/background/radius knobs the author set (resolveNodeStyle);
 * this component only lays the children out on its own 12-column grid.
 */

export default function AppContainer({ node, children }) {
    const gap = Number.isFinite(node.style?.gap) ? node.style.gap : 3;
    // gridTemplateRows mirrors resolveSectionStyle's fill branch exactly: a grid
    // whose single implicit row is auto-sized leaves its children at content
    // height, so the container would grow while nothing inside it did.
    const fill = isFill(node);
    return (
        <div
            className={`app-grid${fill ? ' app-fill h-full min-h-0' : ''}`}
            data-app-container="true"
            style={{
                gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                gap: spaceSteps(gap),
                ...(fill ? { gridTemplateRows: 'minmax(0, 1fr)' } : null),
            }}
        >
            {children}
        </div>
    );
}
