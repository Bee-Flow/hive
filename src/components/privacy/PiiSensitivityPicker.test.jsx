import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PiiSensitivityPicker, { presetFor, PII_SENSITIVITY_PRESETS } from './PiiSensitivityPicker';

/**
 * The picker translates the raw confidence threshold into three named levels.
 * What is pinned here:
 *   * the preset VALUES are load-bearing — 0.70 is the calibration anchor the
 *     guard's per-category floors are tuned at; changing a preset silently
 *     changes detection quality for everyone who clicks it;
 *   * a stored value near a preset snaps to it visually (slider steps of 0.05
 *     and float noise must not read as "custom");
 *   * a genuinely custom value is SHOWN as custom with the advanced control
 *     open — never silently misrepresented as a preset.
 */

describe('presetFor', () => {
    it('anchors the three levels at the calibrated values, displayed low → high', () => {
        // Display order low→high (left to right); the underlying threshold
        // runs the opposite way — that inversion is the whole reason the
        // cards replaced the raw slider.
        expect(PII_SENSITIVITY_PRESETS.map(p => p.value)).toEqual([0.85, 0.70, 0.45]);
        expect(PII_SENSITIVITY_PRESETS.map(p => p.id)).toEqual(['strict', 'balanced', 'high']);
    });

    it('snaps float noise and undefined to the nearest preset', () => {
        expect(presetFor(0.7)?.id).toBe('balanced');
        expect(presetFor(0.7000001)?.id).toBe('balanced');
        expect(presetFor(undefined)?.id).toBe('balanced');
        expect(presetFor(0.45)?.id).toBe('high');
        expect(presetFor(0.85)?.id).toBe('strict');
    });

    it('reports genuinely custom values as custom, not as a preset', () => {
        expect(presetFor(0.5)).toBeNull();
        expect(presetFor(0.75)).toBeNull();
        expect(presetFor(0.1)).toBeNull();
    });
});

describe('PiiSensitivityPicker', () => {
    it('selecting a level stores that level\'s exact threshold', () => {
        const onChange = vi.fn();
        render(<PiiSensitivityPicker value={0.7} onChange={onChange} />);
        fireEvent.click(screen.getByText('High sensitivity'));
        expect(onChange).toHaveBeenCalledWith(0.45);
        fireEvent.click(screen.getByText('Low sensitivity'));
        expect(onChange).toHaveBeenCalledWith(0.85);
    });

    it('hides the raw slider by default for preset values', () => {
        render(<PiiSensitivityPicker value={0.7} onChange={() => {}} />);
        expect(document.querySelector('input[type="range"]')).toBeNull();
        fireEvent.click(screen.getByText('Advanced: set an exact percentage'));
        expect(document.querySelector('input[type="range"]')).not.toBeNull();
    });

    it('shows a custom value honestly: badge + advanced control open', () => {
        render(<PiiSensitivityPicker value={0.5} onChange={() => {}} />);
        expect(screen.getByText(/Custom · 50%/)).toBeTruthy();
        // The only control that explains a custom state must be visible.
        expect(document.querySelector('input[type="range"]')).not.toBeNull();
    });

    it('the advanced slider still drives the same float', () => {
        const onChange = vi.fn();
        render(<PiiSensitivityPicker value={0.5} onChange={onChange} />);
        fireEvent.change(document.querySelector('input[type="range"]'), { target: { value: '0.65' } });
        expect(onChange).toHaveBeenCalledWith(0.65);
    });

    it('choosing a level auto-hides the advanced fold', () => {
        // Opened because the stored value is custom…
        render(<PiiSensitivityPicker value={0.5} onChange={() => {}} />);
        expect(document.querySelector('input[type="range"]')).not.toBeNull();
        // …but picking a named level answers the question — the raw slider
        // must not linger under a preset selection.
        fireEvent.click(screen.getByText('High sensitivity'));
        expect(document.querySelector('input[type="range"]')).toBeNull();
    });

    it('disables the level buttons in read-only contexts', () => {
        const onChange = vi.fn();
        render(<PiiSensitivityPicker value={0.7} onChange={onChange} disabled />);
        fireEvent.click(screen.getByText('High sensitivity'));
        expect(onChange).not.toHaveBeenCalled();
    });
});
