import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AppRenderer from './AppRenderer';
import EditorNodeWrapper from '../editor/EditorNodeWrapper';
import { AppEditorProvider } from '../state/AppEditorContext';

/**
 * The height chain, tested as a CHAIN.
 *
 * `height:'fill'` was broken for as long as it has existed: `.app-runtime` got
 * `h-full min-h-0` but stayed `display:block` (there is no CSS rule for that
 * class anywhere), so the max-width wrapper's `flex-1` was inert, it collapsed
 * to content height, and the section inside it rendered at its natural size —
 * a short band at the top of a large monitor with dead space below.
 *
 * Unit tests over resolveNodeStyle/resolveSectionStyle could not have caught
 * that: every individual declaration was correct. The bug lived in the
 * composition. So this file walks the real rendered ancestry and asserts the
 * INVARIANT rather than class strings — an ancestor either has a definite
 * height of its own, or is a flex container whose child is told to grow.
 */

const FILL_SECTION = {
    id: 'sec_fill',
    style: { padding: 0, gap: 0, background: 'none', height: 'fill' },
    children: [],
};

// A fill pane holding a fill list: the shape of every inbox sidebar, and the
// one that exposes the editor/run divergence — EditorNodeWrapper's extra div
// sits between the grid cell and the component, below the section.
const FILL_SPLIT = {
    id: 'sec_split',
    style: { padding: 0, gap: 0, background: 'none', height: 'fill' },
    children: [{
        id: 'cmp_pane',
        type: 'pane',
        props: { direction: 'vertical', scroll: 'auto' },
        style: { span: 12, gap: 0, padding: 0, height: 'fill' },
        children: [{
            id: 'cmp_list',
            type: 'list',
            props: { source: { kind: 'static', value: [{ id: 'a', title: 'One' }] }, titleKey: 'title' },
            style: { span: 12, height: 'fill' },
        }],
    }],
};

const PLAIN_SECTION = {
    id: 'sec_plain',
    style: { padding: 4, gap: 3, background: 'none' },
    children: [],
};

function definitionWith(section, screen = {}) {
    return {
        schemaVersion: 2,
        meta: { name: 'T' },
        theme: {},
        homeScreenId: 'scr_1',
        screens: [{
            id: 'scr_1', name: 'One', showInNav: true, maxWidth: 'full', sections: [section], ...screen,
        }],
        actions: {},
    };
}

/**
 * Can this element resolve to a definite height? Three legitimate ways, and the
 * chain only works if EVERY link uses one of them:
 *   - h-full          → 100% of its parent (which the walk checks in turn)
 *   - flex-1 / grow=1 → a flex item taking the leftover space
 *   - a stretched row → a grid item in a grid whose single row is minmax(0,1fr)
 *
 * flexGrow is read as a LONGHAND: jsdom drops the `flex` shorthand entirely, so
 * asserting on `style.flex` here would silently pass on anything.
 */
function heightDefinite(el) {
    const cls = el.className || '';
    if (/\bh-full\b/.test(cls)) return true;
    if (/\bflex-1\b/.test(cls) || el.style?.flexGrow === '1') return true;
    const parentCls = el.parentElement?.className || '';
    return /\bapp-section-fill\b/.test(parentCls) || /\bapp-fill\b/.test(parentCls);
}

/**
 * Walk from `el` up to (and including) `stopAt`. Returns the first link that
 * cannot carry height, so a failure names the offending element rather than
 * just saying false.
 */
function firstBrokenLink(el, stopAt) {
    let node = el;
    while (node) {
        if (!heightDefinite(node)) return `${node.tagName.toLowerCase()}.${node.className}`;
        if (node === stopAt) return null;
        node = node.parentElement;
    }
    return 'reached the document without hitting the stop element';
}

describe('full-height screens', () => {
    it('carries height from .app-runtime down to a fill section', () => {
        // This is the test that fails on the pre-fix code.
        const { container } = render(
            <AppRenderer definition={definitionWith(FILL_SECTION)} screenId="scr_1" mode="run" />,
        );
        const runtime = container.querySelector('.app-runtime');
        const section = container.querySelector('[data-section-id="sec_fill"]');
        expect(runtime).toBeTruthy();
        expect(section).toBeTruthy();
        expect(firstBrokenLink(section, runtime)).toBe(null);
    });

    it('leaves a screen without a fill section exactly as it was', () => {
        // The whole safety story for already-installed apps is this one gate:
        // NO layout classes appear on a plain screen. `app-screen-enter` is the
        // one deliberate addition (App Design v2) — an opacity/translate fade
        // that costs no layout and lasts 0ms under reduced motion.
        const { container } = render(
            <AppRenderer definition={definitionWith(PLAIN_SECTION)} screenId="scr_1" mode="run" />,
        );
        const runtime = container.querySelector('.app-runtime');
        expect(runtime.className).toBe('app-runtime app-screen-enter w-full');
        expect(runtime.firstElementChild.className).toBe('w-full flex flex-col');
    });

    it('maps maxWidth, falling back to medium for anything unknown', () => {
        const cases = [['full', 'none'], ['wide', '1280px'], ['narrow', '640px'], ['nonsense', '960px']];
        for (const [maxWidth, expected] of cases) {
            const { container } = render(
                <AppRenderer definition={definitionWith(PLAIN_SECTION, { maxWidth })} screenId="scr_1" mode="run" />,
            );
            expect(container.querySelector('.app-runtime').firstElementChild.style.maxWidth).toBe(expected);
        }
    });

    it('behaves identically in edit mode — preview == production', () => {
        // EditorNodeWrapper inserts an extra div between the grid cell and the
        // component that run mode does not have. While that div was
        // height-opaque, a fill pane collapsed in the editor but worked in
        // preview — the editor lying about what you are building, in a codebase
        // whose stated premise is "preview == production".
        //
        // Walking from the LIST (not the section) is what makes this test
        // meaningful: the divergent div is below the section, so a chain that
        // stops there would pass either way.
        const definition = definitionWith(FILL_SPLIT);
        const chainFor = (mode, NodeWrapper) => {
            const { container } = render(
                <AppEditorProvider app={{ id: 'app_1', definition }}>
                    <AppRenderer definition={definition} screenId="scr_1" mode={mode} NodeWrapper={NodeWrapper} />
                </AppEditorProvider>,
            );
            const list = container.querySelector('[data-app-list]');
            expect(list, `${mode}: list should render`).toBeTruthy();
            return firstBrokenLink(list, container.querySelector('.app-runtime'));
        };

        expect(chainFor('run', undefined)).toBe(null);
        expect(chainFor('edit', EditorNodeWrapper)).toBe(null);
    });
});
