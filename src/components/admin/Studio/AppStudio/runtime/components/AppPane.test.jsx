import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AppPane from './AppPane';
import { resolveNodeStyle, resolveSectionStyle } from '../styleResolver';

/**
 * The pane + height:'fill' pair is what makes a sidebar/detail split with
 * independent scrolling expressible. These tests pin the CSS contract, because
 * every one of these declarations is load-bearing and none of them is obvious.
 */

function renderPane(props = {}, style = {}) {
    return render(
        <AppPane node={{ id: 'cmp_p', type: 'pane', props, style }}>
            <div data-testid="child">kind</div>
        </AppPane>,
    );
}

describe('AppPane', () => {
    it('stacks vertically by default and clips its own overflow', () => {
        const { container } = renderPane();
        const pane = container.querySelector('[data-app-pane]');
        expect(pane.getAttribute('data-app-pane')).toBe('vertical');
        expect(pane.className).toContain('flex-col');
        expect(pane.className).toContain('overflow-hidden');
    });

    it('lays out horizontally when asked', () => {
        const { container } = renderPane({ direction: 'horizontal' });
        const pane = container.querySelector('[data-app-pane]');
        expect(pane.getAttribute('data-app-pane')).toBe('horizontal');
        expect(pane.className).toContain('flex-row');
    });

    it('scroll:auto gives the pane its own scrollbar', () => {
        const { container } = renderPane({ scroll: 'auto' });
        expect(container.querySelector('[data-app-pane]').className).toContain('overflow-auto');
    });

    it('always carries min-h-0 / min-w-0', () => {
        // Without these a flex child refuses to shrink below its content size,
        // so the pane's scrollbar never appears and the layout overflows the
        // page instead. The single most easily-lost rule here.
        const { container } = renderPane();
        const cls = container.querySelector('[data-app-pane]').className;
        expect(cls).toContain('min-h-0');
        expect(cls).toContain('min-w-0');
    });

    it('renders its children', () => {
        const { getByTestId } = renderPane();
        expect(getByTestId('child')).toBeTruthy();
    });
});

describe("height 'fill'", () => {
    // Longhands, not the `flex` shorthand: jsdom's cssstyle drops the shorthand
    // entirely, so a DOM-level test of it asserts nothing. See FLEX_FILL.
    it('grows instead of taking a fixed pixel height', () => {
        const { style } = resolveNodeStyle({ style: { span: 6, height: 'fill' } });
        expect(style.flexGrow).toBe(1);
        expect(style.flexBasis).toBe(0);
        expect(style.minHeight).toBe(0);
        expect(style.height).toBeUndefined();
    });

    it('a fixed height still scrolls rather than clipping', () => {
        // A hard height that hid its overflow would silently swallow data.
        const { style } = resolveNodeStyle({ style: { span: 6, height: 'md' } });
        expect(style.height).toBe('200px');
        expect(style.overflow).toBe('auto');
        expect(style.flexGrow).toBeUndefined();
    });

    it('auto emits nothing at all', () => {
        const { style } = resolveNodeStyle({ style: { span: 6, height: 'auto' } });
        expect(style.height).toBeUndefined();
        expect(style.overflow).toBeUndefined();
        expect(style.flexGrow).toBeUndefined();
    });
});

describe('resolveSectionStyle', () => {
    it('a plain section is unchanged apart from the new return shape', () => {
        const { className, style } = resolveSectionStyle({ style: { padding: 4, gap: 3 } });
        expect(className).toBe('app-grid');
        expect(style.gridTemplateColumns).toBe('repeat(12, minmax(0, 1fr))');
        expect(style.flexGrow).toBeUndefined();
        expect(style.gridTemplateRows).toBeUndefined();
    });

    it("a fill section becomes a full-height flex row with a stretching grid row", () => {
        const { className, style } = resolveSectionStyle({ style: { height: 'fill' } });
        expect(className).toContain('app-section-fill');
        expect(style.flexGrow).toBe(1);
        expect(style.flexBasis).toBe(0);
        expect(style.minHeight).toBe(0);
        // Without this the grid children keep their content height and nothing
        // actually stretches — the split silently collapses.
        expect(style.gridTemplateRows).toBe('minmax(0, 1fr)');
    });

    it('a fixed-height section scrolls', () => {
        const { style } = resolveSectionStyle({ style: { height: 'sm' } });
        expect(style.height).toBe('120px');
        expect(style.overflow).toBe('auto');
    });
});
