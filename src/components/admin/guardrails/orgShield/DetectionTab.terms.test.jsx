/**
 * The two exception lists on the Detection tab.
 *
 * They pull in opposite directions and the tests reflect that: the custom
 * terms make the shield redact MORE and are validated against the same regex
 * engine the server uses; the allowlist makes it redact LESS and its whole
 * safety story is that matching is exact on a normalised form.
 *
 * Run: npx vitest run src/components/admin/guardrails/orgShield/DetectionTab.terms.test.jsx
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

import AllowTermsChips, { normaliseAllowValue } from './parts/AllowTermsChips';
import CustomTermsTable, { validateTerm } from './parts/CustomTermsTable';

const t = (key, fallback, params) => {
    let s = typeof fallback === 'string' ? fallback : key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, v);
    return s;
};

describe('normaliseAllowValue', () => {
    // Same fixtures as server/core/dlp/allowTerms.test.js — the client copy of
    // this rule must not drift from the one the runtime actually applies.
    it('strips case, punctuation and whitespace only', () => {
        expect(normaliseAllowValue('Coca-Cola')).toBe('cocacola');
        expect(normaliseAllowValue('  A.B.N. AMRO ')).toBe('abnamro');
        expect(normaliseAllowValue('---')).toBe('');
    });
});

describe('validateTerm', () => {
    it('accepts a literal without compiling it', () => {
        expect(validateTerm({ pattern: '[unclosed', type: 'literal' })).toBeNull();
    });

    it('reports the regex engine\'s own message for a bad pattern', () => {
        const err = validateTerm({ pattern: '[unclosed', type: 'regex' });
        expect(err).toBeTruthy();
        expect(err).toMatch(/character class|Invalid regular expression|Unterminated/i);
    });

    it('accepts a valid pattern', () => {
        expect(validateTerm({ pattern: 'KC-\\d{4}', type: 'regex' })).toBeNull();
    });

    it('refuses an empty or over-long pattern', () => {
        expect(validateTerm({ pattern: '', type: 'literal' })).toBeTruthy();
        expect(validateTerm({ pattern: 'x'.repeat(501), type: 'literal' })).toBeTruthy();
    });
});

describe('AllowTermsChips', () => {
    const renderChips = (terms = [], publicOrgs = true) => {
        const onChange = vi.fn();
        const onChangePublicOrgs = vi.fn();
        render(
            <AllowTermsChips
                terms={terms}
                onChange={onChange}
                publicOrgs={publicOrgs}
                onChangePublicOrgs={onChangePublicOrgs}
                readOnly={false}
                t={t}
            />,
        );
        return { onChange, onChangePublicOrgs };
    };

    it('adds a term on Enter', async () => {
        const user = userEvent.setup();
        const { onChange } = renderChips([]);
        await user.type(screen.getByLabelText(/Company, product or brand name/), 'OBS Techniek{Enter}');
        expect(onChange).toHaveBeenCalledWith(['OBS Techniek']);
    });

    it('refuses a normalised duplicate and says why', async () => {
        // "coca cola" against a listed "Coca-Cola" is otherwise a silent no-op
        // — the entry appears to be added and simply never matches.
        const user = userEvent.setup();
        const { onChange } = renderChips(['Coca-Cola']);
        await user.type(screen.getByLabelText(/Company, product or brand name/), 'coca cola{Enter}');
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(/already on the list/i);
    });

    it('states the exact-match rule where the admin will read it', async () => {
        renderChips([]);
        // The difference between allowlisting a brand and unredacting a client.
        expect(screen.getByText(/does NOT allow "Shell Advies BV"/i)).toBeInTheDocument();
    });

    it('removes a term', async () => {
        const user = userEvent.setup();
        const { onChange } = renderChips(['Microsoft', 'PostNL']);
        await user.click(screen.getByRole('button', { name: /Remove Microsoft/ }));
        expect(onChange).toHaveBeenCalledWith(['PostNL']);
    });

    it('exposes the public-brand switch with a name', () => {
        renderChips([]);
        expect(screen.getByRole('checkbox', { name: /well-known companies/i })).toBeChecked();
    });
});

describe('CustomTermsTable', () => {
    const renderTable = (terms = [], termErrors = []) => {
        const onChange = vi.fn();
        render(
            <CustomTermsTable terms={terms} onChange={onChange} termErrors={termErrors} readOnly={false} t={t} />,
        );
        return { onChange };
    };

    it('adds a new term as a literal by default', async () => {
        const user = userEvent.setup();
        const { onChange } = renderTable([]);
        await user.type(screen.getByLabelText(/Give it a name/), 'Codename{Enter}');
        expect(onChange).toHaveBeenCalledTimes(1);
        const [added] = onChange.mock.calls[0];
        expect(added[0]).toMatchObject({ label: 'Codename', type: 'literal', pattern: '' });
        expect(added[0].id).toBeTruthy();
    });

    it('refuses a duplicate name', async () => {
        const user = userEvent.setup();
        const { onChange } = renderTable([{ id: '1', label: 'Codename', pattern: 'X', type: 'literal' }]);
        await user.type(screen.getByLabelText(/Give it a name/), 'codename{Enter}');
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i);
    });

    it('flags an invalid regex inline, using the engine message', async () => {
        renderTable([{ id: '1', label: 'Bad', pattern: '[unclosed', type: 'regex' }]);
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('marks the row the server rejected on the last save', () => {
        // The server persists the valid terms and reports the rest, so this is
        // a partial success — the row has to say which one did not stick.
        renderTable(
            [{ id: 't9', label: 'Bad', pattern: 'ok', type: 'literal' }],
            [{ id: 't9', label: 'Bad', error: 'Invalid regular expression' }],
        );
        expect(screen.getByRole('alert')).toHaveTextContent(/Not saved/i);
    });
});
