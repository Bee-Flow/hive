import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import AppRenderer from '../AppRenderer';
import AppForm from './AppForm';
import AppInputMultiselect from './AppInputMultiselect';
import AppInputNumber from './AppInputNumber';
import AppInputRelation from './AppInputRelation';
import AppInputRichtext from './AppInputRichtext';
import AppInputSelect from './AppInputSelect';
import AppButton from './AppButton';
import { CANDIDATE_LIMIT } from './AppInputRelation';
import { dataCacheKey } from '../resolveBinding';
import { RuntimeProvider, buildScope, DEFAULT_RUNTIME } from '../RuntimeContext';

/**
 * The four ways a form could accept — or block — the wrong thing.
 *
 * Every case here is a silent one: nothing crashed, nothing was logged, and the
 * screen looked entirely normal while the submitted payload was wrong (or the
 * submit button could never be reached at all).
 */

const formNode = (children, props = {}) => ({
    id: 'cmp_form', type: 'form', visible: true, onSubmit: 'act_submit',
    props: { name: 'f', submitLabel: 'Send', showReset: false, ...props },
    style: { span: 12, gap: 3, padding: 0 },
    children,
});

function renderForm(children, inputEls, formProps) {
    const runAction = vi.fn();
    const value = {
        ...DEFAULT_RUNTIME, mode: 'run', runAction,
        scope: buildScope({ now: '2020-01-01T00:00:00.000Z' }),
    };
    const utils = render(
        <RuntimeProvider value={value}>
            <AppForm node={formNode(children, formProps)}>{inputEls}</AppForm>
        </RuntimeProvider>,
    );
    return { runAction, ...utils };
}

const numberNode = (props) => ({
    id: 'cmp_num', type: 'input_number', visible: true, style: { span: 6 },
    props: { name: 'amount', label: 'Amount', ...props },
});

describe('AppInputNumber — bounds and bad input', () => {
    // min/max were handed to the DOM only, and the form renders `noValidate`,
    // so the two props the spec advertises enforced exactly nothing.
    it('rejects a value outside min/max on submit', () => {
        const node = numberNode({ min: 1, max: 10 });
        const { runAction, getByLabelText, getByText } = renderForm([node], <AppInputNumber node={node} />);
        fireEvent.change(getByLabelText('Amount'), { target: { value: '500' } });
        fireEvent.click(getByText('Send'));
        expect(runAction).not.toHaveBeenCalled();
        expect(getByText('Enter 10 or less.')).toBeTruthy();
    });

    it('lets a value inside the bounds through', () => {
        const node = numberNode({ min: 1, max: 10 });
        const { runAction, getByLabelText, getByText } = renderForm([node], <AppInputNumber node={node} />);
        fireEvent.change(getByLabelText('Amount'), { target: { value: '7' } });
        fireEvent.click(getByText('Send'));
        expect(runAction).toHaveBeenCalledWith('act_submit', expect.objectContaining({
            formValues: expect.objectContaining({ amount: 7 }),
        }));
    });

    // A number input reports '' for anything the browser calls bad input, while
    // the box still visibly holds the typed text. jsdom does not run that
    // machinery, so the validity flag is stubbed onto the event target.
    it('says what is wrong instead of silently storing nothing', () => {
        const node = numberNode({});
        const { getByLabelText, getByText } = renderForm([node], <AppInputNumber node={node} />);
        const input = getByLabelText('Amount');
        fireEvent.change(input, { target: { value: '3' } });
        // Now the browser refuses the next keystroke: it reports '' and flags
        // badInput, while the box on screen still reads "3,".
        Object.defineProperty(input, 'validity', { value: { badInput: true }, configurable: true });
        fireEvent.change(input, { target: { value: '' } });
        expect(getByText('Enter a number — use a dot as the decimal separator.')).toBeTruthy();
    });
});

