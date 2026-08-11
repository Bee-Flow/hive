import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AppInputTextarea, { activeToken, matchSnippets } from './AppInputTextarea';
import AppForm from './AppForm';
import { RuntimeProvider, DEFAULT_RUNTIME } from '../RuntimeContext';

/**
 * Slash snippets in the reply box.
 *
 * The saved-reply table shipped with a "shortcut" column that nothing read: the
 * only way to use a reply was a modal three clicks away. Typing "/" is what
 * everybody means by a shortcut, so that is what it now does.
 */

const REPLIES = [
    { id: '1', title: 'Refund started', shortcut: '/refund', body: 'We have started your refund.' },
    { id: '2', title: 'Could you send a photo?', shortcut: '/foto', body: 'Could you send a photo?' },
    { id: '3', title: 'Thanks', shortcut: '/dank', body: 'Thanks for letting us know.' },
];

function renderBox(props = {}, mode = 'run') {
    const node = {
        id: 'cmp_t', type: 'input_textarea',
        props: {
            name: 'body', label: 'Your reply', rows: 4,
            snippets: { kind: 'static', value: REPLIES },
            snippetKey: 'shortcut', snippetBody: 'body', snippetLabel: 'title',
            ...props,
        },
        style: { span: 12 },
    };
    const formNode = {
        id: 'cmp_form', type: 'form', visible: true,
        props: { name: 'reply', submitLabel: 'Send', showReset: false },
        style: { span: 12, gap: 3, padding: 0 },
        children: [node],
    };
    const utils = render(
        <RuntimeProvider value={{ ...DEFAULT_RUNTIME, mode }}>
            <AppForm node={formNode}><AppInputTextarea node={node} /></AppForm>
        </RuntimeProvider>,
    );
    const area = utils.container.querySelector('textarea');
    const type = (text) => {
        fireEvent.change(area, { target: { value: text, selectionStart: text.length } });
        fireEvent.keyUp(area, { target: { value: text, selectionStart: text.length } });
    };
    return { ...utils, area, type };
}

describe('activeToken', () => {
    it('finds a slash token at a word boundary', () => {
        expect(activeToken('/ref', 4)).toEqual({ start: 0, term: 'ref' });
        expect(activeToken('Hallo /ref', 10)).toEqual({ start: 6, term: 'ref' });
    });

    it('ignores a slash inside a word — a URL is not a shortcut', () => {
        expect(activeToken('https://x.nl/foo', 16)).toBeNull();
        expect(activeToken('6/8/2026', 8)).toBeNull();
    });

    it('closes once the token ends', () => {
        expect(activeToken('/ref done', 9)).toBeNull();
    });
});

describe('matchSnippets', () => {
    it('matches the shortcut by prefix and the title anywhere', () => {
        expect(matchSnippets(REPLIES, 'ref', { keyField: 'shortcut', labelField: 'title' })
            .map((r) => r.id)).toEqual(['1']);
        expect(matchSnippets(REPLIES, 'photo', { keyField: 'shortcut', labelField: 'title' })
            .map((r) => r.id)).toEqual(['2']);
    });

    it('a bare slash offers everything', () => {
        expect(matchSnippets(REPLIES, '', { keyField: 'shortcut', labelField: 'title' })).toHaveLength(3);
    });
});

describe('AppInputTextarea snippets', () => {
    it('opens on / and narrows as you type', () => {
        const { type, container, getByText } = renderBox();
        type('/');
        expect(container.querySelector('[data-app-snippets]')).toBeTruthy();
        expect(getByText('Refund started')).toBeTruthy();

        type('/ref');
        const items = container.querySelectorAll('[data-app-snippets] button');
        expect(items).toHaveLength(1);
    });

    it('inserting replaces the /token — the shortcut must not reach the customer', () => {
        const { type, container, area } = renderBox();
        type('Hallo /ref');
        fireEvent.mouseDown(container.querySelector('[data-app-snippets] button'));
        expect(area.value).toBe('Hallo We have started your refund.');
        expect(container.querySelector('[data-app-snippets]')).toBeNull();
    });

    it('Escape closes it and leaves the text alone', () => {
        const { type, container, area } = renderBox();
        type('/ref');
        fireEvent.keyDown(area, { key: 'Escape' });
        expect(container.querySelector('[data-app-snippets]')).toBeNull();
        expect(area.value).toBe('/ref');
    });

    it('stays shut with no snippets bound', () => {
        const { type, container } = renderBox({ snippets: { kind: 'static', value: null } });
        type('/');
        expect(container.querySelector('[data-app-snippets]')).toBeNull();
    });

    it('never opens while designing', () => {
        const { type, container } = renderBox({}, 'edit');
        type('/');
        expect(container.querySelector('[data-app-snippets]')).toBeNull();
    });
});
