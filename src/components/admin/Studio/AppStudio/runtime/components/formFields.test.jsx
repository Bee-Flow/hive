import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppForm from './AppForm';
import AppInputDate from './AppInputDate';
import AppInputDatetime from './AppInputDatetime';
import AppInputFile, { entryName, entryHref } from './AppInputFile';
import AppInputMultiselect from './AppInputMultiselect';
import AppInputRelation from './AppInputRelation';
import AppInputRichtext from './AppInputRichtext';
import AppInputSelect from './AppInputSelect';
import AppInputText from './AppInputText';
import { nowLocalIso, todayIso } from './localDate';
import { authFetch } from '../../../../../../utils/helpers';
import { DataProvider } from '../DataContext';
import { dataCacheKey } from '../resolveBinding';
import { CANDIDATE_LIMIT } from './AppInputRelation';
import { RuntimeProvider, buildScope, DEFAULT_RUNTIME } from '../RuntimeContext';

// AppInputFile uploads through the app's attachment store — stub the network.
vi.mock('../../../../../../utils/helpers', () => ({
    API_BASE: '',
    authFetch: vi.fn(async () => ({ ok: true, json: async () => ({ success: true, attachment: { id: 'att-1', mime: 'application/pdf', size: 4, sha: 'c'.repeat(64), scanned: true } }) })),
}));

const formNode = (child) => ({
    id: 'cmp_form', type: 'form', visible: true, onSubmit: 'act_submit',
    props: { name: 'f', submitLabel: 'Send', showReset: false }, style: { span: 12, gap: 3, padding: 0 },
    children: [child],
});

function renderForm(child, inputEl, { dataState } = {}) {
    const runAction = vi.fn();
    const value = {
        ...DEFAULT_RUNTIME,
        mode: 'run',
        runAction,
        dataState: dataState || {},
        scope: buildScope({ dataState: dataState || {}, now: '2020-01-01T00:00:00.000Z' }),
    };
    const utils = render(
        <RuntimeProvider value={value}>
            <AppForm node={formNode(child)}>{inputEl}</AppForm>
        </RuntimeProvider>,
    );
    return { runAction, ...utils };
}

describe('AppInputMultiselect', () => {
    const node = {
        id: 'cmp_ms', type: 'input_multiselect', visible: true,
        props: {
            name: 'tags', label: 'Tags', required: false, defaultValue: [],
            options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }],
        },
        style: { span: 6 },
    };

    it('submits an array of selected values', () => {
        const { runAction, getByLabelText, getByText } = renderForm(node, <AppInputMultiselect node={node} />);
        fireEvent.change(getByLabelText('Add to Tags'), { target: { value: 'a' } });
        fireEvent.change(getByLabelText('Add to Tags'), { target: { value: 'c' } });
        fireEvent.click(getByText('Send'));
        expect(runAction).toHaveBeenCalledWith('act_submit', expect.objectContaining({
            formValues: expect.objectContaining({ tags: ['a', 'c'] }),
        }));
    });
});

describe('AppInputDatetime', () => {
    it('submits the ISO datetime string', () => {
        const node = {
            id: 'cmp_dt', type: 'input_datetime', visible: true,
            props: { name: 'when', label: 'When', required: false, withTime: true, defaultValue: null },
            style: { span: 6 },
        };
        const { runAction, getByLabelText, getByText } = renderForm(node, <AppInputDatetime node={node} />);
        // datetime-local input has no accessible name via label association in jsdom here;
        // target it by role.
        const input = getByLabelText('When', { selector: 'input' });
        fireEvent.change(input, { target: { value: '2026-02-03T14:30' } });
        fireEvent.click(getByText('Send'));
        expect(runAction).toHaveBeenCalledWith('act_submit', expect.objectContaining({
            formValues: expect.objectContaining({ when: '2026-02-03T14:30' }),
        }));
    });
});

