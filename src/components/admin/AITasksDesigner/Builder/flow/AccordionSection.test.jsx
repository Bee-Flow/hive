import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AccordionSection from './AccordionSection';
import { FormDensityContext, densityForOpen } from './settings/formDensity';
import scopedStorage from '../../../../../utils/scopedStorage';

/**
 * The quick editor's whole promise is "only what you need". That rule lives in
 * one place (formDensity.js) and is enforced here, so a new section can't leak
 * into the quick view by accident — or, worse, hide a validation error.
 */
function renderAt(density, props = {}, onHiddenSection = null) {
    return render(
        <FormDensityContext.Provider value={{ density, onHiddenSection }}>
            <AccordionSection stepType="ai_step" sectionKey="advanced" title="Advanced" {...props}>
                <div>secret setting</div>
            </AccordionSection>
        </FormDensityContext.Provider>,
    );
}

describe('AccordionSection density', () => {
    beforeEach(() => {
        cleanup();
        scopedStorage.setCurrentUser('accordion-test-user');
        try { localStorage.clear(); } catch { /* ignore */ }
    });

    it('renders an advanced section in the full view', () => {
        renderAt('full');
        expect(screen.getByText('Advanced')).toBeTruthy();
    });

    it('leaves it out entirely in the quick view', () => {
        renderAt('quick');
        expect(screen.queryByText('Advanced')).toBeNull();
    });

    it('keeps a primary section in BOTH views', () => {
        const primary = (density) => render(
            <FormDensityContext.Provider value={{ density }}>
                <AccordionSection stepType="ai_step" sectionKey="inputs" title="Inputs"><div /></AccordionSection>
            </FormDensityContext.Provider>,
        );
        primary('quick');
        expect(screen.getByText('Inputs')).toBeTruthy();
        cleanup();
        primary('full');
        expect(screen.getByText('Inputs')).toBeTruthy();
    });

    it('shows an advanced section anyway when it holds a validation error', () => {
        // An error the user cannot reach is worse than a busy panel.
        renderAt('quick', { forceOpen: true });
        expect(screen.getByText('Advanced')).toBeTruthy();
    });

    it('reports what it hid so the host can count it', () => {
        const onHiddenSection = vi.fn();
        renderAt('quick', {}, onHiddenSection);
        expect(onHiddenSection).toHaveBeenCalledWith('advanced');
    });

    it('defaults to the full view when no density context is present', () => {
        render(
            <AccordionSection stepType="ai_step" sectionKey="advanced" title="Advanced"><div /></AccordionSection>,
        );
        expect(screen.getByText('Advanced')).toBeTruthy();
    });
});

describe('densityForOpen', () => {
    it('lets the GESTURE decide, never a remembered preference', () => {
        // A single click asks for nothing → quick. Only an explicit 'full'
        // (the double click) gets the big view. Remembering the last choice
        // made both gestures behave identically after the first expand.
        expect(densityForOpen(undefined)).toBe('quick');
        expect(densityForOpen(null)).toBe('quick');
        expect(densityForOpen('quick')).toBe('quick');
        expect(densityForOpen('full')).toBe('full');
        expect(densityForOpen('nonsense')).toBe('quick');
    });
});