describe('AppInputSelect — a value that matches no option', () => {
    const node = {
        id: 'cmp_sel', type: 'input_select', visible: true, style: { span: 6 },
        props: {
            name: 'status', label: 'Status', defaultValue: null,
            options: [{ value: 'open', label: 'Open' }, { value: 'resolved', label: 'Resolved' }],
            valueFrom: { kind: 'static', value: 'awaiting_user' },
        },
    };

    // The control fell back to '' and showed the placeholder while the form
    // still held (and submitted) the hidden value.
    it('shows the held value rather than the placeholder', async () => {
        const { getByLabelText } = renderForm([node], <AppInputSelect node={node} />);
        await waitFor(() => expect(getByLabelText('Status').value).toBe('awaiting_user'));
        expect(screen.getByText('awaiting_user')).toBeTruthy();
    });

    it('submits the value it is showing', async () => {
        const { runAction, getByLabelText, getByText } = renderForm([node], <AppInputSelect node={node} />);
        await waitFor(() => expect(getByLabelText('Status').value).toBe('awaiting_user'));
        fireEvent.click(getByText('Send'));
        expect(runAction).toHaveBeenCalledWith('act_submit', expect.objectContaining({
            formValues: expect.objectContaining({ status: 'awaiting_user' }),
        }));
    });
});

describe('AppInputMultiselect — a scalar pushed into a list field', () => {
    const node = {
        id: 'cmp_ms', type: 'input_multiselect', visible: true, style: { span: 6 },
        props: {
            name: 'tags', label: 'Tags', defaultValue: [],
            options: [{ value: 'urgent', label: 'Urgent' }, { value: 'billing', label: 'Billing' }, { value: 'vip', label: 'VIP' }],
            valueFrom: { kind: 'static', value: 'urgent,billing' },
        },
    };

    it('reads a comma string as the two chips it means', async () => {
        renderForm([node], <AppInputMultiselect node={node} />);
        await waitFor(() => expect(screen.getByLabelText('Tags selected')).toBeTruthy());
        expect(screen.getByLabelText('Remove Urgent')).toBeTruthy();
        expect(screen.getByLabelText('Remove Billing')).toBeTruthy();
    });

    // Submitting untouched used to send the raw string where the routine
    // expected an array — and adding one chip replaced the whole value.
    it('submits an array, and adding a chip keeps what was already there', async () => {
        const { runAction } = renderForm([node], <AppInputMultiselect node={node} />);
        await waitFor(() => expect(screen.getByLabelText('Remove Urgent')).toBeTruthy());
        fireEvent.change(screen.getByLabelText('Add to Tags'), { target: { value: 'vip' } });
        fireEvent.click(screen.getByText('Send'));
        expect(runAction).toHaveBeenCalledWith('act_submit', expect.objectContaining({
            formValues: expect.objectContaining({ tags: ['urgent', 'billing', 'vip'] }),
        }));
    });
});

describe('AppForm — a submit button wired to nothing', () => {
    it('is disabled and says so, instead of swallowing the click', () => {
        const node = numberNode({});
        const runAction = vi.fn();
        const value = { ...DEFAULT_RUNTIME, mode: 'run', runAction, scope: buildScope({}) };
        const bare = { ...formNode([node]), onSubmit: null };
        render(
            <RuntimeProvider value={value}>
                <AppForm node={bare}><AppInputNumber node={node} /></AppForm>
            </RuntimeProvider>,
        );
        const btn = screen.getByText('Send').closest('button');
        expect(btn.disabled).toBe(true);
        expect(btn.getAttribute('data-app-submit-inert')).toBe('true');
    });
});

// ── Whole-screen cases (they need AppRenderer's gates) ──────────────────────

function screenDef(children) {
    return {
        schemaVersion: 2,
        meta: { name: 'T', description: '', icon: 'LayoutGrid' },
        theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' },
        homeScreenId: 'scr_t',
        screens: [{
            id: 'scr_t', name: 'T', icon: null, showInNav: true, maxWidth: 'medium',
            sections: [{ id: 'sec_t', style: { padding: 4, gap: 3, background: 'none' }, children }],
        }],
        actions: { act_submit: { kind: 'toast', message: 'ok' } },
    };
}

const textField = (id, name, label, extra = {}) => ({
    id, type: 'input_text', visible: true, style: { span: 12 },
    props: { name, label, inputType: 'text', required: true }, ...extra,
});

