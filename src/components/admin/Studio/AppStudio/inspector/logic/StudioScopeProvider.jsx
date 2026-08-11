import React, { useMemo } from 'react';
import { VariablePickerProvider } from '../../../../AITasksDesigner/Builder/mapping/VariablePickerContext';
import { coerceVariableDefault, seedVariableDefaults } from '../../runtime/appVariables';
import APP_COMPONENT_TYPES from '../../runtime/componentRegistry';

/**
 * App Studio inspector — the variable source for every formula/condition field.
 *
 * Mirrors the routines StepInspector's VariablePickerProvider: it computes the
 * variable GROUPS (currentUser · repeat item · enclosing form fields · screen
 * params · actions · datasets) and a `previewSample` root — a buildScope-shaped
 * object with sample values — then provides them through the shared
 * VariablePickerContext so nested VariableTree/BindingField pickers resolve
 * Studio scope, and FormulaField/ConditionField can live-evaluate.
 *
 * The group `path`s are the exact identifiers the shared expression engine
 * reads (`currentUser.email`, `form.subject`, `actions.act_x.result`), so a
 * picked/dragged path drops straight into a working formula.
 */

const SAMPLE_USER = { id: 'usr_sample', name: 'Alex Rivera', email: 'alex@example.com' };

function isInputType(type) {
    return !!APP_COMPONENT_TYPES[type]?.isInput;
}

/** Locate the node's enclosing form + screen in one walk. */
function locate(definition, nodeId) {
    let formAncestor = null;
    let screenOf = null;
    for (const screen of definition?.screens || []) {
        const walk = (nodes, form) => {
            for (const n of nodes || []) {
                const nextForm = n.type === 'form' ? n : form;
                if (n.id === nodeId) { formAncestor = form; screenOf = screen; return true; }
                if (Array.isArray(n.children) && walk(n.children, nextForm)) return true;
            }
            return false;
        };
        for (const section of screen.sections || []) {
            if (walk(section.children, null)) return { form: formAncestor, screen: screenOf };
        }
    }
    return { form: null, screen: null };
}

/**
 * What an empty field of this component type LOOKS like.
 *
 * Every form field used to sample as `''`, so the condition builder inferred
 * "string" for all of them and a fresh row on a number field offered only
 * equals / contains / starts with — "greater than" was simply not in the list.
 * The sample is the only type signal that reaches inferType, so it has to be
 * shaped like the value the field really submits.
 */
export function sampleForInputType(type) {
    switch (type) {
        case 'input_number': return 0;
        case 'input_checkbox': return false;
        case 'input_date': return '2020-01-01';
        case 'input_datetime': return '2020-01-01T09:00';
        case 'input_multiselect': return [];
        case 'input_file': return null;
        case 'input_relation': return null;
        default: return '';
    }
}

/** Input fields of the node's enclosing form (or of the node if it is a form). */
function formFields(definition, node) {
    const form = node?.type === 'form' ? node : locate(definition, node?.id).form;
    if (!form) return [];
    const out = [];
    const walk = (children) => {
        for (const c of children || []) {
            if (isInputType(c.type) && c.props?.name) {
                out.push({ name: c.props.name, type: c.type, label: c.props.label || null });
            }
            if (Array.isArray(c.children)) walk(c.children);
        }
    };
    walk(form.children);
    return out;
}

/**
 * Every table and connector the app's BINDINGS actually reach.
 *
 * The definition carries no data model — tables live behind a fetch — so the
 * honest source for `records.<tableId>` / `connectors.<id>` is what the app
 * already reads. Six of buildScope's fourteen roots had no picker group at all,
 * so a perfectly valid formula over them had to be typed from memory and
 * previewed as nothing.
 */
function referencedSources(definition) {
    const tableIds = new Set();
    const connectorIds = new Set();
    const visit = (value, depth = 0) => {
        if (!value || typeof value !== 'object' || depth > 8) return;
        if (Array.isArray(value)) { for (const v of value) visit(v, depth + 1); return; }
        if ((value.kind === 'records' || value.kind === 'record') && typeof value.tableId === 'string' && value.tableId) {
            tableIds.add(value.tableId);
        }
        if (value.kind === 'connector' && typeof value.connectorId === 'string' && value.connectorId) {
            connectorIds.add(value.connectorId);
        }
        for (const v of Object.values(value)) visit(v, depth + 1);
    };
    for (const screen of definition?.screens || []) {
        for (const section of screen.sections || []) visit(section.children);
    }
    visit(definition?.actions);
    return { tableIds: [...tableIds], connectorIds: [...connectorIds] };
}

