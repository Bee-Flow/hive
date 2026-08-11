import { spaceSteps } from '../styleResolver';

/**
 * App Studio runtime — 'tab' (container). Spec: server/appStudio/componentSpecs.js.
 * A single tab panel: renders its children on the tab's own 12-column grid.
 * The tab strip + active-tab selection live in the parent AppTabs.
 */

export default function AppTab({ node, children }) {
    const gap = Number.isFinite(node.style?.gap) ? node.style.gap : 3;
    const padding = Number.isFinite(node.style?.padding) ? node.style.padding : 0;
    return (
        <div
            className="app-grid"
            style={{
                gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
                gap: spaceSteps(gap),
                padding: padding > 0 ? spaceSteps(padding) : undefined,
            }}
        >
            {children}
        </div>
    );
}
