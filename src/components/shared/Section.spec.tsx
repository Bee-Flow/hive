import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Section from './Section';

describe('Section', () => {
    it('renders title, description, actions, and children', () => {
        render(
            <Section
                title="Billing"
                description="Per-org spend"
                actions={<button>Refresh</button>}
            >
                <p>body</p>
            </Section>,
        );
        expect(screen.getByRole('heading', { name: 'Billing' })).toBeInTheDocument();
        expect(screen.getByText('Per-org spend')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
        expect(screen.getByText('body')).toBeInTheDocument();
    });

    it('omits the header when no title/description/actions are provided', () => {
        const { container } = render(<Section><p>only body</p></Section>);
        expect(container.querySelector('header')).toBeNull();
        expect(screen.getByText('only body')).toBeInTheDocument();
    });
});
