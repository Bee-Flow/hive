import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingState from './LoadingState';

describe('LoadingState', () => {
    it('renders the spinner fallback while loading and hides the children', () => {
        render(
            <LoadingState loading>
                <div>data</div>
            </LoadingState>,
        );
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.queryByText('data')).toBeNull();
    });

    it('renders the default error banner from an Error object', () => {
        render(
            <LoadingState loading={false} error={new Error('boom')}>
                <div>data</div>
            </LoadingState>,
        );
        expect(screen.getByRole('alert')).toHaveTextContent('boom');
        expect(screen.queryByText('data')).toBeNull();
    });

    it('renders children when loading is false and no error is present', () => {
        render(
            <LoadingState loading={false}>
                <div>data</div>
            </LoadingState>,
        );
        expect(screen.getByText('data')).toBeInTheDocument();
    });

    it('uses a custom errorFallback when supplied', () => {
        render(
            <LoadingState
                loading={false}
                error={new Error('x')}
                errorFallback={(e) => <p data-testid="custom">{(e as Error).message.toUpperCase()}</p>}
            >
                <div>data</div>
            </LoadingState>,
        );
        expect(screen.getByTestId('custom')).toHaveTextContent('X');
    });
});
