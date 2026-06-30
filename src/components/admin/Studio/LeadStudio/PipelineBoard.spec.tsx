import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// dnd-kit needs no real DnD for these structural tests; render children through.
vi.mock('@dnd-kit/core', () => ({
    DndContext: ({ children }: any) => <div>{children}</div>,
    DragOverlay: ({ children }: any) => <div>{children}</div>,
    PointerSensor: function () {},
    useSensor: () => ({}),
    useSensors: () => [],
    useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, isDragging: false }),
    useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
    closestCorners: () => [],
}));

import PipelineBoard from './PipelineBoard';

const t = (_k: string, fb?: string) => fb || _k;
const leads = [
    { id: 'l1', companyName: 'Acme BV', ownerName: 'Jan', status: 'new', dealValue: 5000, hotnessScore: 80 },
    { id: 'l2', companyName: 'Beta NV', status: 'contacted' },
    { id: 'l3', companyName: 'Gamma', status: 'qualified', dealValue: 12000 },
];
const pipeline = { stages: { new: { count: 1, value: 5000 }, qualified: { count: 1, value: 12000 } }, totalValue: 17000 };

describe('PipelineBoard', () => {
    it('renders a column per stage and places cards by status', () => {
        render(<PipelineBoard leads={leads as any} tasks={[]} pipeline={pipeline as any} t={t} />);
        // 5 stage headers
        ['Nieuw', 'Benaderd', 'Gekwalificeerd', 'Gewonnen', 'Afgewezen'].forEach(s => expect(screen.getByText(s)).toBeInTheDocument());
        // cards present
        expect(screen.getByText('Acme BV')).toBeInTheDocument();
        expect(screen.getByText('Gamma')).toBeInTheDocument();
    });

    it('shows the pipeline value total and a hotness score', () => {
        render(<PipelineBoard leads={leads as any} tasks={[]} pipeline={pipeline as any} t={t} />);
        expect(screen.getByText(/Pijplijnwaarde/)).toBeInTheDocument();
        expect(screen.getByText('80')).toBeInTheDocument(); // hotness chip
    });

    it('opens a lead when its card is clicked', () => {
        const onOpenLead = vi.fn();
        render(<PipelineBoard leads={leads as any} tasks={[]} pipeline={pipeline as any} onOpenLead={onOpenLead} t={t} />);
        fireEvent.click(screen.getByText('Acme BV'));
        expect(onOpenLead).toHaveBeenCalledWith(leads[0]);
    });

    it('requests the AI digest when Dagfocus is opened', () => {
        const onDigest = vi.fn();
        render(<PipelineBoard leads={leads as any} tasks={[]} pipeline={pipeline as any} onDigest={onDigest} t={t} />);
        fireEvent.click(screen.getByRole('button', { name: /Dagfocus/ }));
        expect(onDigest).toHaveBeenCalled();
    });
});
