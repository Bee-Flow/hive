import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DataGridInspector from './DataGridInspector';
import ChartInspector from './ChartInspector';
import PivotInspector from './PivotInspector';
import InputFileInspector from './InputFileInspector';
import InputRichtextInspector from './InputRichtextInspector';
import {
    InputCheckboxInspector,
    InputDateInspector,
    InputNumberInspector,
    InputSelectInspector,
    InputTextInspector,
    InputTextareaInspector,
} from './inputPanels';
import InputDatetimeInspector from './InputDatetimeInspector';
import InputRelationInspector from './InputRelationInspector';
import InputMultiselectInspector from './InputMultiselectInspector';
import ModalInspector from './ModalInspector';
import RepeaterInspector from './RepeaterInspector';
import { TabsInspector, TabInspector } from './TabsInspector';
import { findNode } from '../../state/definitionOps';

// Wrap a node (or nodes) into a minimal definition the inspectors can patch.
function defWith(nodes, actions = {}) {
    return {
        schemaVersion: 2,
        meta: { name: 'T', description: '', icon: 'LayoutGrid' },
        theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' },
        homeScreenId: 'scr_t',
        screens: [{ id: 'scr_t', name: 'T', icon: null, showInNav: true, maxWidth: 'medium', sections: [{ id: 'sec_t', style: {}, children: Array.isArray(nodes) ? nodes : [nodes] }] }],
        actions,
    };
}

const N = {
    data_grid: { id: 'cmp_dg', type: 'data_grid', visible: true, props: { source: { kind: 'static', value: [] }, columns: [], pageSize: 25, selectable: 'none', searchable: false, rowActions: [], density: 'comfortable', emptyText: 'x' }, style: { span: 12 } },
    chart: { id: 'cmp_ch', type: 'chart', visible: true, props: { chartType: 'bar', source: { kind: 'static', value: [] }, title: null, xKey: 'label', series: [{ key: 'v', label: 'V' }], stacked: false, showLegend: true, showGrid: true, valueFormat: 'number' }, style: { span: 6, height: 'md' } },
    pivot: { id: 'cmp_pv', type: 'pivot', visible: true, props: { source: { kind: 'static', value: [] }, rows: [], columns: [], values: [], showTotals: true, emptyText: 'x' }, style: { span: 12 } },
    input_file: { id: 'cmp_if', type: 'input_file', visible: true, props: { name: 'file', label: 'File', accept: null, multiple: false, required: false }, style: { span: 6 } },
    input_richtext: { id: 'cmp_rt', type: 'input_richtext', visible: true, props: { name: 'body', label: 'Body', required: false, defaultValue: null }, style: { span: 12 } },
    input_datetime: { id: 'cmp_dt', type: 'input_datetime', visible: true, props: { name: 'when', label: 'When', required: false, withTime: true, defaultValue: null }, style: { span: 6 } },
    input_relation: { id: 'cmp_rl', type: 'input_relation', visible: true, props: { name: 'owner', label: 'Owner', tableId: null, displayField: null, multiple: false, required: false, filter: null }, style: { span: 6 } },
    input_multiselect: { id: 'cmp_ms', type: 'input_multiselect', visible: true, props: { name: 'tags', label: 'Tags', options: [], required: false, defaultValue: [] }, style: { span: 6 } },
    modal: { id: 'cmp_md', type: 'modal', visible: true, props: { title: null, size: 'md', triggerLabel: null }, style: { gap: 3, padding: 4 }, children: [] },
    repeater: { id: 'cmp_rp', type: 'repeater', visible: true, props: { source: { kind: 'static', value: [] }, itemActions: [], emptyText: 'x' }, style: { span: 12 }, children: [] },
};

function renderInspector(Comp, node, actions = {}) {
    const onCommit = vi.fn();
    const definition = defWith(node, actions);
    const utils = render(<Comp node={node} definition={definition} onCommit={onCommit} disabled={false} />);
    return { onCommit, definition, ...utils };
}

describe('v2 inspectors — smoke', () => {
    const cases = [
        ['DataGrid', DataGridInspector, N.data_grid],
        ['Chart', ChartInspector, N.chart],
        ['Pivot', PivotInspector, N.pivot],
        ['InputFile', InputFileInspector, N.input_file],
        ['InputRichtext', InputRichtextInspector, N.input_richtext],
        ['InputDatetime', InputDatetimeInspector, N.input_datetime],
        ['InputRelation', InputRelationInspector, N.input_relation],
        ['InputMultiselect', InputMultiselectInspector, N.input_multiselect],
        ['Modal', ModalInspector, N.modal],
    ];
    for (const [name, Comp, node] of cases) {
        it(`${name} mounts without crashing`, () => {
            const { container } = renderInspector(Comp, node);
            expect(container.querySelector('input, select, textarea, button')).toBeTruthy();
        });
    }
});

