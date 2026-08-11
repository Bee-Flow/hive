import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * The capture settings panel.
 *
 * REGRESSION: the language <option>s rendered `{l.flag} {l.name}` against a
 * config that defines `{ code, label }`. Both were undefined, so all 14 options
 * rendered as a single space — an unusable picker that looked like a CSS
 * problem (a since-removed comment even blamed white-on-white theming). Nobody
 * could choose a language; the 'nl' default is why Dutch kept working, and
 * every non-Dutch meeting was silently transcribed as Dutch.
 *
 * The component is .tsx now so a mismatch like that is a compile error, but the
 * rendered text is what the user actually sees, so it is asserted here too.
 */

const recorderMock = { current: null };
vi.mock('../hooks/RecorderContext', () => ({ useRecorder: () => recorderMock.current }));

import CaptureControls from './CaptureControls';
import { LANGUAGES } from '../../../config/meetingNotesConfig';

const makeRecorder = (settings = {}) => ({
    settings: { language: 'nl', provider: '', contextTerms: '', attendees: '', numSpeakers: '', ...settings },
    setSettings: vi.fn(),
});

describe('CaptureControls', () => {
    beforeEach(() => {
        cleanup();
        vi.clearAllMocks();
        recorderMock.current = makeRecorder();
    });

    function openAdvanced() {
        fireEvent.click(screen.getByRole('button', { name: /Advanced/ }));
    }

    it('renders a readable label for EVERY language — no blank options', () => {
        render(<CaptureControls />);
        openAdvanced();

        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(LANGUAGES.length);
        for (const opt of options) {
            expect(opt.textContent.trim()).not.toBe('');
        }
        // And they are the real labels, not placeholders.
        expect(options.map(o => o.textContent)).toEqual(LANGUAGES.map(l => l.label));
    });

    it('shows the option values as language codes the backend understands', () => {
        render(<CaptureControls />);
        openAdvanced();
        expect(screen.getAllByRole('option').map(o => o.value)).toEqual(LANGUAGES.map(l => l.code));
    });

    it('surfaces the ACTIVE language on the collapsed row', () => {
        // Language drives the transcription engine (and which pyannoteAI speech
        // model is used), so it must be visible without opening the panel.
        recorderMock.current = makeRecorder({ language: 'en' });
        render(<CaptureControls />);
        expect(screen.getByRole('button', { name: /Advanced/ }).textContent).toContain('English');
    });

    it('reports a set glossary on the collapsed row', () => {
        recorderMock.current = makeRecorder({ contextTerms: 'AFAS, Bflow' });
        render(<CaptureControls />);
        expect(screen.getByRole('button', { name: /Advanced/ }).textContent).toMatch(/glossary set/);
    });

    it('a chosen language actually sticks', async () => {
        // Driven through a stateful harness rather than a static mock: the
        // <select> is controlled, so with settings frozen at 'nl' React reverts
        // the DOM value and the test would pass or fail for the wrong reason.
        // This asserts what the user experiences — pick German, it stays German.
        function Harness() {
            const [settings, setSettings] = useState(makeRecorder().settings);
            recorderMock.current = { settings, setSettings };
            return <CaptureControls />;
        }
        render(<Harness />);
        openAdvanced();

        const select = screen.getByRole('combobox');
        expect(select.value).toBe('nl');
        await userEvent.selectOptions(select, 'de');
        expect(screen.getByRole('combobox').value).toBe('de');
        // …and the collapsed row reflects it.
        expect(screen.getByRole('button', { name: /Advanced/ }).textContent).toContain('German');
    });

    it('keeps attendees above the disclosure — it is the strongest naming signal', () => {
        render(<CaptureControls />);
        expect(screen.getByPlaceholderText(/Tom, Gerard/)).toBeTruthy();
    });
});
