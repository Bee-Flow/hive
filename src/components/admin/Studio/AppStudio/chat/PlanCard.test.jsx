import { createRequire } from 'node:module';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlanCard from './PlanCard';

/**
 * The approved artifact is BOUNDED server-side before the model ever sees it,
 * and that bounder keeps a fixed set of keys per list and drops any row missing
 * its identity one (tables/fields by `key`, roles by `key`, screens/datasets by
 * `name`). Asserting on what this card emits is therefore not enough — the card
 * used to emit `name` on all five, so its own tests passed while the server
 * discarded every rename and every added row. These run the real bounder.
 */
const require_ = createRequire(import.meta.url);
const { boundPlanArtifact } = require_('../../../../../../../server/appStudio/builderTools.js');
const approved = (plan) => boundPlanArtifact(plan).plan;

const PLAN = {
    planId: 'pl-1',
    plan: {
        title: 'Project tracker',
        summary: 'Tracks projects and tasks',
        // The shape the model actually emits, and the only one the bounder keeps.
        tables: [{ key: 'tasks', name: 'Tasks', fields: [{ key: 'status', type: 'text' }, { key: 'due', type: 'date' }] }],
        roles: [{ key: 'admin', label: 'Admin' }],
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
        // Through the real bounder: the rename SURVIVES to the server.
        expect(approved(edited).tables[0].fields.map((f) => f.key)).toEqual(['state', 'due']);
        // Untouched slices ride along unchanged.
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
        // The added role survives bounding — it used to be dropped for having
        // no key, and the app was built with only the roles the model wrote.
        expect(approved(edited).roles.map((r) => r.label)).toEqual(['Admin', 'Technician']);
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
                    { key: 'tasks', name: 'Tasks', fields: [{ key: 'status', type: 'text' }] },
                    { key: 'people', name: 'People', fields: [{ key: 'email', type: 'text' }] },
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
        expect(approved(edited).tables.map((t) => t.name)).toEqual(['People']);
        expect(approved(edited).tables[0].fields.map((f) => f.key)).toEqual(['email', 'phone']);
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

/**
 * The exact way the edits were lost: the card wrote `name` on tables, fields
 * and roles, and the bounder keeps those lists by `key` (dropping any row
 * without one) and reads a role's human name from `label`. So a rename did
 * nothing and an added row vanished — silently, because the card still showed
 * the edit and the build simply used the model's own plan.
 */
describe('PlanCard — every edit survives the server-side bounding', () => {
    const build = (plan) => {
        const onBuild = vi.fn();
        render(<PlanCard pendingPlan={plan} onBuild={onBuild} onDiscuss={vi.fn()} />);
        return { onBuild, approve: () => { fireEvent.click(screen.getByText('Build it')); return approved(onBuild.mock.calls[0][0]); } };
    };

    it('an added table reaches the server', () => {
        const { approve } = build(PLAN);
        const add = screen.getByPlaceholderText('Add table');
        fireEvent.change(add, { target: { value: 'Invoices' } });
        fireEvent.keyDown(add, { key: 'Enter' });
        expect(approve().tables.map((t) => t.name)).toEqual(['Tasks', 'Invoices']);
    });

    it('a renamed role reaches the server', () => {
        const { approve } = build(PLAN);
        fireEvent.change(screen.getByDisplayValue('Admin'), { target: { value: 'Owner' } });
        expect(approve().roles.map((r) => r.label)).toEqual(['Owner']);
    });

    it('a renamed table reaches the server', () => {
        const { approve } = build(PLAN);
        fireEvent.change(screen.getByDisplayValue('Tasks'), { target: { value: 'Jobs' } });
        expect(approve().tables.map((t) => t.name)).toEqual(['Jobs']);
    });

    /**
     * A table the model emitted WITHOUT a key would be dropped by the bounder
     * whatever the user did to it — so renaming one mints a key rather than
     * letting the edit take the whole table down with it.
     */
    it('renaming a keyless table gives it one instead of losing it', () => {
        const keyless = { planId: 'pl-k', plan: { ...PLAN.plan, tables: [{ name: 'Tasks', fields: [] }] } };
        const { approve } = build(keyless);
        fireEvent.change(screen.getByDisplayValue('Tasks'), { target: { value: 'Jobs' } });
        const out = approve();
        expect(out.tables.map((t) => t.name)).toEqual(['Jobs']);
        expect(out.tables[0].key).toBeTruthy();
    });
});