describe('v2 inspectors — behaviour', () => {
    it('DataGridInspector toggles searchable', () => {
        const { onCommit, getByText } = renderInspector(DataGridInspector, N.data_grid);
        fireEvent.click(getByText('Searchable'));
        expect(onCommit).toHaveBeenCalled();
        expect(onCommit.mock.calls.at(-1)[0].screens[0].sections[0].children[0].props.searchable).toBe(true);
    });

    it('ChartInspector sets a series colour from the no-purple palette', () => {
        const { onCommit, getByLabelText } = renderInspector(ChartInspector, N.chart);
        fireEvent.click(getByLabelText('Colour #22c55e'));
        expect(onCommit.mock.calls.at(-1)[0].screens[0].sections[0].children[0].props.series[0].color).toBe('#22c55e');
    });

    // Inside the editor shell this is a table PICKER; here there is no app id
    // (and so no table list to load), and the raw field is what remains.
    it('InputRelationInspector edits the table, by name outside the editor shell', () => {
        const { onCommit, getByLabelText } = renderInspector(InputRelationInspector, N.input_relation);
        fireEvent.change(getByLabelText('Data table'), { target: { value: 'people' } });
        expect(onCommit.mock.calls.at(-1)[0].screens[0].sections[0].children[0].props.tableId).toBe('people');
    });

    it('ModalInspector edits the title', () => {
        const { onCommit, getByPlaceholderText } = renderInspector(ModalInspector, N.modal);
        fireEvent.change(getByPlaceholderText('Optional dialog title'), { target: { value: 'Hello' } });
        expect(onCommit.mock.calls.at(-1)[0].screens[0].sections[0].children[0].props.title).toBe('Hello');
    });

    it('RepeaterInspector mirrors the source binding into node.forEach', () => {
        const { onCommit, getByPlaceholderText, getByText } = renderInspector(RepeaterInspector, N.repeater);
        // An untouched source opens on the BindingField chooser; typed-in values
        // are the fourth card.
        fireEvent.click(getByText('Type the values myself'));
        fireEvent.change(getByPlaceholderText('[{"name":"…"}]'), { target: { value: '[{"name":"A"}]' } });
        const next = onCommit.mock.calls.at(-1)[0];
        const node = findNode(next, 'cmp_rp').node;
        expect(node.props.source).toEqual({ kind: 'static', value: [{ name: 'A' }] });
        expect(node.forEach).toEqual({ kind: 'static', value: [{ name: 'A' }] });
    });

    it('TabsInspector adds a tab; TabInspector edits a tab label', () => {
        const tabsNode = {
            id: 'cmp_tabs', type: 'tabs', visible: true, props: {}, style: { span: 12 },
            children: [{ id: 'cmp_taba', type: 'tab', visible: true, props: { label: 'One', icon: null }, style: {}, children: [] }],
        };
        const onCommit = vi.fn();
        const definition = defWith(tabsNode);
        const first = render(<TabsInspector node={tabsNode} definition={definition} onCommit={onCommit} disabled={false} />);
        fireEvent.click(first.getByText('Add tab'));
        const next = onCommit.mock.calls.at(-1)[0];
        expect(findNode(next, 'cmp_tabs').node.children.length).toBe(2);
        first.unmount();

        const tabNode = tabsNode.children[0];
        const onCommit2 = vi.fn();
        const { getByDisplayValue } = render(<TabInspector node={tabNode} definition={definition} onCommit={onCommit2} disabled={false} />);
        fireEvent.change(getByDisplayValue('One'), { target: { value: 'Renamed' } });
        expect(onCommit2.mock.calls.at(-1)[0].screens[0].sections[0].children[0].children[0].props.label).toBe('Renamed');
    });
});

// ── valueFrom ("Prefill from") ──────────────────────────────────────────────
//
// Six input types declare `valueFrom` and the runtime has always honoured it,
// but no panel offered it: a hand-built "edit this record" form always opened
// blank and only the AI builder could wire an "AI draft" button.

describe('the Prefill from binding', () => {
    const CASES = [
        ['input_text', InputTextInspector, { id: 'cmp_tx', type: 'input_text', visible: true, props: { name: 'a', label: 'A', inputType: 'text' }, style: { span: 6 } }],
        ['input_textarea', InputTextareaInspector, { id: 'cmp_ta', type: 'input_textarea', visible: true, props: { name: 'a', label: 'A', rows: 4 }, style: { span: 12 } }],
        ['input_select', InputSelectInspector, { id: 'cmp_sl', type: 'input_select', visible: true, props: { name: 'a', label: 'A', options: [] }, style: { span: 6 } }],
        ['input_date', InputDateInspector, { id: 'cmp_dt2', type: 'input_date', visible: true, props: { name: 'a', label: 'A' }, style: { span: 6 } }],
        ['input_richtext', InputRichtextInspector, N.input_richtext],
        ['input_multiselect', InputMultiselectInspector, N.input_multiselect],
    ];

    it.each(CASES)('%s offers it', (_type, Comp, node) => {
        const { getByText } = renderInspector(Comp, node);
        expect(getByText('Prefill from')).toBeTruthy();
    });

    // The two input types whose spec does NOT declare valueFrom must not offer
    // it — a control writing a prop the validator rejects is worse than none.
    it('input_number and input_checkbox do not', () => {
        const num = { id: 'cmp_nm', type: 'input_number', visible: true, props: { name: 'n', label: 'N', step: 1 }, style: { span: 6 } };
        const chk = { id: 'cmp_cb', type: 'input_checkbox', visible: true, props: { name: 'c', label: 'C' }, style: { span: 6 } };
        expect(renderInspector(InputNumberInspector, num).queryByText('Prefill from')).toBeNull();
        expect(renderInspector(InputCheckboxInspector, chk).queryByText('Prefill from')).toBeNull();
    });
});
