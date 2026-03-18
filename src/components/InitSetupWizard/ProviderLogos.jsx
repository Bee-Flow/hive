import React from 'react';

// ─── AI Provider Logos ──────────────────────────────────────────

export const AzureOpenAILogo = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
        <defs>
            <linearGradient id="azure-a" x1="58.97" y1="7.41" x2="28.78" y2="88.39" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#114A8B" />
                <stop offset="1" stopColor="#0669BC" />
            </linearGradient>
            <linearGradient id="azure-b" x1="60.25" y1="44.05" x2="54.45" y2="46.17" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopOpacity="0.3" />
                <stop offset="0.07" stopOpacity="0.2" />
                <stop offset="1" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="azure-c" x1="37.28" y1="7.26" x2="70.96" y2="85.04" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#3CCBF4" />
                <stop offset="1" stopColor="#2892DF" />
            </linearGradient>
        </defs>
        <path d="M33.34 8h26.04L32.69 84.03a4.15 4.15 0 01-3.92 2.78H10.17a4.14 4.14 0 01-3.91-5.52L29.42 10.78A4.15 4.15 0 0133.34 8z" fill="url(#azure-a)" />
        <path d="M71.17 60.26H29.88a1.91 1.91 0 00-1.3 3.31l26.53 24.76a4.17 4.17 0 002.85 1.13h23.38z" fill="url(#azure-b)" />
        <path d="M33.34 8a4.12 4.12 0 00-3.95 2.88L6.24 81.37a4.14 4.14 0 003.94 5.44h19.05a4.56 4.56 0 003.49-2.88l4.67-13.14 16.83 15.64a4.2 4.2 0 002.72 1.03h23.41L66.14 60.26H37.49L59.38 8z" fill="url(#azure-c)" />
    </svg>
);

export const OpenAILogo = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.042 6.042 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" fill="#10A37F" />
    </svg>
);

export const GoogleAILogo = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
);

export const MistralLogo = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="5" height="5" fill="#F7D046" />
        <rect x="17" y="2" width="5" height="5" fill="#F7D046" />
        <rect x="2" y="9" width="5" height="5" fill="#F2A73B" />
        <rect x="10" y="9" width="5" height="5" fill="#F2A73B" />
        <rect x="17" y="9" width="5" height="5" fill="#F2A73B" />
        <rect x="2" y="17" width="5" height="5" fill="#EE792F" />
        <rect x="10" y="17" width="5" height="5" fill="#EE792F" />
        <rect x="17" y="17" width="5" height="5" fill="#EE792F" />
    </svg>
);

export const ClaudeLogo = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M16.98 8.15L12.85 19.06h-2.57l1.74-4.55-3.34-6.36h2.69l1.91 4.18h.07l1.93-4.18h2.5zM7.5 4.94L12 19.06H9.4L4.9 4.94h2.6z" fill="#D97757" />
    </svg>
);

// ─── Search Provider Logos ──────────────────────────────────────

export const BingLogo = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M5 3v14.1l4.2 2.4 7.5-3.6V12L10.6 9.4 9.2 16.1l-2.5-1.4V4.8L5 3z" fill="#008373" />
        <path d="M9.2 4.5l2.5 4.9L16.7 12v3.9L9.2 16.1V4.5z" fill="#00A98E" />
    </svg>
);

export const SerperLogo = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="10" cy="10" r="6" stroke="#6366F1" strokeWidth="2.5" fill="none" />
        <line x1="14.5" y1="14.5" x2="20" y2="20" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
);

// ─── SSO Logo ───────────────────────────────────────────────────

export const MicrosoftLogo = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 21 21" fill="none">
        <rect x="1" y="1" width="9" height="9" fill="#F25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
        <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
        <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
);
