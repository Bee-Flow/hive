import { spaceSteps } from '../styleResolver';

/**
 * App Studio runtime — 'pane' (container). Spec: server/appStudio/componentSpecs.js.
 *
 * The one escape hatch from the 12-column grid, and the reason a sidebar +
 * detail layout is expressible at all. A pane is a FLEX STACK: children keep
 * their natural size, except a child with style.height 'fill', which absorbs
 * whatever is left. That is what lets a message thread grow while a composer
 * stays pinned underneath it — a grid row vocabulary cannot say that.
 *
 * Deliberate difference from AppContainer: children here are flex items, not
 * grid cells, so `style.span` is IGNORED inside a pane. The spec description
 * says so loudly because it is the one genuinely surprising thing about this
 * component; use a container inside the pane when you need columns.
 *
 * min-h-0 / min-w-0 are load-bearing: without them a flex child refuses to
 * shrink below its content size and the pane's own scrollbar never appears.
 */
export default function AppPane({ node, children }) {
    const { direction = 'vertical', scroll = 'none' } = node.props || {};
    const gap = Number.isFinite(node.style?.gap) ? node.style.gap : 3;
    const horizontal = direction === 'horizontal';

    return (
        <div
            data-app-pane={horizontal ? 'horizontal' : 'vertical'}
            className={[
                'flex min-h-0 min-w-0 h-full',
                horizontal ? 'flex-row' : 'flex-col',
                scroll === 'auto' ? 'overflow-auto' : 'overflow-hidden',
            ].join(' ')}
            style={{ gap: spaceSteps(gap) }}
        >
            {children}
        </div>
    );
}