describe('AppForm — a required field the author switched off', () => {
    // enabledWhen:false renders the field inert (pointer-events:none + inert),
    // but it still mounted and still registered as required — so submit failed
    // on a control nobody could focus and the form could never be sent.
    it('does not block submit on a disabled required field', () => {
        const runAction = vi.fn();
        const def = screenDef([{
            id: 'cmp_form', type: 'form', visible: true, onSubmit: 'act_submit',
            props: { name: 'f', submitLabel: 'Send' }, style: { span: 12, gap: 3, padding: 0 },
            children: [textField('cmp_po', 'po', 'PO number', { enabledWhen: 'false' })],
        }]);
        render(<AppRenderer definition={def} screenId="scr_t" mode="run" runAction={runAction} />);
        fireEvent.click(screen.getByText('Send'));
        expect(screen.queryByText('This field is required.')).toBeNull();
        expect(runAction).toHaveBeenCalled();
    });

    it('still blocks on an enabled one', () => {
        const runAction = vi.fn();
        const def = screenDef([{
            id: 'cmp_form', type: 'form', visible: true, onSubmit: 'act_submit',
            props: { name: 'f', submitLabel: 'Send' }, style: { span: 12, gap: 3, padding: 0 },
            children: [textField('cmp_po', 'po', 'PO number')],
        }]);
        render(<AppRenderer definition={def} screenId="scr_t" mode="run" runAction={runAction} />);
        fireEvent.click(screen.getByText('Send'));
        expect(screen.getByText('This field is required.')).toBeTruthy();
        expect(runAction).not.toHaveBeenCalled();
    });
});

describe('AppForm — a required field on a tab nobody opened', () => {
    const tabbedForm = () => screenDef([{
        id: 'cmp_form', type: 'form', visible: true, onSubmit: 'act_submit',
        props: { name: 'f', submitLabel: 'Send' }, style: { span: 12, gap: 3, padding: 0 },
        children: [{
            id: 'cmp_tabs', type: 'tabs', visible: true, props: {}, style: { span: 12, gap: 3, padding: 0 },
            children: [
                {
                    id: 'cmp_t1', type: 'tab', visible: true, props: { label: 'General', icon: null }, style: { gap: 3, padding: 0 },
                    children: [textField('cmp_ref', 'ref', 'Reference')],
                },
                {
                    id: 'cmp_t2', type: 'tab', visible: true, props: { label: 'Billing', icon: null }, style: { gap: 3, padding: 0 },
                    children: [textField('cmp_inv', 'invoice_ref', 'Invoice reference')],
                },
            ],
        }],
    }]);

    // Only the active panel used to render, so tab 2's field never registered:
    // submitting from tab 1 skipped it entirely and the record was created
    // without the mandatory value, silently.
    it('blocks submit and surfaces the tab that holds it', () => {
        const runAction = vi.fn();
        render(<AppRenderer definition={tabbedForm()} screenId="scr_t" mode="run" runAction={runAction} />);
        fireEvent.change(screen.getByLabelText(/^Reference/), { target: { value: 'A-1' } });
        fireEvent.click(screen.getByText('Send'));

        expect(runAction).not.toHaveBeenCalled();
        // The error is on Billing, so Billing is what the viewer is now looking at.
        expect(screen.getByRole('tab', { name: 'Billing' }).getAttribute('aria-selected')).toBe('true');
        expect(screen.getByText('This field is required.')).toBeTruthy();
    });

    it('submits every panel once they are filled', () => {
        const runAction = vi.fn();
        render(<AppRenderer definition={tabbedForm()} screenId="scr_t" mode="run" runAction={runAction} />);
        fireEvent.change(screen.getByLabelText(/^Reference/), { target: { value: 'A-1' } });
        fireEvent.click(screen.getByRole('tab', { name: 'Billing' }));
        fireEvent.change(screen.getByLabelText(/^Invoice reference/), { target: { value: 'INV-9' } });
        fireEvent.click(screen.getByText('Send'));

        expect(runAction).toHaveBeenCalledWith('act_submit', expect.objectContaining({
            formValues: expect.objectContaining({ ref: 'A-1', invoice_ref: 'INV-9' }),
        }));
    });
});