describe('AppInputRichtext', () => {
    it('submits markdown text', () => {
        const node = {
            id: 'cmp_rt', type: 'input_richtext', visible: true,
            props: { name: 'body', label: 'Body', required: false, defaultValue: null },
            style: { span: 12 },
        };
        const { runAction, getByText, container } = renderForm(node, <AppInputRichtext node={node} />);
        const area = container.querySelector('textarea');
        fireEvent.change(area, { target: { value: 'Hello **world**' } });
        fireEvent.click(getByText('Send'));
        expect(runAction).toHaveBeenCalledWith('act_submit', expect.objectContaining({
            formValues: expect.objectContaining({ body: 'Hello **world**' }),
        }));
    });

    it('renders a preview using the markdown subset', () => {
        const node = {
            id: 'cmp_rt2', type: 'input_richtext', visible: true,
            props: { name: 'body', label: 'Body', required: false, defaultValue: 'a **b**' },
            style: { span: 12 },
        };
        const { getByText, container } = renderForm(node, <AppInputRichtext node={node} />);
        fireEvent.click(getByText('Preview'));
        expect(container.querySelector('[data-app-richtext-preview] strong')).toBeTruthy();
    });
});

describe('AppInputRelation', () => {
    it('submits the picked record id from bound candidates', () => {
        const binding = { kind: 'records', tableId: 't1', limit: CANDIDATE_LIMIT };
        const key = dataCacheKey(binding);
        const dataState = { [key]: { status: 'success', result: [{ id: 7, name: 'Ann' }, { id: 9, name: 'Bo' }], tableId: 't1' } };
        const node = {
            id: 'cmp_rel', type: 'input_relation', visible: true,
            props: { name: 'owner', label: 'Owner', tableId: 't1', displayField: 'name', multiple: false, required: false, filter: null },
            style: { span: 6 },
        };
        const { runAction, getByLabelText, getByText } = renderForm(node, <AppInputRelation node={node} />, { dataState });
        fireEvent.focus(getByLabelText('Search Owner'));
        fireEvent.mouseDown(getByText('Ann'));
        fireEvent.click(getByText('Send'));
        expect(runAction).toHaveBeenCalledWith('act_submit', expect.objectContaining({
            formValues: expect.objectContaining({ owner: 7 }),
        }));
    });

    // Regression: the candidate binding is built from props INSIDE this input, so
    // AppDataScope's static screen scan never sees it and never fetched it — the
    // dropdown was always empty and the field could not be filled at all.
    it('fetches its own candidate records (nothing else fetches them)', async () => {
        authFetch.mockImplementation(async () => ({
            ok: true, status: 200, json: async () => ({ records: [{ id: 7, name: 'Ann' }] }),
        }));
        const node = {
            id: 'cmp_rel2', type: 'input_relation', visible: true,
            props: { name: 'owner', label: 'Owner', tableId: 't1', displayField: 'name', multiple: false, required: false, filter: null },
            style: { span: 6 },
        };
        const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        const { getByLabelText, findByText } = render(
            <QueryClientProvider client={client}>
                <RuntimeProvider value={{ ...DEFAULT_RUNTIME, mode: 'run' }}>
                    <DataProvider appId="app-1">
                        <AppForm node={formNode(node)}><AppInputRelation node={node} /></AppForm>
                    </DataProvider>
                </RuntimeProvider>
            </QueryClientProvider>,
        );
        // The limit is explicit on purpose: without one the server clamps to
        // 50, so the picker only ever saw the first fifty rows of the table.
        await waitFor(() => expect(authFetch).toHaveBeenCalledWith(
            `/api/studio-apps/app-1/data/tables/t1/records?limit=${CANDIDATE_LIMIT}`,
        ));
        fireEvent.focus(getByLabelText('Search Owner'));
        expect(await findByText('Ann')).toBeTruthy();
    });
});

