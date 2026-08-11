import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import ChoiceCards from './ChoiceCards';

/**
 * The point of this component is the semantics the prior art lacked: the two
 * existing card-pickers in the codebase render plain buttons, so selection
 * state was carried by colour alone and nothing said the options were mutually
 * exclusive. These tests pin the parts a redesign would otherwise quietly drop.
 */

type Action = 'tokenize' | 'block' | 'ask';

const OPTIONS: { value: Action; label: string; description: string }[] = [
    { value: 'tokenize', label: 'Tokenize & round-trip', description: 'Placeholders before the AI sees it.' },
    { value: 'block', label: 'Block the message', description: 'Reject the turn.' },
    { value: 'ask', label: 'Ask each time', description: 'Let the user choose.' },
];

function setup(overrides: { disabled?: boolean; value?: Action | null } = {}) {
    const onChange = vi.fn();
    render(
        <ChoiceCards<Action>
            value={overrides.value !== undefined ? overrides.value : 'block'}
            onChange={onChange}
            options={OPTIONS}
            ariaLabel="Action when PII is detected"
            disabled={overrides.disabled}
        />,
    );
    return { onChange };
}

describe('ChoiceCards', () => {
    it('is a named radiogroup with exactly one checked radio', () => {
        setup();
        expect(screen.getByRole('radiogroup', { name: 'Action when PII is detected' })).toBeInTheDocument();
        const radios = screen.getAllByRole('radio');
        expect(radios).toHaveLength(3);
        expect(radios.filter(r => r.getAttribute('aria-checked') === 'true')).toHaveLength(1);
        expect(screen.getByRole('radio', { name: /Block the message/ })).toHaveAttribute('aria-checked', 'true');
    });

    it('is a single tab stop, not one per card', () => {
        setup();
        const tabbable = screen.getAllByRole('radio').filter(r => r.getAttribute('tabindex') === '0');
        expect(tabbable).toHaveLength(1);
        expect(tabbable[0]).toHaveAccessibleName(/Block the message/);
    });

    it('selects on click', async () => {
        const user = userEvent.setup();
        const { onChange } = setup();
        await user.click(screen.getByRole('radio', { name: /Tokenize/ }));
        expect(onChange).toHaveBeenCalledWith('tokenize');
    });

    it('moves with the arrow keys and wraps, selecting as it goes', async () => {
        const user = userEvent.setup();
        const { onChange } = setup();
        screen.getByRole('radio', { name: /Block the message/ }).focus();

        await user.keyboard('{ArrowRight}');
        expect(onChange).toHaveBeenLastCalledWith('ask');
        await user.keyboard('{ArrowRight}');   // wraps past the end
        expect(onChange).toHaveBeenLastCalledWith('tokenize');
        await user.keyboard('{ArrowLeft}');    // wraps back
        expect(onChange).toHaveBeenLastCalledWith('ask');
    });

    it('supports Home and End', async () => {
        const user = userEvent.setup();
        const { onChange } = setup();
        screen.getByRole('radio', { name: /Block the message/ }).focus();
        await user.keyboard('{End}');
        expect(onChange).toHaveBeenLastCalledWith('ask');
        await user.keyboard('{Home}');
        expect(onChange).toHaveBeenLastCalledWith('tokenize');
    });

    it('skips disabled options when arrowing', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <ChoiceCards<Action>
                value="block"
                onChange={onChange}
                options={[
                    { value: 'tokenize', label: 'Tokenize & round-trip', disabled: true },
                    { value: 'block', label: 'Block the message' },
                    { value: 'ask', label: 'Ask each time' },
                ]}
                ariaLabel="Action"
            />,
        );
        screen.getByRole('radio', { name: /Block the message/ }).focus();
        await user.keyboard('{ArrowRight}');
        expect(onChange).toHaveBeenLastCalledWith('ask');
        await user.keyboard('{ArrowRight}');   // wraps over the disabled one
        expect(onChange).toHaveBeenLastCalledWith('block');
        expect(onChange).not.toHaveBeenCalledWith('tokenize');
    });

    it('stays keyboard-reachable when nothing is selected', () => {
        // Reachable really matters here: a stored value whose licence lapsed
        // leaves the group with no selection, and that is precisely the moment
        // the admin has to be able to pick something else.
        const onChange = vi.fn();
        render(
            <ChoiceCards<Action>
                value={null}
                onChange={onChange}
                options={OPTIONS}
                ariaLabel="Action"
            />,
        );
        const radios = screen.getAllByRole('radio');
        expect(radios.filter(r => r.getAttribute('aria-checked') === 'true')).toHaveLength(0);
        expect(radios.filter(r => r.getAttribute('tabindex') === '0')).toHaveLength(1);
    });

    it('does not fire for a disabled option, and shows why it is locked', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(
            <ChoiceCards<Action>
                value="block"
                onChange={onChange}
                options={[
                    { value: 'tokenize', label: 'Tokenize', disabled: true, lockedNotice: 'Enterprise feature.' },
                    { value: 'block', label: 'Block' },
                ]}
                ariaLabel="Action"
            />,
        );
        await user.click(screen.getByRole('radio', { name: /Tokenize/ }));
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByText('Enterprise feature.')).toBeInTheDocument();
    });

    it('disables the whole group when asked', async () => {
        const user = userEvent.setup();
        const { onChange } = setup({ disabled: true });
        for (const r of screen.getAllByRole('radio')) expect(r).toBeDisabled();
        await user.click(screen.getByRole('radio', { name: /Tokenize/ }));
        expect(onChange).not.toHaveBeenCalled();
    });
});
