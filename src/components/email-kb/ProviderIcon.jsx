import React from 'react';

const ProviderIcon = ({ provider, size = 20 }) => {
    if (provider === 'gmail') {
        return (
            <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
                <path d="M6 10L24 26L42 10" stroke="#EA4335" strokeWidth="3" fill="none" />
                <rect x="4" y="8" width="40" height="32" rx="4" stroke="#4285F4" strokeWidth="2.5" fill="none" />
                <path d="M4 12L24 28L44 12" stroke="#FBBC04" strokeWidth="2" fill="none" opacity="0.4" />
            </svg>
        );
    }
    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
            <rect x="4" y="8" width="40" height="32" rx="4" stroke="#0078D4" strokeWidth="2.5" fill="none" />
            <path d="M6 12L24 26L42 12" stroke="#0078D4" strokeWidth="2.5" fill="none" />
        </svg>
    );
};

export default ProviderIcon;
