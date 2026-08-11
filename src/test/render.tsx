// Shared render helpers for tests that need app providers.
//
// Replaces the per-file `withClient(children)` wrappers that each re-created a
// retry-disabled QueryClient (e.g. hooks/*.spec.tsx).
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** A QueryClient with retries disabled — deterministic for tests. */
export function makeTestQueryClient(): QueryClient {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

/** Wrap UI in a fresh retry-disabled QueryClientProvider. */
export function withQueryClient(ui: React.ReactNode): React.ReactElement {
    return <QueryClientProvider client={makeTestQueryClient()}>{ui}</QueryClientProvider>;
}

/** render() the UI already wrapped in a QueryClientProvider. */
export function renderWithClient(ui: React.ReactElement, options?: RenderOptions) {
    return render(withQueryClient(ui), options);
}
