import React, { useEffect } from 'react';

/**
 * Mounts a single IntersectionObserver that promotes any `.reveal` element
 * to `.visible` once it enters the viewport. Call once at the page root.
 */
export function useScrollReveal(rootRef) {
    useEffect(() => {
        const root = rootRef?.current || document;
        const elements = root.querySelectorAll('.reveal:not(.visible)');
        if (!elements.length) return;

        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            }
        }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });

        elements.forEach(el => observer.observe(el));
        return () => observer.disconnect();
    });
}

export default function ScrollReveal({ delay = 0, children, className = '' }) {
    const delayClass = delay > 0 ? `reveal-delay-${Math.min(delay, 6)}` : '';
    return <div className={`reveal ${delayClass} ${className}`.trim()}>{children}</div>;
}
