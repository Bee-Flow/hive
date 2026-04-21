import React from 'react';

// Minimal, brand-inspired SVG logos for each ticket source. Kept inline so no
// extra npm dependency or asset-loading round-trip is needed. These are
// stylised brand marks — close-enough to be recognisable without infringing
// on trademark fidelity.

const ProviderIcon = ({ provider, size = 20 }) => {
    const s = { width: size, height: size };
    switch (provider) {
        case 'gmail':
            return (
                <svg {...s} viewBox="0 0 48 48" fill="none">
                    <path d="M6 10L24 26L42 10" stroke="#EA4335" strokeWidth="3" fill="none" />
                    <rect x="4" y="8" width="40" height="32" rx="4" stroke="#4285F4" strokeWidth="2.5" fill="none" />
                    <path d="M4 12L24 28L44 12" stroke="#FBBC04" strokeWidth="2" fill="none" opacity="0.4" />
                </svg>
            );
        case 'outlook':
            return (
                <svg {...s} viewBox="0 0 48 48" fill="none">
                    <rect x="4" y="8" width="40" height="32" rx="4" stroke="#0078D4" strokeWidth="2.5" fill="none" />
                    <path d="M6 12L24 26L42 12" stroke="#0078D4" strokeWidth="2.5" fill="none" />
                </svg>
            );
        case 'jira':
            return (
                <svg {...s} viewBox="0 0 48 48" fill="none">
                    <path d="M24 4L44 24L34 34L24 24L14 34L4 24z" fill="#2684FF" />
                    <path d="M24 14L34 24L24 34L14 24z" fill="#0052CC" />
                </svg>
            );
        case 'servicenow':
            return (
                <svg {...s} viewBox="0 0 48 48" fill="none">
                    <circle cx="24" cy="24" r="20" fill="#62D84E" />
                    <path d="M24 10C16 10 11 15 11 22c0 4 2 7 5 9-1 1-2 3-2 5 0 3 3 5 10 5s10-2 10-5c0-2-1-4-2-5 3-2 5-5 5-9 0-7-5-12-13-12z" fill="white" />
                    <circle cx="24" cy="22" r="6" fill="#62D84E" />
                </svg>
            );
        case 'zendesk':
            return (
                <svg {...s} viewBox="0 0 48 48" fill="none">
                    <path d="M4 14L24 36V14H4z" fill="#03363D" />
                    <path d="M28 14C28 19 31 23 36 23S44 19 44 14h-16z" fill="#03363D" />
                    <path d="M4 38C4 32 8 28 14 28S24 32 24 38H4z" fill="#17494D" />
                    <path d="M28 38L44 14v24H28z" fill="#17494D" />
                </svg>
            );
        case 'freshservice':
            return (
                <svg {...s} viewBox="0 0 48 48" fill="none">
                    <rect x="4" y="4" width="40" height="40" rx="10" fill="#25C16F" />
                    <path d="M16 14l16 10-16 10V14z" fill="white" />
                    <circle cx="34" cy="24" r="3" fill="white" />
                </svg>
            );
        case 'topdesk':
            return (
                <svg {...s} viewBox="0 0 48 48" fill="none">
                    <rect x="4" y="4" width="40" height="40" rx="4" fill="#00B1B0" />
                    <path d="M10 14h28v4H26v20h-4V18H10v-4z" fill="white" />
                </svg>
            );
        default:
            return (
                <svg {...s} viewBox="0 0 48 48" fill="none">
                    <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="2.5" fill="none" />
                </svg>
            );
    }
};

export default ProviderIcon;