describe('AppInputFile', () => {
    const node = {
        id: 'cmp_file', type: 'input_file', visible: true,
        props: { name: 'file', label: 'File', accept: null, multiple: false, required: false },
        style: { span: 6 },
    };
    // The file input reads the app id from the DataContext for its upload URL.
    const renderFileForm = (n = node, el = <AppInputFile node={n} />) =>
        renderForm(n, <DataProvider appId="app-1">{el}</DataProvider>);

    beforeEach(() => {
        authFetch.mockClear();
        authFetch.mockImplementation(async () => ({ ok: true, json: async () => ({ success: true, attachment: { id: 'att-1', mime: 'application/pdf', size: 4, sha: 'c'.repeat(64), scanned: true } }) }));
    });

    it('uploads to the app attachment store and submits a studio_attachment descriptor', async () => {
        const { runAction, container, findByText, getByText } = renderFileForm();
        const input = container.querySelector('input[type="file"]');
        const file = new File(['data'], 'report.pdf', { type: 'application/pdf' });
        fireEvent.change(input, { target: { files: [file] } });
        await findByText('report.pdf');

        expect(authFetch).toHaveBeenCalledWith('/api/studio-apps/app-1/data/attachments', expect.objectContaining({ method: 'POST' }));

        fireEvent.click(getByText('Send'));
        await waitFor(() => expect(runAction).toHaveBeenCalledWith('act_submit', expect.objectContaining({
            formValues: expect.objectContaining({
                file: { kind: 'studio_attachment', fileId: 'att-1', name: 'report.pdf', mime: 'application/pdf', size: 4 },
            }),
        })));
    });

    // Regression: the route answers { success, attachment: { id, … } }. Reading a
    // flat `data.id` left fileId undefined, so the upload 200'd and the file was
    // silently dropped — no chip, no error. A missing id must now be LOUD.
    it('reads the id out of the nested attachment body, and errors when there is none', async () => {
        const { container, findByText } = renderFileForm();
        fireEvent.change(container.querySelector('input[type="file"]'), {
            target: { files: [new File(['data'], 'report.pdf', { type: 'application/pdf' })] },
        });
        expect(await findByText('report.pdf')).toBeTruthy();

        authFetch.mockImplementationOnce(async () => ({ ok: true, json: async () => ({ success: true }) }));
        const second = renderFileForm();
        fireEvent.change(second.container.querySelector('input[type="file"]'), {
            target: { files: [new File(['data'], 'ghost.pdf', { type: 'application/pdf' })] },
        });
        expect(await second.findByText(/returned no file id/i)).toBeTruthy();
    });

    it('maps quota (409) and malware-scan (422) refusals to friendly copy', async () => {
        for (const [status, pattern] of [[409, /file storage is full/i], [422, /malware scan/i]]) {
            authFetch.mockImplementationOnce(async () => ({ ok: false, status, json: async () => ({ error: 'raw server text' }) }));
            const { container, findByText, unmount } = renderFileForm();
            const input = container.querySelector('input[type="file"]');
            fireEvent.change(input, { target: { files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] } });
            await findByText(pattern);
            unmount();
        }
    });

    it('entry helpers render both descriptors and legacy URL strings', () => {
        const descriptor = { kind: 'studio_attachment', fileId: 'att-9', name: 'invoice.docx' };
        expect(entryName(descriptor)).toBe('invoice.docx');
        expect(entryHref(descriptor, 'app-1')).toBe('/api/studio-apps/app-1/data/attachments/att-9');
        // Legacy CMS url strings (old uploads) keep their name + direct link.
        expect(entryName('/api/cms/asset/old-report.pdf')).toBe('old-report.pdf');
        expect(entryHref('/api/cms/asset/old-report.pdf', 'app-1')).toBe('/api/cms/asset/old-report.pdf');
    });

    // Regression: the whole batch was committed only after the loop, so one
    // failure threw away every file that had already reached the store.
    it('keeps the files that uploaded before a mid-batch failure', async () => {
        const multi = { ...node, id: 'cmp_files', props: { ...node.props, multiple: true } };
        authFetch
            .mockImplementationOnce(async () => ({ ok: true, json: async () => ({ success: true, attachment: { id: 'att-ok', mime: 'application/pdf', size: 4 } }) }))
            .mockImplementationOnce(async () => ({ ok: false, status: 409, json: async () => ({ error: 'raw' }) }));
        const { container, findByText, getByText } = renderFileForm(multi, <AppInputFile node={multi} />);
        fireEvent.change(container.querySelector('input[type="file"]'), {
            target: {
                files: [
                    new File(['a'], 'first.pdf', { type: 'application/pdf' }),
                    new File(['b'], 'second.pdf', { type: 'application/pdf' }),
                ],
            },
        });
        await findByText(/file storage is full/i);
        expect(getByText('first.pdf')).toBeTruthy();
    });

    // Regression: the control kept its previous value, so picking the SAME file
    // again after a removal/failure fired no change event at all.
    it('clears the control so the same file can be picked again', async () => {
        const { container, findByText } = renderFileForm();
        const input = container.querySelector('input[type="file"]');
        fireEvent.change(input, { target: { files: [new File(['x'], 'again.pdf', { type: 'application/pdf' })] } });
        await findByText('again.pdf');
        expect(input.value).toBe('');
    });
});

