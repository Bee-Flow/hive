import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import AppRenderer from '../AppRenderer';
import { dataCacheKey } from '../resolveBinding';

/**
 * Every bound data component, with its fetch FAILED.
 *
 * They all used to read `{ value, isLoading }` and drop `error`, so a viewer
 * whose connector was not linked — or whose request 500'd — was told their
 * mailbox was empty. They share one error state now, and this is what keeps
 * them sharing it: a table-driven pass over the whole set, so a component that
 * quietly stops reading `error` fails here rather than in front of a user.
 *
 * (It also catches the cheaper failure: AppKeyValue rendered <ErrorText/>
 * without importing it, which is a crash on the error path and invisible on
 * every other one.)
 */

vi.mock('@dnd-kit/core', async () => {
    const actual = await vi.importActual('@dnd-kit/core');
    return actual;
});

const BINDING = { kind: 'records', tableId: 'tbl_x', limit: 50 };
const ERROR_MESSAGE = 'Connect Gmail in Settings → Integrations to load this.';
const dataState = {
    [dataCacheKey(BINDING)]: { status: 'error', error: ERROR_MESSAGE, tableId: 'tbl_x' },
};

// One entry per component that resolves a binding and can therefore fail. The
// props are the minimum each needs to get past its own "not configured yet"
// guards and reach the fetch.
const CASES = [
    ['list', { source: BINDING, titleKey: 'title' }],
    ['table', { source: BINDING, columns: [{ key: 'title', label: 'Title', format: 'text' }], rowLimit: 10 }],
    ['data_grid', { source: BINDING, columns: [{ key: 'title', label: 'Title', format: 'text' }] }],
    ['keyValue', { source: BINDING, fields: [{ key: 'title', label: 'Title' }] }],
    ['record_detail', { source: BINDING, fields: [{ key: 'title', label: 'Title' }] }],
    ['stat', { value: BINDING, label: 'Open' }],
    ['timeline', { source: BINDING, titleKey: 'title', dateKey: 'at' }],
    ['badge_list', { source: BINDING, labelKey: 'title' }],
    ['message_thread', { source: BINDING, bodyKey: 'body', authorKey: 'who' }],
    ['file_gallery', { source: BINDING, nameKey: 'name' }],
    ['calendar', { source: BINDING, titleKey: 'title', dateKey: 'at' }],
    ['kanban', { source: BINDING, groupKey: 'status', titleKey: 'title' }],
    ['pivot', { source: BINDING, rowKey: 'a', valueKey: 'n', aggregate: 'sum' }],
    ['chart', { source: BINDING, chartType: 'bar', xKey: 'a', yKeys: ['n'] }],
];

function defWith(type, props) {
    return {
        schemaVersion: 2,
        meta: { name: 'T', description: '', icon: 'LayoutGrid' },
        theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' },
        homeScreenId: 'scr_t',
        screens: [{
            id: 'scr_t', name: 'T', icon: null, showInNav: true, maxWidth: 'medium',
            sections: [{
                id: 'sec_t', style: { padding: 4, gap: 3, background: 'none' },
                children: [{ id: 'cmp_x', type, visible: true, props, style: { span: 12 } }],
            }],
        }],
        actions: {},
    };
}

describe('a bound component whose fetch failed', () => {
    it.each(CASES)('%s says so instead of showing its empty state', (type, props) => {
        const { container } = render(
            <AppRenderer definition={defWith(type, props)} screenId="scr_t" mode="run" dataState={dataState} />,
        );
        expect(container.querySelector('[data-app-error="true"]')).toBeTruthy();
        expect(screen.getByText(ERROR_MESSAGE)).toBeTruthy();
        // The empty state must NOT also be on screen — "nothing here" next to
        // "this failed" is the ambiguity the whole change exists to remove.
        expect(screen.queryByText(/Nothing (here|to show) yet/i)).toBeNull();
    });

    // The typed connector failure gets its own headline, because the fix is the
    // viewer's to make and "this could not be loaded" does not say that.
    it('names a missing connection as a connection problem', () => {
        const key = dataCacheKey(BINDING);
        render(
            <AppRenderer
                definition={defWith('list', { source: BINDING, titleKey: 'title' })}
                screenId="scr_t"
                mode="run"
                dataState={{ [key]: { status: 'error', error: ERROR_MESSAGE, errorCode: 'connection_required', tableId: 'tbl_x' } }}
            />,
        );
        expect(screen.getByText('This needs a connection first.')).toBeTruthy();
    });
});
