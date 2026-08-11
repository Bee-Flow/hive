import { createRequire } from 'node:module';
import { render, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import ValidationRuleEditor from './ValidationRuleEditor';

/**
 * The editor may only ever author rules the SERVER accepts — a rejected type
 * makes every later save 422, i.e. the app is permanently unsaveable. So the
 * gate is the real canonicalize + validate pair, not a local copy of the list.
 */
const require = createRequire(import.meta.url);
const { canonicalizeAppDefinition } = require('../../../../../../../../server/appStudio/canonicalize.js');
const { validateAppDefinition } = require('../../../../../../../../server/appStudio/validate.js');

function saveErrors(validations) {
    const def = {
        schemaVersion: 2,
        meta: { name: 'T' },
        homeScreenId: 'scr_valid',
        screens: [{
            id: 'scr_valid', name: 'T', showInNav: true, maxWidth: 'medium',
            sections: [{
                id: 'sec_valid', style: {},
                children: [{ id: 'cmp_valid', type: 'input_text', props: { name: 'x', label: 'X' }, validations }],
            }],
        }],
        actions: {},
    };
    const { def: canon } = canonicalizeAppDefinition(def);
    return validateAppDefinition(canon).errors;
}

/** The editor is controlled — drive it from state the way LogicSection does. */
function Harness({ initial, onChange }) {
    const [rules, setRules] = useState(initial);
    return <ValidationRuleEditor value={rules} onChange={(next) => { setRules(next); onChange(next); }} />;
}

function renderEditor(value = [{ type: 'required' }]) {
    const onChange = vi.fn();
    const utils = render(<Harness initial={value} onChange={onChange} />);
    const last = () => onChange.mock.calls.at(-1)?.[0];
    return { onChange, last, ...utils };
}

describe('ValidationRuleEditor — server contract', () => {
    it('every rule type the menu offers is saveable the moment it is picked', () => {
        const { last, getByLabelText } = renderEditor();
        const select = getByLabelText('Rule 1 type');
        const offered = Array.from(select.options).map((o) => o.value);
        expect(offered.length).toBeGreaterThan(1);
        for (const kind of offered) {
            fireEvent.change(select, { target: { value: kind } });
            expect(saveErrors(last()), `rule type ${kind}`).toEqual([]);
        }
    });

    it('a bound with no native rule type compiles to a formula over `value`', () => {
        const { last, getByLabelText } = renderEditor();
        fireEvent.change(getByLabelText('Rule 1 type'), { target: { value: 'maxLength' } });
        fireEvent.change(getByLabelText('Rule 1 value'), { target: { value: '20' } });
        expect(last()[0]).toEqual({ type: 'formula', expr: 'len(value) <= 20' });
        expect(saveErrors(last())).toEqual([]);
    });

    it('reads that formula back as its own menu entry (round trip)', () => {
        const { getByLabelText } = renderEditor([{ type: 'formula', expr: 'number(value) >= 3' }]);
        expect(getByLabelText('Rule 1 type').value).toBe('min');
        expect(getByLabelText('Rule 1 value').value).toBe('3');
    });

    it('named formats keep their own entries', () => {
        const { last, getByLabelText } = renderEditor();
        fireEvent.change(getByLabelText('Rule 1 type'), { target: { value: 'email' } });
        expect(last()[0].type).toBe('format');
        expect(last()[0].format).toBe('email');
    });

    it('editing a legacy rule the old editor wrote rewrites it into an accepted shape', () => {
        // { type: 'min' } was offered but rejected — touching the row must not
        // carry that type through.
        const legacy = [{ type: 'min', value: 1, message: 'Too low.' }];
        expect(saveErrors(legacy).some((e) => e.code === 'validation.type_invalid')).toBe(true);

        const { last, getByLabelText } = renderEditor(legacy);
        expect(getByLabelText('Rule 1 type').value).toBe('min');
        fireEvent.change(getByLabelText('Rule 1 value'), { target: { value: '2' } });
        expect(last()[0]).toEqual({ type: 'formula', expr: 'number(value) >= 2', message: 'Too low.' });
        expect(saveErrors(last())).toEqual([]);
    });
});
