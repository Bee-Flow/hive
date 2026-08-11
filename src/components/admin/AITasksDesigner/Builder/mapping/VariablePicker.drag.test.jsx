import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VariablePicker from './VariablePicker';

/**
 * The picker's leaves are the ONLY drag source both builders share.
 *
 * Every field editor in the routine builder and in App Studio already accepts an
 * `application/x-binding-path` drop, but the sole element that ever produced one
 * was VariableTree's row — a panel App Studio never renders. Its drop handlers
 * (FormulaField, BindingField, TemplateField, PathField) were therefore dead
 * code there. These tests pin the leaf as a drag source so that stays true.
 */

const GROUPS = [
    {
        id: 'currentUser',
        label: 'Current user',
        kind: 'trigger',
        basePath: 'currentUser',
        fields: [
            { key: 'email', path: 'currentUser.email', sample: 'alex@example.com' },
            {
                key: 'org',
                path: 'currentUser.org',
                sample: { id: 'o1' },
                children: [{ key: 'id', path: 'currentUser.org.id', sample: 'o1' }],
            },
        ],
    },
];

/** A DataTransfer stub that records what the handler wrote. */
function makeDataTransfer() {
    const data = {};
    return {
        data,
        setData: vi.fn((type, value) => { data[type] = value; }),
        get effectAllowed() { return data.__effect; },
        set effectAllowed(v) { data.__effect = v; },
    };
}

function renderPicker(extra = {}) {
    const anchor = document.createElement('button');
    document.body.appendChild(anchor);
    return render(
        <VariablePicker open anchorEl={anchor} groups={GROUPS} onPick={() => {}} onClose={() => {}} {...extra} />,
    );
}

/** The clickable row for a leaf — the row's title is its full dotted path. */
function leafRow(path) {
    return document.querySelector(`[title="${path}"]`);
}

describe('VariablePicker — leaves are drag sources', () => {
    it('marks a leaf draggable', () => {
        renderPicker();
        expect(leafRow('currentUser.email')).toHaveAttribute('draggable');
    });

    it('a dragstart publishes the path under both MIME types', () => {
        renderPicker();
        const dataTransfer = makeDataTransfer();
        fireEvent.dragStart(leafRow('currentUser.email'), { dataTransfer });

        // text/plain matters as much as the binding type: a drop onto a control
        // with no binding handler still lands the bare path.
        expect(dataTransfer.data['application/x-binding-path']).toBe('currentUser.email');
        expect(dataTransfer.data['text/plain']).toBe('currentUser.email');
        expect(dataTransfer.effectAllowed).toBe('copy');
    });

    it('a nested child carries its own full path, not the parent’s', () => {
        renderPicker();
        // The popover is a portal, so it is not under the render container.
        // Expand the parent so the child renders.
        fireEvent.click(leafRow('currentUser.org').querySelector('[data-expand-btn]'));

        const dataTransfer = makeDataTransfer();
        fireEvent.dragStart(leafRow('currentUser.org.id'), { dataTransfer });

        expect(dataTransfer.data['application/x-binding-path']).toBe('currentUser.org.id');
    });

    it('dragging does not select the field — click still picks', () => {
        const onPick = vi.fn();
        renderPicker({ onPick });
        fireEvent.click(leafRow('currentUser.email'));
        expect(onPick).toHaveBeenCalledWith('currentUser.email');
    });

    it('renders the group and its leaves', () => {
        renderPicker();
        expect(screen.getByText('Current user')).toBeTruthy();
        expect(screen.getByText('email')).toBeTruthy();
    });
});