describe('AppInputRelation — a candidate query that failed', () => {
    // The component destructured only { value, isLoading } and dropped `error`,
    // so a 403/500 — or a connector needing reconnection, whose actionable
    // message resolveBinding already carries — reached the user as the words
    // "No matching records.". They concluded the table was empty.
    it('shows the failure instead of an empty result', () => {
        const binding = { kind: 'records', tableId: 't1', limit: CANDIDATE_LIMIT };
        const key = dataCacheKey(binding);
        const dataState = {
            [key]: { status: 'error', error: 'Connect Gmail in Settings → Integrations to load this.', tableId: 't1' },
        };
        const node = {
            id: 'cmp_rel', type: 'input_relation', visible: true, style: { span: 6 },
            props: { name: 'owner', label: 'Owner', tableId: 't1', displayField: 'name', multiple: false, required: false, filter: null },
        };
        const runAction = vi.fn();
        const value = {
            ...DEFAULT_RUNTIME, mode: 'run', runAction, dataState,
            scope: buildScope({ dataState }),
        };
        render(
            <RuntimeProvider value={value}>
                <AppForm node={formNode([node])}><AppInputRelation node={node} /></AppForm>
            </RuntimeProvider>,
        );
        fireEvent.focus(screen.getByLabelText('Search Owner'));
        expect(screen.getByText('Connect Gmail in Settings → Integrations to load this.')).toBeTruthy();
        expect(screen.queryByText('No matching records.')).toBeNull();
    });
});

describe('AppInputRichtext — the toolbar in preview mode', () => {
    // The textarea unmounts in preview, so surround() bailed at `if (!el)` and
    // Bold/Italic/Link/List were silent no-ops: clicked, nothing happened, no
    // message, no switch back.
    it('disables the format buttons rather than ignoring the clicks', () => {
        const node = {
            id: 'cmp_rt', type: 'input_richtext', visible: true, style: { span: 12 },
            props: { name: 'body', label: 'Body', defaultValue: 'hello' },
        };
        render(
            <RuntimeProvider value={{ ...DEFAULT_RUNTIME, mode: 'run', scope: buildScope({}) }}>
                <AppForm node={formNode([node])}><AppInputRichtext node={node} /></AppForm>
            </RuntimeProvider>,
        );
        expect(screen.getByLabelText('Bold').disabled).toBe(false);
        fireEvent.click(screen.getByText('Preview'));
        expect(screen.getByLabelText('Bold').disabled).toBe(true);
        expect(screen.getByLabelText('Bullet list').disabled).toBe(true);
        // …and leaving preview gives them back.
        fireEvent.click(screen.getByText('Edit'));
        expect(screen.getByLabelText('Bold').disabled).toBe(false);
    });
});

describe('AppButton — role "submit" outside a form', () => {
    // The runtime gave it type="submit" and no onClick even with no enclosing
    // <form>, and the publish validator exempted role:'submit' from its
    // inert-control warning regardless of ancestry — so the dead button shipped.
    it('is disabled and explains itself', () => {
        const node = {
            id: 'cmp_btn', type: 'button', visible: true, style: { span: 3 },
            props: { label: 'Save', variant: 'primary', role: 'submit' },
        };
        render(
            <RuntimeProvider value={{ ...DEFAULT_RUNTIME, mode: 'run', scope: buildScope({}) }}>
                <AppButton node={node} />
            </RuntimeProvider>,
        );
        const btn = screen.getByText('Save').closest('button');
        expect(btn.disabled).toBe(true);
        expect(btn.getAttribute('type')).toBe('button');
        expect(btn.getAttribute('data-app-orphan-submit')).toBe('true');
    });

    it('works normally inside one', () => {
        const node = {
            id: 'cmp_btn', type: 'button', visible: true, style: { span: 3 },
            props: { label: 'Save', variant: 'primary', role: 'submit' },
        };
        const runAction = vi.fn();
        const value = { ...DEFAULT_RUNTIME, mode: 'run', runAction, scope: buildScope({}) };
        render(
            <RuntimeProvider value={value}>
                <AppForm node={formNode([node], { showSubmit: false })}><AppButton node={node} /></AppForm>
            </RuntimeProvider>,
        );
        const btn = screen.getByText('Save').closest('button');
        expect(btn.disabled).toBe(false);
        expect(btn.getAttribute('type')).toBe('submit');
        fireEvent.click(btn);
        expect(runAction).toHaveBeenCalledWith('act_submit', expect.anything());
    });
});