/** What the picker should call an action, so the list is not a wall of ids. */
const ACTION_KIND_LABELS = {
    run_automation: 'routine',
    ai_extract: 'AI · extract',
    ai_generate: 'AI · generate',
    kb_query: 'AI · knowledge base',
    send_email: 'e-mail',
    sequence: 'flow',
};

function datasetIds(definition) {
    const ds = definition?.datasets;
    if (Array.isArray(ds)) return ds.map((d) => d?.id).filter(Boolean);
    if (ds && typeof ds === 'object') return Object.keys(ds);
    return [];
}

/**
 * buildStudioScope(definition, node, previewSampleOverride)
 *   → { groups, previewSample }
 *
 * Pure — reused by StudioScopeProvider AND by ConditionField (which must hand
 * the same previewSample down to the ConditionBuilder for datatype inference).
 */
export function buildStudioScope(definition, node, previewSampleOverride = null, extraGroups = null) {
    const { screen } = node ? locate(definition, node.id) : { screen: null };
    const fields = formFields(definition, node);
    // EVERY action, not only run_automation. The runtime publishes every kind's
    // outcome under actions.<id>.result — including the native AI ones, which
    // are exactly the results an author most wants to put on screen — and
    // filtering them out of the picker meant typing the path from memory.
    const actionEntries = Object.entries(definition?.actions || {});
    const dsIds = datasetIds(definition);
    const { tableIds, connectorIds } = referencedSources(definition);
    const screenName = screen?.name || definition?.screens?.[0]?.name || 'Screen';

    const groups = [
        {
            id: 'currentUser', label: 'Current user', kind: 'trigger', basePath: 'currentUser',
            fields: [
                { key: 'id', path: 'currentUser.id', sample: SAMPLE_USER.id },
                { key: 'name', path: 'currentUser.name', sample: SAMPLE_USER.name },
                { key: 'email', path: 'currentUser.email', sample: SAMPLE_USER.email },
            ],
        },
        {
            id: 'item', label: 'Repeat item', kind: 'loop', basePath: 'item',
            fields: [
                { key: 'item', path: 'item', sample: 'the current item' },
                { key: 'index', path: 'index', sample: 0 },
            ],
        },
    ];

    if (fields.length) {
        groups.push({
            id: 'form', label: 'Form', kind: 'integration_action', basePath: 'form',
            fields: fields.map((f) => ({
                key: f.name,
                path: `form.${f.name}`,
                // Only a REAL label overrides; an absent one falls through to
                // humanizeFieldKey ('note' → 'Note') rather than showing the
                // raw key back to the author.
                ...(f.label ? { label: f.label } : {}),
                sample: sampleForInputType(f.type),
            })),
        });
    }

    groups.push({
        id: 'screen', label: 'Screen', kind: 'code', basePath: 'screen',
        fields: [
            { key: 'name', path: 'screen.name', sample: screenName },
            { key: 'params', path: 'screen.params', sample: {} },
        ],
    });

    // The clock. Both are legal roots and both were invisible, so "is it
    // overdue?" had to be written blind.
    const nowIso = new Date().toISOString();
    groups.push({
        id: 'clock', label: 'Date & time', kind: 'code', basePath: 'now',
        fields: [
            { key: 'now', path: 'now', label: 'Now (timestamp)', sample: nowIso },
            { key: 'today', path: 'today', label: 'Today (date)', sample: nowIso.slice(0, 10) },
        ],
    });

    /*
     * The `vars` root: the app's DECLARED variables plus the one built-in.
     *
     * This used to advertise a single hard-coded `vars.filters`, so a variable
     * created by a set_variable step or a resultVar was invisible here and the
     * only way to use it was to remember its spelling and type it — which is
     * exactly how `vars.statusfilter` gets written where `vars.filters.status`
     * was meant.
     *
     * The sample must be the COERCED default: VariableTree renders it directly
     * and ConditionField feeds it to the condition builder for datatype
     * inference, so an uncoerced "5" on a number variable would make the
     * builder offer string operators.
     */
    const declared = Array.isArray(definition?.variables) ? definition.variables : [];
    groups.push({
        id: 'vars', label: 'Variables', kind: 'code', basePath: 'vars',
        fields: [
            // Built-in: a filter_bar publishes its controls as vars.filters.<name>.
            { key: 'filters', path: 'vars.filters', sample: {} },
            ...declared
                .filter((v) => v && typeof v.name === 'string' && v.name)
                .map((v) => ({
                    key: v.name,
                    path: `vars.${v.name}`,
                    label: v.label || v.name,
                    sample: coerceVariableDefault(v.type, v.default).value,
                })),
        ],
    });

    if (actionEntries.length) {
        groups.push({
            id: 'actions', label: 'Actions', kind: 'ai_step', basePath: 'actions',
            fields: actionEntries.map(([id, a]) => ({
                key: id,
                path: `actions.${id}.result`,
                label: ACTION_KIND_LABELS[a?.kind] ? `${id} (${ACTION_KIND_LABELS[a.kind]})` : id,
                sample: null,
                // An AI action declares the shape it returns, so its fields are
                // pickable instead of guessable.
                children: aiResultChildren(id, a),
            })),
        });
    }

    if (dsIds.length) {
        groups.push({
            id: 'datasets', label: 'Datasets', kind: 'integration_action', basePath: 'datasets',
            fields: dsIds.map((id) => ({ key: id, path: `datasets.${id}`, sample: null })),
        });
    }

    if (tableIds.length) {
        groups.push({
            id: 'records', label: 'Tables', kind: 'integration_action', basePath: 'records',
            fields: tableIds.map((id) => ({ key: id, path: `records.${id}`, sample: [] })),
        });
    }

    if (connectorIds.length) {
        groups.push({
            id: 'connectors', label: 'Connections', kind: 'integration_action', basePath: 'connectors',
            fields: connectorIds.map((id) => ({ key: id, path: `connectors.${id}`, sample: null })),
        });
    }

    if (Array.isArray(extraGroups) && extraGroups.length) groups.push(...extraGroups);

    const now = new Date().toISOString();
    const previewSample = previewSampleOverride || {
        currentUser: SAMPLE_USER,
        item: {},
        index: 0,
        value: null,
        form: Object.fromEntries(fields.map((f) => [f.name, sampleForInputType(f.type)])),
        forms: {},
        screen: { id: screen?.id, name: screenName, params: {} },
        actions: Object.fromEntries(actionEntries.map(([id]) => [id, { status: 'success', result: {} }])),
        datasets: Object.fromEntries(dsIds.map((id) => [id, null])),
        // Present but empty: a formula over them previews as nothing rather
        // than erroring, which is what the runtime does before the fetch lands.
        records: Object.fromEntries(tableIds.map((id) => [id, []])),
        connectors: Object.fromEntries(connectorIds.map((id) => [id, null])),
        // Declared variables carry their real starting value, so the live
        // preview under a formula shows something rather than `undefined`.
        vars: { filters: {}, ...seedVariableDefaults(definition?.variables) },
        now,
        today: now.slice(0, 10),
    };

    return { groups, previewSample };
}

