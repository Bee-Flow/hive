/**
 * The one guarantee Cowork mode has to keep: a send in Cowork mode creates a
 * cowork item and does NOT go into the conversation — and flipping back
 * restores plain chat. Everything else in InputArea stays untouched when no
 * `cowork` prop is passed (the default for every existing call site).
 */
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InputArea from './InputArea';
import CoworkModeToggle from './cowork/CoworkModeToggle';

// Sub-panels that fetch their own data on mount; none of them are what this
// file is about, and the skills chips choke on a stubbed empty payload.
vi.mock('./skills/ActiveSkillChips', () => ({ default: () => null }));
vi.mock('./skills/SkillsPopover', () => ({ default: () => null }));
vi.mock('./chat/Voice/VoiceCallButton', () => ({ default: () => null }));
vi.mock('./chat/Voice/VoiceInlinePanel', () => ({ default: () => null }));

// InputArea reaches for the network on mount (skills, integrations, settings).
// None of that matters here — stub it to a quiet 200, except /ai/user-settings,
// which decides whether the app picker has anything to show: its whole
// catalogue is filtered on isGoogleUser/isMicrosoftUser, and an empty result
// makes the picker hide itself.
beforeEach(() => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
        const body = String(url).includes('/ai/user-settings')
            ? { isGoogleUser: true, enabledApps: null, orgEnabledIntegrations: null }
            : {};
        return { ok: true, status: 200, json: async () => body, text: async () => '' };
    });
});

function makeCowork(overrides = {}) {
    return {
        when: { presetId: 'now', date: '', time: '' },
        setWhen: vi.fn(),
        repeatInterval: '',
        setRepeatInterval: vi.fn(),
        agentId: '',
        setAgentId: vi.fn(),
        agents: [],
        submitting: false,
        error: null,
        scheduleReady: true,
        summary: 'Now',
        submit: vi.fn().mockResolvedValue({ id: 'w1', title: 'Do the thing' }),
        reset: vi.fn(),
        ...overrides,
    };
}

// Mirrors the real layout: the switch lives in the page header, next to
// Notebook and Webpage, and the composer sits below it — both driven by one
// mode state.
function Harness({ cowork, onSendMessage, initialMode = 'chat', locked = false }) {
    const [input, setInput] = useState('');
    const [mode, setMode] = useState(initialMode);
    return (
        <>
            <CoworkModeToggle enabled={!!cowork} value={mode} onChange={setMode} locked={locked} />
            <InputArea
                onSendMessage={onSendMessage}
                onStopGenerating={() => {}}
                isLoading={false}
                directMode
                input={input}
                setInput={setInput}
                cowork={cowork}
                coworkMode={mode}
                onCoworkModeChange={setMode}
            />
        </>
    );
}

