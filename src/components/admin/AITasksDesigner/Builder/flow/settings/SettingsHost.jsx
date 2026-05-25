import React, { createContext, useContext } from 'react';
import SettingsForm from '../SettingsForm';
import { getSettingsForType } from './registry';

/**
 * Settings panel host (§2 scaffolding).
 *
 * Looks up the per-type editor from the registry and renders it inside
 * a SettingsContext. Falls back to the legacy SettingsForm so the
 * cutover from the 1774-line god-component can happen one type at a
 * time without breaking the build.
 *
 * Consumers pass the same props the legacy SettingsForm took; the host
 * forwards them to whichever editor wins.
 */

const SettingsContext = createContext({});

export function useSettingsContext() {
    return useContext(SettingsContext);
}

export default function SettingsHost(props) {
    const stepType = props?.step?.type;
    const PerType = stepType ? getSettingsForType(stepType) : null;
    const context = {
        step: props.step,
        modelTiers: props.modelTiers,
        stepIssues: props.stepIssues,
        groups: props.groups,
        previewSample: props.previewSample,
        catalog: props.catalog,
    };
    return (
        <SettingsContext.Provider value={context}>
            {PerType ? <PerType {...props} /> : <SettingsForm {...props} />}
        </SettingsContext.Provider>
    );
}