/** The field names an AI action's declared schema produces, as picker children. */
function aiResultChildren(id, action) {
    const schema = action?.schema;
    const names = Array.isArray(schema)
        ? schema.map((f) => (typeof f === 'string' ? f : f?.name)).filter(Boolean)
        : (schema && typeof schema === 'object' ? Object.keys(schema) : []);
    if (!names.length) return undefined;   // an empty array renders a chevron onto nothing
    return names.map((n) => ({ key: n, path: `actions.${id}.result.${n}`, sample: null }));
}

/**
 * `value` — the field under test — is a legal root ONLY inside a validation
 * rule, so it is opt-in rather than a permanent entry that previews as
 * undefined everywhere else. ValidationRuleEditor is the one caller.
 */
export const VALUE_GROUP = {
    id: 'value', label: 'This field', kind: 'code', basePath: 'value',
    fields: [{ key: 'value', path: 'value', label: 'The value being checked', sample: '' }],
};

export default function StudioScopeProvider({ definition, node, previewSample = null, extraGroups = null, children }) {
    const { groups, previewSample: sample } = useMemo(
        () => buildStudioScope(definition, node, previewSample, extraGroups),
        [definition, node, previewSample, extraGroups],
    );
    return (
        <VariablePickerProvider groups={groups} previewSample={sample}>
            {children}
        </VariablePickerProvider>
    );
}
