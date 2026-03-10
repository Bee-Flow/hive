import React, { useState, useEffect, useRef } from 'react';

/**
 * Shows a loading indicator while an html-app is being built.
 * Uses AI to describe what's being built from partial code.
 */
const BuildingIndicator = ({ code, language }) => {
    const [description, setDescription] = useState('Starting build...');
    const [isLoading, setIsLoading] = useState(true);
    const lastCodeEndRef = useRef('');
    const debounceRef = useRef(null);
    const lastFetchTimeRef = useRef(0);

    useEffect(() => {
        // Need at least some code to analyze
        if (!code || code.length < 50) return;

        // Check if the END of the code has changed (what's currently being rendered)
        const codeEnd = code.slice(-200);
        if (codeEnd === lastCodeEndRef.current) return;

        // Clear previous debounce
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Calculate time since last fetch - enforce 2 second minimum
        const now = Date.now();
        const timeSinceLastFetch = now - lastFetchTimeRef.current;
        const minInterval = 2000; // 2 seconds
        const delay = Math.max(200, minInterval - timeSinceLastFetch);

        // Fetch after delay
        debounceRef.current = setTimeout(async () => {
            lastCodeEndRef.current = codeEnd;
            lastFetchTimeRef.current = Date.now();

            try {
                const response = await fetch(`/agents/describe-building`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ code, language })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.description) {
                        setDescription(data.description);
                        setIsLoading(false);
                    }
                }
            } catch (error) {
                console.error('[BuildingIndicator] Error:', error);
            }
        }, delay);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [code, language]);

    return (
        <div
            className="my-3 flex items-center gap-3 p-4 rounded-xl animate-fade-in"
            style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
                border: '1px solid var(--border-default)'
            }}
        >
            <div
                className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin shrink-0"
                style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}
            />
            <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    Rendering application...
                </span>
                <span
                    className="text-xs truncate"
                    style={{ color: 'var(--text-muted)' }}
                    title={description}
                >
                    {isLoading ? (
                        <span className="animate-pulse-slow">Analyzing code...</span>
                    ) : (
                        description
                    )}
                </span>
            </div>
        </div>
    );
};

export default BuildingIndicator;
