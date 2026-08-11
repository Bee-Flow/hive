import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AppRenderer from './AppRenderer';

/**
 * View-as-role preview: AppRenderer hides screens/nodes gated away from the
 * active previewRole and evaluates formulas against previewUser. Additive — no
 * previewRole reproduces today's behaviour exactly.
 */

function defWith(children, screenExtra = {}) {
    return {
        schemaVersion: 2,
        meta: { name: 'Test app', description: '', icon: 'LayoutGrid' },
        theme: { primary: '#0F766E', radius: 'md', density: 'comfortable', fontScale: 'md', appearance: 'auto' },
        homeScreenId: 'scr_t',
        roles: [{ id: 'admin', name: 'Admin' }, { id: 'member', name: 'Member' }],
        screens: [{
            id: 'scr_t', name: 'T', icon: null, showInNav: true, maxWidth: 'medium',
            sections: [{ id: 'sec_t', style: { padding: 4, gap: 3, background: 'none' }, children }],
            ...screenExtra,
        }],
        actions: {},
    };
}

const render1 = (def, props = {}) => render(<AppRenderer definition={def} screenId="scr_t" {...props} />);

const GATED = [
    { id: 'cmp_admin', type: 'heading', visible: true, visibleToRoles: ['admin'], props: { text: 'Admin only', level: 2 }, style: { span: 12 } },
    { id: 'cmp_all', type: 'heading', visible: true, props: { text: 'Everyone', level: 2 }, style: { span: 12 } },
];

describe('AppRenderer — role-gated node filtering', () => {
    it('shows every node when no previewRole is set (default behaviour)', () => {
        const { getByText } = render1(defWith(GATED), { mode: 'edit' });
        expect(getByText('Admin only')).toBeTruthy();
        expect(getByText('Everyone')).toBeTruthy();
    });

    it('hides a node gated away from the previewed role', () => {
        const { queryByText, getByText } = render1(defWith(GATED), { mode: 'edit', previewRole: 'member' });
        expect(queryByText('Admin only')).toBeNull();
        expect(getByText('Everyone')).toBeTruthy(); // ungated = visible to all
    });

    it('shows a role-gated node for the allowed role', () => {
        const { getByText } = render1(defWith(GATED), { mode: 'edit', previewRole: 'admin' });
        expect(getByText('Admin only')).toBeTruthy();
        expect(getByText('Everyone')).toBeTruthy();
    });

    it('the owner sentinel disables gating (full view)', () => {
        const { getByText } = render1(defWith(GATED), { mode: 'edit', previewRole: 'owner' });
        expect(getByText('Admin only')).toBeTruthy();
    });
});

describe('AppRenderer — role-gated screen', () => {
    const def = defWith(
        [{ id: 'cmp_x', type: 'heading', visible: true, props: { text: 'Screen body', level: 2 }, style: { span: 12 } }],
        { visibleToRoles: ['admin'] },
    );

    it('renders a notice instead of the screen when the role cannot see it', () => {
        const { container, queryByText } = render1(def, { mode: 'edit', previewRole: 'member' });
        expect(queryByText('Screen body')).toBeNull();
        expect(container.querySelector('[data-app-screen-role-hidden]')).toBeTruthy();
    });

    it('renders the screen normally for the allowed role', () => {
        const { container, getByText } = render1(def, { mode: 'edit', previewRole: 'admin' });
        expect(getByText('Screen body')).toBeTruthy();
        expect(container.querySelector('[data-app-screen-role-hidden]')).toBeNull();
    });
});

describe('AppRenderer — previewUser feeds formulas', () => {
    const def = defWith([
        { id: 'cmp_f', type: 'heading', visible: true, visibleWhen: 'currentUser.role == "admin"', props: { text: 'Hi admin', level: 2 }, style: { span: 12 } },
    ]);

    it('evaluates visibleWhen against the preview user (matching role → visible)', () => {
        const { getByText } = render1(def, { mode: 'run', previewRole: 'admin', currentUser: { id: 'p', role: 'admin' } });
        expect(getByText('Hi admin')).toBeTruthy();
    });

    it('hides when the preview user role does not match', () => {
        const { queryByText } = render1(def, { mode: 'run', previewRole: 'member', currentUser: { id: 'p', role: 'member' } });
        expect(queryByText('Hi admin')).toBeNull();
    });
});
