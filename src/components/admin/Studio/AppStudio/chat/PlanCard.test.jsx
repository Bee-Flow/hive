import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlanCard from './PlanCard';

const PLAN = {
    planId: 'pl-1',
    plan: {
        title: 'Project tracker',
        summary: 'Tracks projects and tasks',
        tables: [{ name: 'Tasks', fields: [{ name: 'status', type: 'text' }, { name: 'due', type: 'date' }] }],
        roles: [{ name: 'Admin' }],
        datasets: [{ name: 'By status' }],
        screens: [{ name: 'Dashboard', purpose: 'Overview' }],
        openQuestions: ['Should technicians see all tasks or only their own?'],
        phases: [{ label: 'Data model', covers: ['Tasks'] }],
    },
};

describe('PlanCard', () => {
    it('renders every section plus the open questions', () => {
        render(<PlanCard pendingPlan={PLAN} onBuild={vi.fn()} onDiscuss={vi.fn()} />);
        expect(screen.getByText('Screens')).toBeInTheDocument();
        expect(screen.getByText('Data')).toBeInTheDocument();
        expect(screen.getByText('Roles')).toBeInTheDocument();
        expect(screen.getByText('Datasets')).toBeInTheDocument();
        expect(screen.getByText(/technicians see all tasks/i)).toBeInTheDocument();
    });

    it('edits a field then Build it approves the EDITED artifact', () => {
        const onBuild = vi.fn();
        render(<PlanCard pendingPlan={PLAN} onBuild={onBuild} onDiscuss={vi.fn()} />);

        // Rename the "status" field to "state".
        const field = screen.getByDisplayValue('status');
        fireEvent.change(field, { target: { value: 'state' } });

        fireEvent.click(screen.getByText('Build it'));

        expect(onBuild).toHaveBeenCalledTimes(1);
        const edited = onBuild.mock.calls[0][0];
        expect(edited.tables[0].fields[0].name).toBe('state');
        // Untouched slices ride along unchanged.
        expect(edited.tables[0].fields[1].name).toBe('due');
        expect(edited.phases).toEqual(PLAN.plan.phases);
    });

    it('adds and removes rows before approving', () => {
        const onBuild = vi.fn();
        render(<PlanCard pendingPlan={PLAN} onBuild={onBuild} onDiscuss={vi.fn()} />);

        // Add a role via its inline form.
        const addRole = screen.getByPlaceholderText('Add role');
        fireEvent.change(addRole, { target: { value: 'Technician' } });
        fireEvent.keyDown(addRole, { key: 'Enter' });

        // Remove the "By status" dataset.
        fireEvent.click(screen.getByLabelText('Remove By status'));

        fireEvent.click(screen.getByText('Build it'));
        const edited = onBuild.mock.calls[0][0];
        expect(edited.roles.map((r) => r.name)).toEqual(['Admin', 'Technician']);
        expect(edited.datasets).toEqual([]);
    });

    it('Discuss focuses the composer, not a build', () => {
        const onBuild = vi.fn();
        const onDiscuss = vi.fn();
        render(<PlanCard pendingPlan={PLAN} onBuild={onBuild} onDiscuss={onDiscuss} />);
        fireEvent.click(screen.getByText('Discuss'));
        expect(onDiscuss).toHaveBeenCalledTimes(1);
        expect(onBuild).not.toHaveBeenCalled();
    });

    it('keeps a half-typed "Add field" with its own table when another table is deleted', () => {
        const onBuild = vi.fn();
        const twoTables = {
            planId: 'pl-3',
            plan: {
                ...PLAN.plan,
                tables: [
                    { name: 'Tasks', fields: [{ name: 'status', type: 'text' }] },
                    { name: 'People', fields: [{ name: 'email', type: 'text' }] },
                ],
            },
        };
        render(<PlanCard pendingPlan={twoTables} onBuild={onBuild} onDiscuss={vi.fn()} />);

        // Start adding a field to the SECOND table, then delete the first one.
        const addField = screen.getAllByPlaceholderText('Add field');
        fireEvent.change(addField[1], { target: { value: 'phone' } });
        fireEvent.click(screen.getByLabelText('Remove Tasks'));

        // The surviving table keeps its own (empty) add box — the typed text
        // must not slide up from the deleted row.
        const remaining = screen.getAllByPlaceholderText('Add field');
        expect(remaining).toHaveLength(1);
        expect(remaining[0]).toHaveValue('phone');
        expect(screen.getByDisplayValue('People')).toBeInTheDocument();

        // …and committing it lands on the table the user was typing under.
        fireEvent.keyDown(remaining[0], { key: 'Enter' });
        fireEvent.click(screen.getByText('Build it'));
        const edited = onBuild.mock.calls[0][0];
        expect(edited.tables.map((t) => t.name)).toEqual(['People']);
        expect(edited.tables[0].fields.map((f) => f.name)).toEqual(['email', 'phone']);
    });

    it('re-seeds when a new plan (different planId) arrives', () => {
        const { rerender } = render(<PlanCard pendingPlan={PLAN} onBuild={vi.fn()} onDiscuss={vi.fn()} />);
        expect(screen.getByDisplayValue('Project tracker')).toBeInTheDocument();

        rerender(<PlanCard
            pendingPlan={{ planId: 'pl-2', plan: { title: 'Ticket system', tables: [], roles: [], datasets: [], screens: [] } }}
            onBuild={vi.fn()}
            onDiscuss={vi.fn()}
        />);
        expect(screen.getByDisplayValue('Ticket system')).toBeInTheDocument();
    });
});