describe('InputArea — Cowork mode', () => {
    it('keeps the switch out of the composer — it belongs to the page, not the box', () => {
        render(<Harness cowork={makeCowork()} onSendMessage={vi.fn()} />);
        expect(screen.getByTestId('chat-input-form')).not.toContainElement(
            screen.getByTestId('cowork-mode-switch'),
        );
    });

    it('shows no switch when the call site did not wire Cowork up', () => {
        render(<Harness cowork={null} onSendMessage={vi.fn()} />);
        expect(screen.queryByTestId('cowork-mode-switch')).not.toBeInTheDocument();
    });

    it('hides the switch once the conversation has started', () => {
        render(<Harness cowork={makeCowork()} onSendMessage={vi.fn()} locked />);
        expect(screen.queryByTestId('cowork-mode-switch')).not.toBeInTheDocument();
        // The composer itself keeps working — only the choice is gone.
        expect(screen.getByTestId('chat-message-input')).toBeInTheDocument();
    });

    it('routes a send to cowork, not to the conversation', () => {
        const onSendMessage = vi.fn();
        const cowork = makeCowork();
        render(<Harness cowork={cowork} onSendMessage={onSendMessage} />);

        fireEvent.click(screen.getByTestId('cowork-mode-cowork'));
        fireEvent.change(screen.getByTestId('cowork-brief-input'), { target: { value: 'Do the thing' } });
        fireEvent.click(screen.getByTestId('cowork-send'));

        expect(cowork.submit).toHaveBeenCalledWith('Do the thing', expect.any(Object));
        expect(onSendMessage).not.toHaveBeenCalled();
    });

    it('flipping back to Chat restores the normal send', () => {
        const onSendMessage = vi.fn();
        const cowork = makeCowork();
        render(<Harness cowork={cowork} onSendMessage={onSendMessage} initialMode="cowork" />);

        fireEvent.click(screen.getByTestId('cowork-mode-chat'));
        fireEvent.change(screen.getByTestId('chat-message-input'), { target: { value: 'Hello' } });
        fireEvent.click(screen.getByTestId('send-message-button'));

        expect(onSendMessage).toHaveBeenCalled();
        expect(cowork.submit).not.toHaveBeenCalled();
    });

    it('keeps the app picker reachable in Cowork mode', async () => {
        // A cowork brief runs unattended against the user's integrations, so the
        // "which apps may it use" control has to survive the switch — it used
        // to be hidden along with the chat-only tools.
        render(<Harness cowork={makeCowork()} onSendMessage={vi.fn()} initialMode="cowork" />);
        const picker = await screen.findByTitle('Apps');
        expect(picker).toBeInTheDocument();
        expect(picker.closest('.hidden')).toBeNull();
    });

    it('keeps the app picker grouped with the schedule chips, not floating', async () => {
        // The toolbar row is justify-between. A third child gets pushed to the
        // middle of the composer, which is where the picker ended up once Cowork
        // mode added its chips — so this pins them into one group.
        render(<Harness cowork={makeCowork()} onSendMessage={vi.fn()} initialMode="cowork" />);
        const apps = await screen.findByTitle('Apps');
        const chip = screen.getByTestId('cowork-when-chip');

        const row = apps.closest('.justify-between');
        expect(row).not.toBeNull();
        const groupOf = (el) => Array.from(row.children).find(child => child.contains(el));
        expect(groupOf(apps)).toBe(groupOf(chip));
    });

    it('still hides the chat-only tools in Cowork mode', async () => {
        render(<Harness cowork={makeCowork()} onSendMessage={vi.fn()} initialMode="cowork" />);
        await screen.findByTitle('Apps');
        expect(screen.getByTestId('attach-file-button').closest('.hidden')).not.toBeNull();
    });

    it('shows the app picker in plain chat too', async () => {
        render(<Harness cowork={makeCowork()} onSendMessage={vi.fn()} />);
        const picker = await screen.findByTitle('Apps');
        expect(picker.closest('.hidden')).toBeNull();
    });

    it('hands the whole box to the shared Cowork composer', () => {
        // Not a re-labelled chat composer: the same component /app/cowork
        // renders, so the two surfaces cannot drift apart.
        render(<Harness cowork={makeCowork()} onSendMessage={vi.fn()} initialMode="cowork" />);
        expect(screen.getByTestId('cowork-composer')).toHaveAttribute('data-cowork-mode', 'cowork');
        expect(screen.queryByTestId('chat-input-form')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Cowork brief')).toBeInTheDocument();
    });

    it('will not send while the schedule is half-picked', () => {
        render(<Harness cowork={makeCowork({ scheduleReady: false })} onSendMessage={vi.fn()} initialMode="cowork" />);
        fireEvent.change(screen.getByTestId('cowork-brief-input'), { target: { value: 'Do the thing' } });
        expect(screen.getByTestId('cowork-send')).toBeDisabled();
    });

    it('surfaces a create error without eating the brief', () => {
        render(<Harness cowork={makeCowork({ error: 'Maximum number of cowork items reached (10).' })} onSendMessage={vi.fn()} initialMode="cowork" />);
        expect(screen.getByRole('alert')).toHaveTextContent('Maximum number of cowork items reached');
    });
});
