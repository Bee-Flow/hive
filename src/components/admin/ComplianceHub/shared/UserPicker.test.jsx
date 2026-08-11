import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserPicker from './UserPicker';

const USERS = [
    { id: 'jan', displayName: 'Jan Janssen', email: 'jan@acme.nl', phone: '0611111111', orgRole: 'org_admin' },
    { id: 'zoe', displayName: 'Zoë de Vries', email: 'zoe@acme.nl', phone: null, orgRole: 'dpo' },
];

describe('UserPicker', () => {
    beforeEach(cleanup);

    it('renders nothing when the directory is unavailable or empty', () => {
        const { container: c1 } = render(
            <UserPicker users={null} mode="single" label="Pick" placeholder="Select…" onSelect={vi.fn()} />);
        expect(c1).toBeEmptyDOMElement();
        const { container: c2 } = render(
            <UserPicker users={[]} mode="single" label="Pick" placeholder="Select…" onSelect={vi.fn()} />);
        expect(c2).toBeEmptyDOMElement();
    });

    it('single mode: hands the full user object to onSelect', () => {
        const onSelect = vi.fn();
        render(<UserPicker users={USERS} mode="single" label="Pick" placeholder="Select…" onSelect={onSelect} />);
        const select = screen.getByRole('combobox');
        expect(screen.getByText('Jan Janssen — jan@acme.nl')).toBeInTheDocument();
        fireEvent.change(select, { target: { value: 'jan' } });
        expect(onSelect).toHaveBeenCalledWith(USERS[0]);
        expect(select.value).toBe('jan');
    });

    it('multi mode: resets the select after each pick', () => {
        const onSelect = vi.fn();
        render(<UserPicker users={USERS} mode="multi" label="Add" placeholder="Select…" onSelect={onSelect} />);
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'zoe' } });
        expect(onSelect).toHaveBeenCalledWith(USERS[1]);
        expect(select.value).toBe('');
    });

    it('multi mode: hides already-added recipients, case-insensitively', () => {
        render(<UserPicker users={USERS} mode="multi" label="Add" placeholder="Select…"
            excludeEmails={['JAN@ACME.NL']} onSelect={vi.fn()} />);
        expect(screen.queryByText('Jan Janssen — jan@acme.nl')).not.toBeInTheDocument();
        expect(screen.getByText('Zoë de Vries — zoe@acme.nl')).toBeInTheDocument();
    });

    it('multi mode: renders nothing once every member is already added', () => {
        const { container } = render(
            <UserPicker users={USERS} mode="multi" label="Add" placeholder="Select…"
                excludeEmails={['jan@acme.nl', 'zoe@acme.nl']} onSelect={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });
});
