import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
    automationOptions, collectModals, connectorOptions, datasetOptions,
    screenOptions, tableOptions,
} from './stepReferences';
import useAutomationApi from '../../../../../hooks/useAutomationApi';
import { API_BASE, authFetch } from '../../../../../utils/helpers';
import useAppTables, { fieldsForTable } from '../bi/useAppTables';
import useConnectors from '../bi/useConnectors';
import { useEditorChrome } from '../editor/EditorChromeContext';

/**
 * Everything a step can point at, loaded once and shared by the step settings
 * panel and the flow canvas.
 *
 * The appId comes from the editor chrome, the same way BindingField's data
 * pickers get it. Outside the editor shell (a per-kind inspector smoke test)
 * there is no appId: every network-backed list stays empty and the pickers
 * degrade to a plain text field, which is exactly what they were before.
 *
 * Nothing here throws. A missing data model, a plan without routines, a 403 on
 * connectors — each resolves to an empty list, because a builder editing a
 * `toast` step should never see an error about routines.
 */

/** Saved datasets, read-only. useDatasets also brings CRUD this has no use for. */
async function fetchDatasets(appId) {
    const res = await authFetch(`${API_BASE}/api/studio-apps/${encodeURIComponent(appId)}/datasets`);
    if (!res.ok) return [];
    let body = null;
    try { body = await res.json(); } catch { return []; }
    return Array.isArray(body?.datasets) ? body.datasets : [];
}

export default function useStepReferences(definition) {
    const chrome = useEditorChrome();
    const appId = chrome?.appId || null;

    const { tables } = useAppTables(appId);
    const { connectors } = useConnectors(appId);

    const datasetQuery = useQuery({
        queryKey: ['studio-app-datasets', appId],
        queryFn: () => fetchDatasets(appId),
        enabled: !!appId,
        staleTime: 30_000,
        retry: false,
    });

    // Routines are a separately licensed feature: a 403 is a legitimate answer,
    // not a failure to report here.
    const automationApi = useAutomationApi();
    const automationQuery = useQuery({
        queryKey: ['studio-app-step-automations'],
        queryFn: async () => {
            try {
                const r = await automationApi.listAutomations();
                return Array.isArray(r?.automations) ? r.automations : [];
            } catch { return []; }
        },
        // Gated on the editor shell like the rest: a per-kind inspector test
        // mounts this panel with no app around it, and it should stay offline.
        enabled: !!appId,
        staleTime: 60_000,
        retry: false,
    });

    const rawTables = tables;
    return useMemo(() => {
        const options = {
            screen: screenOptions(definition?.screens),
            modal: collectModals(definition),
            table: tableOptions(rawTables),
            dataset: datasetOptions(datasetQuery.data),
            automation: automationOptions(automationQuery.data),
            connector: connectorOptions(connectors),
        };
        return {
            options,
            /** Raw column fields for a table, for the record-values picker. */
            fieldsFor: (tableRef) => fieldsForTable(rawTables, tableRef),
            appId,
        };
    }, [definition, rawTables, datasetQuery.data, automationQuery.data, connectors, appId]);
}
