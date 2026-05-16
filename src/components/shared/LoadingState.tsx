import React from 'react';
import Spinner from './Spinner';

/**
 * LoadingState — render-prop wrapper around the recurring
 *   { loading, error, data } / { isLoading, error, data }
 * branching pattern.
 *
 *   {loading && <Spinner />}
 *   {error && <ErrorBanner />}
 *   {!loading && !error && <Content />}
 *
 * Use this when the inner content has nothing useful to show until both
 * branches resolve. For fetches that should reveal partial data while
 * refetching, prefer rendering the spinner inline instead.
 */

export interface LoadingStateProps {
    loading: boolean;
    error?: unknown;
    /** Optional override for the loading view. Defaults to a centered spinner. */
    loadingFallback?: React.ReactNode;
    /** Optional renderer for the error view. Receives the error verbatim. */
    errorFallback?: (error: unknown) => React.ReactNode;
    children: React.ReactNode;
}

function defaultErrorFallback(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? 'Something went wrong');
    return (
        <div
            role="alert"
            className="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300"
        >
            {message}
        </div>
    );
}

export default function LoadingState({
    loading,
    error,
    loadingFallback,
    errorFallback = defaultErrorFallback,
    children,
}: LoadingStateProps) {
    if (loading) {
        return (
            <>
                {loadingFallback ?? (
                    <div className="flex items-center justify-center py-8">
                        <Spinner size="md" label="Loading" />
                    </div>
                )}
            </>
        );
    }
    if (error) return <>{errorFallback(error)}</>;
    return <>{children}</>;
}
