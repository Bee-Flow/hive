import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Spinner from './Spinner';

describe('Spinner', () => {
    it('renders a status region so assistive tech announces loading', () => {
        render(<Spinner label="Loading agents" />);
        const status = screen.getByRole('status');
        expect(status).toBeInTheDocument();
        expect(screen.getByText('Loading agents')).toHaveClass('sr-only');
    });

    it('renders without an accessible label when none is provided', () => {
        render(<Spinner />);
        const status = screen.getByRole('status');
        expect(status).toBeInTheDocument();
        expect(status.querySelector('.sr-only')).toBeNull();
    });

    it('honours a custom color override on the spinning arc', () => {
        const { container } = render(<Spinner color="rgb(255, 0, 0)" />);
        const arc = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
        expect(arc.style.borderTopColor).toBe('rgb(255, 0, 0)');
    });
});
