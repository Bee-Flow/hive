import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import SettingsForm from './SettingsForm';
import { VariablePickerProvider } from '../mapping/VariablePickerContext';

// BFSF-345 — the Wait step's duration field.
//
// Two of the three defects were functional, not cosmetic: clamping on every
// keystroke made the field impossible to clear-and-retype, and the unit select
// carried `w-full w-auto` (two utilities racing for one property) which let it
// eat the row and collapse the number input to its spinner.

const noIssues = { errors: [], warnings: [] };

function renderWait(step, { onPatch = vi.fn() } = {}) {
    const utils = render(
        <VariablePickerProvider groups={[]} previewSample={null} stepLabelById={new Map()}>
            <SettingsForm step={step} modelTiers={{}} stepIssues={noIssues} saving={false} saveError={null} onPatch={onPatch} groups={[]} />
        </VariablePickerProvider>,
    );
    return { onPatch, ...utils };
}

const waitStep = (seconds) => ({ id: 'w1', type: 'wait', label: 'Wait', seconds });
const duration = () => screen.getByLabelText('Wait duration');
const unit = () => screen.getByLabelText('Duration unit');

beforeEach(() => cleanup());

describe('SettingsForm — wait duration', () => {
    it('lets you clear the field and type a new value without snapping back to 1', () => {
        renderWait(waitStep(5));
        expect(duration().value).toBe('5');

        // The old handler read Number('') === 0 — not NaN, so its guard never
        // fired — and clamped it straight back to 1 mid-edit.
        fireEvent.change(duration(), { target: { value: '' } });
        expect(duration().value).toBe('');

        fireEvent.change(duration(), { target: { value: '90' } });
        expect(duration().value).toBe('90');
    });

    it('restores the stored value when the field is left empty', () => {
        renderWait(waitStep(30));
        fireEvent.change(duration(), { target: { value: '' } });
        fireEvent.blur(duration());
        expect(duration().value).toBe('30');
    });

    it('keeps the number when the unit changes instead of rounding it to zero', () => {
        // 5 seconds shown as hours used to render 0 — below the field's own min.
        renderWait(waitStep(5));
        fireEvent.change(unit(), { target: { value: 'hours' } });
        expect(duration().value).toBe('5');
        expect(Number(duration().value)).toBeGreaterThanOrEqual(Number(duration().min));
    });

    it('gives the number field and the unit select their own width', () => {
        renderWait(waitStep(5));
        // `w-full` on the select is what made it swallow the whole row: it beats
        // a co-present `w-auto` by stylesheet order, not class order.
        expect(unit().className).not.toMatch(/\bw-full\b/);
        expect(unit().className).toMatch(/\bw-auto\b/);
        expect(duration().className).toMatch(/\bflex-1\b/);
    });

    it('caps the stored value at 24 hours', () => {
        renderWait(waitStep(60));
        fireEvent.change(unit(), { target: { value: 'hours' } });
        // Typing is never fought mid-edit…
        fireEvent.change(duration(), { target: { value: '48' } });
        expect(duration().value).toBe('48');
        // …but dropping the raw text reveals the clamped, stored value.
        fireEvent.blur(duration());
        expect(duration().value).toBe('24');
    });
});
