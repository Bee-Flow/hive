import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StudioShell from './StudioShell';

describe('StudioShell', () => {
    it('renders sidebar title, actions, sidebar body, and main content', () => {
        render(
            <StudioShell
                sidebarTitle="Skills"
                sidebarActions={<button>New</button>}
                sidebar={<div data-testid="list">items</div>}
            >
                <div data-testid="detail">detail</div>
            </StudioShell>,
        );
        expect(screen.getByText('Skills')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
        expect(screen.getByTestId('list')).toBeInTheDocument();
        expect(screen.getByTestId('detail')).toBeInTheDocument();
    });

    it('omits the header bar when neither title nor actions are given', () => {
        const { container } = render(
            <StudioShell sidebar={<div>items</div>}>
                <div>detail</div>
            </StudioShell>,
        );
        // The sidebar header is the only <header> the shell renders.
        expect(container.querySelector('aside > header')).toBeNull();
    });
});