describe('AppForm — node.validations', () => {
    const textNode = (validations, props = {}) => ({
        id: 'cmp_v', type: 'input_text', visible: true,
        props: { name: 'q', label: 'Q', required: false, defaultValue: null, inputType: 'text', ...props },
        validations,
        style: { span: 12 },
    });
    const renderValidated = (node) => renderForm(node, <AppInputText node={node} />);

    // Regression: rules authored in the inspector were persisted, canonicalized
    // and then NEVER evaluated — the form only ever checked props.required.
    it('blocks the submit and shows the rule message', () => {
        const node = textNode([{ type: 'minLength', value: 4, message: 'Too short.' }]);
        const { runAction, getByLabelText, getByText, getByRole } = renderValidated(node);
        fireEvent.change(getByLabelText('Q'), { target: { value: 'ab' } });
        fireEvent.click(getByText('Send'));
        expect(getByRole('alert').textContent).toBe('Too short.');
        expect(runAction).not.toHaveBeenCalled();
    });

    it('generates a message for a rule the author left blank', () => {
        const node = textNode([{ type: 'maxLength', value: 2 }]);
        const { getByLabelText, getByText, getByRole } = renderValidated(node);
        fireEvent.change(getByLabelText('Q'), { target: { value: 'abcd' } });
        fireEvent.click(getByText('Send'));
        expect(getByRole('alert').textContent).toBe('Enter at most 2 characters.');
    });

    it('evaluates a custom expression against the live form values', () => {
        const node = textNode([{ type: 'expr', expr: "form.q == 'ok'", message: 'Say ok.' }]);
        const { runAction, getByLabelText, getByText, queryByRole } = renderValidated(node);
        fireEvent.change(getByLabelText('Q'), { target: { value: 'nope' } });
        fireEvent.click(getByText('Send'));
        expect(runAction).not.toHaveBeenCalled();
        fireEvent.change(getByLabelText('Q'), { target: { value: 'ok' } });
        fireEvent.click(getByText('Send'));
        expect(queryByRole('alert')).toBeNull();
        expect(runAction).toHaveBeenCalled();
    });

    // The server validator's typed spelling of the same checks.
    it('honours the { type: "format", format: "email" } spelling', () => {
        const node = textNode([{ type: 'format', format: 'email' }]);
        const { runAction, getByLabelText, getByText, getByRole } = renderValidated(node);
        fireEvent.change(getByLabelText('Q'), { target: { value: 'not-an-email' } });
        fireEvent.click(getByText('Send'));
        expect(getByRole('alert').textContent).toBe('Enter a valid email address.');
        expect(runAction).not.toHaveBeenCalled();
    });

    it('leaves an empty optional field alone (only `required` bites on empty)', () => {
        const node = textNode([{ type: 'minLength', value: 4, message: 'Too short.' }]);
        const { runAction, getByText } = renderValidated(node);
        fireEvent.click(getByText('Send'));
        expect(runAction).toHaveBeenCalled();
    });

    // Regression: `v == null || v === ''` counted [] as filled, so an empty
    // multiselect / multi-relation / multi-file passed a required check.
    it('treats an empty array as empty for required', () => {
        const node = {
            id: 'cmp_msr', type: 'input_multiselect', visible: true,
            props: { name: 'tags', label: 'Tags', required: true, defaultValue: [], options: [{ value: 'a', label: 'Alpha' }] },
            style: { span: 6 },
        };
        const { runAction, getByText, getByRole } = renderForm(node, <AppInputMultiselect node={node} />);
        fireEvent.click(getByText('Send'));
        expect(getByRole('alert').textContent).toBe('This field is required.');
        expect(runAction).not.toHaveBeenCalled();
    });
});

