/**
 * Layout decisions that live in the markup, not the stylesheet.
 *
 * Both are invisible in a unit test's rendered output but decide what the
 * page looks like, so they are pinned here rather than left to a screenshot:
 *
 *   - a chapter with no screenshot needs `step-chapter--copy`, which is what
 *     splits its copy into two columns. Without it the chapter falls back to
 *     a single 720px column pinned left and each step eats a whole viewport.
 *   - the integration count is DERIVED. If it ever became stored content an
 *     editor would have to remember to bump a number when adding a tool.
 *
 * Run: cd agent-hub && npx vitest run src/marketing/sections/sectionLayout.test.jsx
 */
import { render } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import Steps from './Steps.jsx';
import Integrations from './Integrations.jsx';

const chapters = (items) => render(
    <Steps data={{ enabled: true, variant: 'chapters', title: 'T', items }} />,
);

// Relative, so jsdom's configured origin is preserved — an absolute URL with
// a different host throws SecurityError. Same helper as MediaText.test.jsx.
function setPreview(on) {
    window.history.replaceState({}, '', on ? '?preview=1' : '?');
}

afterEach(() => setPreview(false));

describe('step chapters', () => {
    it('marks a chapter with no media as copy-only', () => {
        const { container } = chapters([{ title: 'A routine', body: 'b', number: '1' }]);
        const chapter = container.querySelector('.step-chapter');
        expect(chapter.className).toContain('step-chapter--copy');
    });

    it('leaves a chapter that has a screenshot alone', () => {
        const { container } = chapters([
            { title: 'With shot', body: 'b', media: { src: 'cms/x.png' } },
        ]);
        expect(container.querySelector('.step-chapter').className)
            .not.toContain('step-chapter--copy');
        expect(container.querySelector('.step-chapter-media')).toBeTruthy();
    });

    it('treats whitespace-only media as no media', () => {
        const { container } = chapters([{ title: 'A', body: 'b', media: { src: '   ' } }]);
        expect(container.querySelector('.step-chapter').className)
            .toContain('step-chapter--copy');
    });

    it('still alternates the flip class independently', () => {
        const { container } = chapters([
            { title: 'one', body: 'b' },
            { title: 'two', body: 'b' },
        ]);
        const all = [...container.querySelectorAll('.step-chapter')];
        expect(all.every(c => c.className.includes('step-chapter--copy'))).toBe(true);
        expect(all[0].className).not.toContain('--flip');
        expect(all[1].className).toContain('--flip');
    });

    it('renders the example so the accent-ruled block has something to show', () => {
        const { container } = chapters([
            { title: 'A', body: 'b', example: 'Every Monday at 07:30' },
        ]);
        expect(container.querySelector('.step-example').textContent)
            .toContain('Every Monday at 07:30');
    });

    it('drops an empty example on the published site — no blank grey slab', () => {
        const { container } = chapters([{ title: 'A', body: 'b', example: '' }]);
        expect(container.querySelector('.step-example')).toBeNull();
    });

    it('treats a whitespace-only example as empty too', () => {
        const { container } = chapters([{ title: 'A', body: 'b', example: '   ' }]);
        expect(container.querySelector('.step-example')).toBeNull();
    });

    it('applies the same guard to the classic 3-up cards variant', () => {
        const { container } = render(
            <Steps data={{ enabled: true, title: 'T', items: [{ title: 'A', body: 'b', example: '' }] }} />,
        );
        expect(container.querySelector('.step-example')).toBeNull();
    });

    it('keeps the empty-example placeholder in the editor preview', () => {
        // In ?preview=1 the box is the affordance that tells an editor the
        // field exists at all — it must stay clickable there.
        setPreview(true);
        const { container } = chapters([{ title: 'A', body: 'b', example: '' }]);
        expect(container.querySelector('.step-example')).not.toBeNull();
    });
});

describe('integration categories', () => {
    const render1 = (items) => render(
        <Integrations data={{
            enabled: true,
            title: 'What connects today',
            categories: [{ heading: 'Google Workspace', items }],
        }} />,
    );

    it('derives the count from the items actually rendered', () => {
        const { container } = render1([{ label: 'Gmail' }, { label: 'Drive' }, { label: 'Docs' }]);
        expect(container.querySelector('.integration-count').textContent).toBe('3');
        expect(container.querySelectorAll('.integration-item')).toHaveLength(3);
    });

    it('omits the count rather than printing a zero for an empty category', () => {
        const { container } = render1([]);
        expect(container.querySelector('.integration-count')).toBeNull();
        // The heading and its rule still render, so the group is not a hole.
        expect(container.querySelector('.integration-category-head')).toBeTruthy();
    });

    it('keeps the heading inside the head row so the rule can close it', () => {
        const { container } = render1([{ label: 'Gmail' }]);
        const head = container.querySelector('.integration-category-head');
        expect(head.querySelector('h3').textContent).toContain('Google Workspace');
    });
});
