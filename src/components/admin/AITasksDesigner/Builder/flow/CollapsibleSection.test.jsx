import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import CollapsibleSection from './CollapsibleSection';

/**
 * One component, two looks. A named section and the "Show N more options"
 * control used to render identical markup with identical classes, so a control
 * was indistinguishable from a heading — a large part of why the settings
 * panel read as one flat list.
 *
 * The contract that matters most is the section header's shape:
 * SettingsForm.accordion.test.jsx locates a section as the single <button>
 * carrying aria-expanded whose trimmed textContent is exactly the title. Badge
 * and meta must therefore stay OUTSIDE that button.
 */
describe('CollapsibleSection', () => {
    beforeEach(cleanup);

    const header = (title) =>
        screen.getAllByRole('button').find(b => b.hasAttribute('aria-expanded') && b.textContent.trim() === title);

    it('infers the variant: a count means a disclosure, a bare title means a section', () => {
        const { unmount } = render(<CollapsibleSection count={2}>body</CollapsibleSection>);
        expect(document.querySelector('[data-variant]').getAttribute('data-variant')).toBe('disclosure');
        unmount();
        render(<CollapsibleSection title="Basics">body</CollapsibleSection>);
        expect(document.querySelector('[data-variant]').getAttribute('data-variant')).toBe('section');
    });

    it('an explicit variant wins over the inference', () => {
        render(<CollapsibleSection variant="section" count={2} title="Basics">body</CollapsibleSection>);
        expect(document.querySelector('[data-variant]').getAttribute('data-variant')).toBe('section');
    });

    it('a section header stays one aria-expanded button whose text is exactly the title', () => {
        render(
            <CollapsibleSection title="Inputs" badge="2 auto" meta={<button type="button" aria-label="About Inputs" />}>
                <div>field</div>
            </CollapsibleSection>,
        );
        const btn = header('Inputs');
        expect(btn).toBeTruthy();
        // The badge and meta render, but not inside the toggle button — they
        // would otherwise pollute its textContent and its accessible name.
        expect(screen.getByText('2 auto')).toBeTruthy();
        expect(btn.textContent.trim()).toBe('Inputs');
        expect(btn.querySelector('[aria-label="About Inputs"]')).toBeNull();
        expect(screen.getByRole('button', { name: 'Inputs' })).toBe(btn);
    });

    it('a section toggles its body and reports state through aria-expanded', () => {
        render(<CollapsibleSection title="Basics" defaultOpen={false}><div>field</div></CollapsibleSection>);
        expect(screen.queryByText('field')).toBeNull();
        expect(header('Basics').getAttribute('aria-expanded')).toBe('false');
        fireEvent.click(header('Basics'));
        expect(screen.getByText('field')).toBeTruthy();
        expect(header('Basics').getAttribute('aria-expanded')).toBe('true');
    });

    it('the disclosure names itself by count and flips to "Fewer options"', () => {
        render(<CollapsibleSection count={1}><div>extra</div></CollapsibleSection>);
        expect(screen.getByText('Show 1 more option')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Show 1 more option/ }));
        expect(screen.getByText('Fewer options')).toBeTruthy();
        expect(screen.getByText('extra')).toBeTruthy();
    });

    it('pluralises the disclosure label', () => {
        render(<CollapsibleSection count={3}>x</CollapsibleSection>);
        expect(screen.getByText('Show 3 more options')).toBeTruthy();
    });

    it('forceOpen reveals the body without the user toggling', () => {
        render(<CollapsibleSection title="Advanced" forceOpen><div>hidden error</div></CollapsibleSection>);
        expect(screen.getByText('hidden error')).toBeTruthy();
    });
});