describe('AppInputSelect', () => {
    const node = {
        id: 'cmp_sel', type: 'input_select', visible: true,
        props: {
            name: 'choice', label: 'Choice', required: false, defaultValue: 'gone',
            placeholder: null, options: [{ value: 'a', label: 'Alpha' }],
        },
        style: { span: 6 },
    };

    // Regression: an unmatched default rendered a blank control while the form
    // still submitted the stale value.
    it('drops a default that matches no option', () => {
        const { runAction, getByLabelText, getByText } = renderForm(node, <AppInputSelect node={node} />);
        expect(getByLabelText('Choice').value).toBe('');
        fireEvent.click(getByText('Send'));
        expect(runAction).toHaveBeenCalledWith('act_submit', expect.objectContaining({
            formValues: expect.objectContaining({ choice: null }),
        }));
    });

    it('keeps a default that does match', () => {
        const ok = { ...node, props: { ...node.props, defaultValue: 'a' } };
        const { getByLabelText } = renderForm(ok, <AppInputSelect node={ok} />);
        expect(getByLabelText('Choice').value).toBe('a');
    });
});

describe('localDate', () => {
    // Regression: a UTC-derived 'today' prefills the wrong DAY near midnight —
    // late evening east of Greenwich, early morning west of it. Both instants
    // are built from LOCAL parts, so the expectation holds in every timezone.
    it('stamps the local calendar day on both sides of midnight', () => {
        expect(todayIso(new Date(2026, 2, 1, 23, 30))).toBe('2026-03-01');
        expect(todayIso(new Date(2026, 2, 1, 0, 30))).toBe('2026-03-01');
        expect(nowLocalIso(new Date(2026, 2, 1, 23, 30))).toBe('2026-03-01T23:30');
    });

    // Both sides of midnight again: whichever way this box is offset from UTC,
    // one of the two instants crosses the UTC date boundary.
    const MIDNIGHT_EDGES = [
        [new Date(2026, 2, 1, 23, 30), '2026-03-01'],
        [new Date(2026, 2, 2, 0, 30), '2026-03-02'],
    ];

    it("seeds input_date's 'today' default from the local day", () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            for (const [instant, expected] of MIDNIGHT_EDGES) {
                vi.setSystemTime(instant);
                const node = {
                    id: 'cmp_d', type: 'input_date', visible: true,
                    props: { name: 'due', label: 'Due', required: false, defaultValue: 'today' },
                    style: { span: 6 },
                };
                const { getByLabelText, unmount } = renderForm(node, <AppInputDate node={node} />);
                expect(getByLabelText('Due').value).toBe(expected);
                unmount();
            }
        } finally {
            vi.useRealTimers();
        }
    });

    it("seeds input_datetime's 'today' default from the local day", () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        try {
            for (const [instant, expected] of MIDNIGHT_EDGES) {
                vi.setSystemTime(instant);
                const node = {
                    id: 'cmp_dtn', type: 'input_datetime', visible: true,
                    props: { name: 'when', label: 'When', required: false, withTime: false, defaultValue: 'today' },
                    style: { span: 6 },
                };
                const { getByLabelText, unmount } = renderForm(node, <AppInputDatetime node={node} />);
                expect(getByLabelText('When').value).toBe(expected);
                unmount();
            }
        } finally {
            vi.useRealTimers();
        }
    });
});
