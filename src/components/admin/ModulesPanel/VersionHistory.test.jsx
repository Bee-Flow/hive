import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const t = (key, a, b) => {
    const params = (a && typeof a === 'object') ? a : (b && typeof b === 'object' ? b : null);
    return params ? `${key} ${Object.values(params).join(' ')}` : key;
};
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t, locale: 'en' }) }));

import VersionHistory, { canRollback, mergeVersionRows } from './VersionHistory';

const ledger = (over = {}) => ({
    moduleId: 'pro',
    version: '1.0.0',
    status: 'retired',
    source: 'hub',
    prunedAt: null,
    hasPackageFile: true,
    installedAt: '2026-07-01T00:00:00Z',
    ...over,
});

describe('mergeVersionRows', () => {
    it('joins hub versions with ledger rows and appends ledger-only versions', () => {
        const rows = mergeVersionRows(
            [
                { version: '2.0.0', channel: 'stable', changelog: 'Big.', yanked: false },
                { version: '1.0.0', channel: 'stable', changelog: null, yanked: true },
            ],
            [ledger({ version: '2.0.0', status: 'active' }), ledger({ version: '0.9.0' })],
        );
        expect(rows.map((r) => r.version)).toEqual(['2.0.0', '1.0.0', '0.9.0']);
        expect(rows[0].ledger.status).toBe('active');
        expect(rows[1].yanked).toBe(true);
        expect(rows[1].ledger).toBeNull();
        expect(rows[2].ledger.status).toBe('retired');
    });

    it('tolerates missing inputs (v1 hub / uninstalled module)', () => {
        expect(mergeVersionRows(undefined, undefined)).toEqual([]);
        expect(mergeVersionRows(null, [ledger()])).toHaveLength(1);
    });
});

describe('canRollback gating', () => {
    it('only retired ledger rows WITH a package file are rollback candidates', () => {
        expect(canRollback({ ledger: ledger() })).toBe(true);
        expect(canRollback({ ledger: ledger({ hasPackageFile: false }) })).toBe(false);
        expect(canRollback({ ledger: ledger({ status: 'active' }) })).toBe(false);
        expect(canRollback({ ledger: ledger({ status: 'failed' }) })).toBe(false);
        expect(canRollback({ ledger: null })).toBe(false);
        expect(canRollback(null)).toBe(false);
    });
});

describe('VersionHistory rendering', () => {
    it('shows a rollback button only on retired rows with a package file', () => {
        const onRollback = vi.fn();
        render(
            <VersionHistory
                hubVersions={[{ version: '2.0.0', channel: 'stable' }, { version: '1.0.0', channel: 'beta' }]}
                ledgerVersions={[
                    ledger({ version: '2.0.0', status: 'active' }),
                    ledger({ version: '1.0.0' }),                             // retired + package → button
                    ledger({ version: '0.9.0', hasPackageFile: false }),      // retired, pruned → no button
                ]}
                onRollback={onRollback}
            />,
        );
        expect(screen.getByTestId('rollback-1.0.0')).toBeInTheDocument();
        expect(screen.queryByTestId('rollback-2.0.0')).toBeNull();
        expect(screen.queryByTestId('rollback-0.9.0')).toBeNull();

        screen.getByTestId('rollback-1.0.0').click();
        expect(onRollback).toHaveBeenCalledWith('1.0.0');
    });
});
