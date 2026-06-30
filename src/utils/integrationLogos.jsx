import React from 'react';

/**
 * INTEGRATION_LOGOS — official brand SVGs per integration id, keyed in
 * underscore form ('google_drive') so they line up with INTEGRATION_META
 * in `integrationIcons.js` and the dispatcher / catalog ids alike.
 *
 * Each entry is a React component `(props: {size, className}) => JSX`.
 * Render via `<IntegrationLogo integrationId="..." />` — the resolver
 * normalises dashes → underscores and falls back to the brand-coloured
 * letter mark if no logo is registered for the id.
 *
 * Most SVGs were extracted verbatim from the chat sidebar's APP_DEFS so
 * the chat panel and the automation palette show the SAME marks.
 *
 * IDs we add here that were NOT in APP_DEFS (Nextcloud, GitHub, LinkedIn,
 * SignRequest, n8n, KB, Webpages, Video Gen, Transcription, Agent Search,
 * Maps) carry compact official-style brand glyphs so every integration
 * the automation palette surfaces gets a recognisable mark instead of a
 * letter-only fallback.
 */

const Wrap = ({ size = 18, viewBox, children, className }) => (
    <svg
        width={size}
        height={size}
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ display: 'block' }}
    >
        {children}
    </svg>
);

// ── Google ─────────────────────────────────────────────────────

const GmailLogo = (p) => (
    <Wrap {...p} viewBox="0 0 48 48">
        <path d="M45 16.2l-5 2.75-5 4.75V40h7c1.66 0 3-1.34 3-3V16.2z" fill="#4caf50" />
        <path d="M3 16.2l3.04 1.67L13 24.7V40H6c-1.66 0-3-1.34-3-3V16.2z" fill="#1e88e5" />
        <path d="M35 11.2l-11 8.5-11-8.5V24.7l11 8.5 11-8.5V11.2z" fill="#e53935" />
        <path d="M3 12.3V16.2l10 8.5V11.2L7.96 7.57A2.98 2.98 0 003 12.3z" fill="#c62828" />
        <path d="M45 12.3V16.2l-10 8.5V11.2l5.04-3.63A2.98 2.98 0 0145 12.3z" fill="#fbc02d" />
    </Wrap>
);

const GoogleDriveLogo = (p) => (
    <Wrap {...p} viewBox="0 0 87.3 78">
        <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
        <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" />
        <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.8z" fill="#ea4335" />
        <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
        <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
        <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
    </Wrap>
);

const GoogleCalendarLogo = (p) => (
    <Wrap {...p} viewBox="0 0 200 200">
        <path d="M148.363 32H51.637C40.799 32 32 40.799 32 51.637v96.726C32 159.201 40.799 168 51.637 168h96.726c10.838 0 19.637-8.799 19.637-19.637V51.637C168 40.799 159.201 32 148.363 32z" fill="#fff" />
        <path d="M168 68H32V51.637C32 40.799 40.799 32 51.637 32h96.726C159.201 32 168 40.799 168 51.637V68z" fill="#4285f4" />
        <rect x="60" y="42" width="8" height="20" rx="4" fill="#1a73e8" />
        <rect x="132" y="42" width="8" height="20" rx="4" fill="#1a73e8" />
        <text x="100" y="135" textAnchor="middle" fontFamily="'Google Sans',Arial,sans-serif" fontSize="68" fontWeight="700" fill="#4285f4">31</text>
    </Wrap>
);

const GoogleDocsLogo = (p) => (
    <Wrap {...p} viewBox="0 0 48 48">
        <path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#4285F4" />
        <path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#2A67C8" />
        <rect x="14" y="22" width="16" height="2" rx="1" fill="#fff" />
        <rect x="14" y="27" width="20" height="2" rx="1" fill="#fff" />
        <rect x="14" y="32" width="12" height="2" rx="1" fill="#fff" />
    </Wrap>
);

const GoogleSheetsLogo = (p) => (
    <Wrap {...p} viewBox="0 0 48 48">
        <path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#0F9D58" />
        <path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#087B4A" />
        <rect x="13" y="22" width="22" height="16" rx="1" fill="#fff" />
        <line x1="13" y1="28" x2="35" y2="28" stroke="#0F9D58" strokeWidth="1" />
        <line x1="13" y1="33" x2="35" y2="33" stroke="#0F9D58" strokeWidth="1" />
        <line x1="24" y1="22" x2="24" y2="38" stroke="#0F9D58" strokeWidth="1" />
    </Wrap>
);

const GoogleSlidesLogo = (p) => (
    <Wrap {...p} viewBox="0 0 48 48">
        <path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#FBBC04" />
        <path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#E8A400" />
        <rect x="13" y="24" width="22" height="14" rx="1.5" fill="#fff" />
        <rect x="17" y="28" width="14" height="2" rx="1" fill="#FBBC04" />
        <rect x="17" y="33" width="10" height="2" rx="1" fill="#FBBC04" />
    </Wrap>
);

const GoogleContactsLogo = (p) => (
    <Wrap {...p} viewBox="0 0 48 48">
        <path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#4285F4" />
        <path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#2A67C8" />
        <circle cx="24" cy="22" r="6" fill="#fff" />
        <path d="M14 38c0-5.52 4.48-10 10-10s10 4.48 10 10" fill="#fff" />
    </Wrap>
);

const GoogleKeepLogo = (p) => (
    <Wrap {...p} viewBox="0 0 48 48">
        <rect x="5" y="3" width="38" height="42" rx="3" fill="#FBBC04" />
        <rect x="14" y="16" width="20" height="3" rx="1.5" fill="#fff" />
        <rect x="14" y="23" width="20" height="3" rx="1.5" fill="#fff" />
        <rect x="14" y="30" width="14" height="3" rx="1.5" fill="#fff" />
        <circle cx="24" cy="10" r="3" fill="#fff" />
    </Wrap>
);

const GoogleGroupsLogo = (p) => (
    <Wrap {...p} viewBox="0 0 48 48">
        <circle cx="16" cy="20" r="6" fill="#34A853" />
        <circle cx="32" cy="20" r="6" fill="#4285F4" />
        <circle cx="24" cy="32" r="7" fill="#FBBC04" />
        <circle cx="24" cy="32" r="3" fill="#fff" />
    </Wrap>
);

const GoogleMapsLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335" />
        <circle cx="12" cy="9" r="2.5" fill="#fff" />
    </Wrap>
);

// ── Microsoft ──────────────────────────────────────────────────

const OutlookLogo = (p) => (
    <Wrap {...p} viewBox="0 0 48 48">
        <defs>
            <linearGradient id="logo_ol_g1" x1="2" y1="12" x2="26" y2="36" gradientUnits="userSpaceOnUse">
                <stop stopColor="#1490DF" />
                <stop offset="1" stopColor="#1068BF" />
            </linearGradient>
        </defs>
        <path d="M44 10.88V37.12A2.88 2.88 0 0 1 41.12 40H22V8h19.12A2.88 2.88 0 0 1 44 10.88z" fill="#1490DF" />
        <path d="M22 8h11v16H22z" fill="#1068BF" fillOpacity="0.5" />
        <path d="M33 8h8.12A2.88 2.88 0 0 1 44 10.88V24H33z" fill="#28A8EA" />
        <path d="M33 24H44v13.12A2.88 2.88 0 0 1 41.12 40H33z" fill="#0078D4" />
        <path d="M22 24h11v16H22z" fill="#1068BF" />
        <rect x="2" y="12" width="24" height="24" rx="2.4" fill="url(#logo_ol_g1)" />
        <text x="14" y="30" textAnchor="middle" fontFamily="'Segoe UI',Arial,sans-serif" fontWeight="600" fontSize="16" fill="#fff">O</text>
    </Wrap>
);

const MsCalendarLogo = (p) => (
    <Wrap {...p} viewBox="0 0 48 48">
        <rect x="6" y="10" width="36" height="32" rx="3" fill="#0078D4" />
        <rect x="6" y="10" width="36" height="8" fill="#005A9E" />
        <rect x="11" y="6" width="3" height="8" rx="1.5" fill="#fff" />
        <rect x="34" y="6" width="3" height="8" rx="1.5" fill="#fff" />
        <text x="24" y="35" textAnchor="middle" fontFamily="'Segoe UI',Arial,sans-serif" fontWeight="700" fontSize="16" fill="#fff">31</text>
    </Wrap>
);

const OneDriveLogo = (p) => (
    <Wrap {...p} viewBox="0 0 48 48">
        <path d="M19.55 22.1l8.65-5.3a11.09 11.09 0 0 1 5.7-1.57A11.23 11.23 0 0 1 44 24.9l.08.6A7.54 7.54 0 0 1 39.5 39H14.05a9.05 9.05 0 0 1-3.85-17.25z" fill="#0364B8" />
        <path d="M19.55 22.1l.15-.25A12.8 12.8 0 0 1 26.35 17a11.09 11.09 0 0 1 1.85-.17l-.4-.03A12.75 12.75 0 0 0 14.95 8.5a12.8 12.8 0 0 0-12.7 10.72 9.55 9.55 0 0 1 7.95 2.53z" fill="#0078D4" />
        <path d="M10.2 21.75A9.55 9.55 0 0 0 2.25 19.22 9.55 9.55 0 0 0 3.9 38.04l.15.01 10-1.05.01-.01a9.05 9.05 0 0 1-3.86-15.24z" fill="#1490DF" />
        <path d="M33.9 15.23A11.23 11.23 0 0 0 28.2 16.8l-8.65 5.3a9.05 9.05 0 0 0 3.85 14.95l.65.01H39.5a7.54 7.54 0 0 0 4.58-13.56l-.08-.6a11.23 11.23 0 0 0-10.1-7.67z" fill="#28A8EA" />
    </Wrap>
);

const MsContactsLogo = (p) => (
    <Wrap {...p} viewBox="0 0 48 48">
        <rect x="4" y="4" width="40" height="40" rx="4" fill="#0078D4" />
        <circle cx="24" cy="20" r="6" fill="#fff" />
        <path d="M12 38c0-6.62 5.38-12 12-12s12 5.38 12 12" fill="#fff" />
    </Wrap>
);

// ── Nextcloud ─────────────────────────────────────────────────
//
// Official Nextcloud avatar (the three interlocked rings). All
// sub-apps share the same brand mark — differentiation lives in the
// node label next to it. We host-link to the GitHub avatar so we
// always show the canonical artwork rather than a hand-drawn proxy.

const NEXTCLOUD_LOGO_SRC = 'https://avatars.githubusercontent.com/u/19211038?s=200&v=4';

const NextcloudLogo = ({ size = 18, className }) => (
    <img
        src={NEXTCLOUD_LOGO_SRC}
        alt="Nextcloud"
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, display: 'block', objectFit: 'contain' }}
    />
);

// ── Third-Party / AI ──────────────────────────────────────────

const FirefliesLogo = (p) => (
    <Wrap {...p} viewBox="22 20 24 24">
        <defs>
            <linearGradient id="logo_ff_g1" x1="40" y1="40" x2="14" y2="14" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FF3C82" />
                <stop offset="0.5" stopColor="#9B4AB0" />
                <stop offset="1" stopColor="#3B73FF" />
            </linearGradient>
        </defs>
        <path d="M30.5749 22H24V28.5267H30.5749V22Z" fill="url(#logo_ff_g1)" />
        <path d="M38.3633 29.8789H31.7883V36.4056H38.3633V29.8789Z" fill="url(#logo_ff_g1)" />
        <path d="M38.3633 22H31.7883V28.5267H43.9998V27.594C43.9997 26.1104 43.4058 24.6875 42.3489 23.6384C41.2919 22.5894 39.8585 22 38.3638 22H38.3633Z" fill="url(#logo_ff_g1)" />
        <path d="M24 29.8789V36.4056C24.0002 37.8892 24.594 39.3121 25.6509 40.3612C26.7079 41.4103 28.1413 41.9996 29.636 41.9996H30.5749V29.8789H24Z" fill="url(#logo_ff_g1)" />
    </Wrap>
);

const YouTrackLogo = (p) => (
    <Wrap {...p} viewBox="0 0 70 70">
        <defs>
            <linearGradient id="logo_yt_g1" x1="12" y1="58" x2="58" y2="12" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FC3791" />
                <stop offset="0.5" stopColor="#9B4AB0" />
                <stop offset="1" stopColor="#6166E8" />
            </linearGradient>
        </defs>
        <rect width="70" height="70" rx="14" fill="url(#logo_yt_g1)" />
        <path d="M16 18h38v34H16z" fill="#fff" fillOpacity="0.95" />
        <path d="M20 25h20v3H20zM20 32h28v3H20zM20 39h14v3H20z" fill="url(#logo_yt_g1)" />
    </Wrap>
);

const GammaLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <defs>
            <linearGradient id="logo_gamma_g1" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#7C3AED" />
                <stop offset="1" stopColor="#A855F7" />
            </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="4" fill="url(#logo_gamma_g1)" />
        <path d="M7 9h10v1.6H7zM7 13h7v1.6H7zM7 17h4v1.6H7z" fill="#fff" fillOpacity="0.95" />
    </Wrap>
);

const AfasLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="4" fill="#E30613" />
        <path d="M12 6.5L7 17.5h2.3l1-2.4h3.4l1 2.4H17L12 6.5zm0 4.1l1 2.5h-2l1-2.5z" fill="#fff" fillOpacity="0.95" />
    </Wrap>
);

const NmbrsLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="4" fill="#00C389" />
        <path d="M7 16.5v-9h1.9v1.1c.45-.8 1.3-1.3 2.4-1.3 1.05 0 1.85.42 2.3 1.2.5-.78 1.4-1.2 2.45-1.2 1.95 0 2.95 1.2 2.95 3.2v6H19v-5.6c0-1-.35-1.75-1.4-1.75-1 0-1.5.78-1.5 1.8v5.55h-2v-5.6c0-1-.35-1.75-1.4-1.75-1 0-1.5.78-1.5 1.8v5.55H7z" fill="#fff" fillOpacity="0.95" />
    </Wrap>
);

const LinkedInLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="3" fill="#0A66C2" />
        <path
            fill="#fff"
            d="M7.06 9.04h-2.6v8.42h2.6V9.04zM5.76 7.86c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5zM19.54 17.46h-2.6v-4.1c0-.97-.02-2.22-1.36-2.22-1.36 0-1.57 1.06-1.57 2.16v4.16h-2.6V9.04h2.5v1.15h.04c.35-.66 1.2-1.36 2.46-1.36 2.63 0 3.13 1.73 3.13 3.99v4.64z"
        />
    </Wrap>
);

const GitHubLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <path
            fill="#181717"
            d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.06c-3.2.7-3.87-1.37-3.87-1.37-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.69 1.24 3.34.95.1-.74.4-1.24.73-1.53-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.16 1.18.92-.26 1.9-.39 2.88-.39s1.96.13 2.88.39c2.2-1.49 3.16-1.18 3.16-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.07.78 2.16v3.2c0 .31.21.67.8.55 4.57-1.52 7.85-5.83 7.85-10.91C23.5 5.65 18.35.5 12 .5z"
        />
    </Wrap>
);

const SignRequestLogo = (p) => (
    <Wrap {...p} viewBox="0 0 48 48">
        <rect width="48" height="48" rx="8" fill="#2D9CDB" />
        <path
            fill="#fff"
            d="M10 30c4-2 6-2 9-2s4 2 8 2 5-3 11-3v6c-6 0-7 3-11 3s-5-2-8-2-5 0-9 2v-6z"
        />
        <path d="M14 18l4-4 12 12-4 4z" fill="#fff" />
    </Wrap>
);

const N8nLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="6" fill="#EA4B71" />
        <circle cx="6" cy="12" r="2" fill="#fff" />
        <circle cx="12" cy="6" r="2" fill="#fff" />
        <circle cx="12" cy="18" r="2" fill="#fff" />
        <circle cx="18" cy="12" r="2" fill="#fff" />
        <path d="M6 12h6M12 6v12M12 12h6" stroke="#fff" strokeWidth="1.4" />
    </Wrap>
);

const KbSearchLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="4" fill="#10B981" />
        <path d="M6 6h12v12H6z" fill="#fff" />
        <path d="M8 9h8v1.5H8zM8 12h6v1.5H8zM8 15h4v1.5H8z" fill="#10B981" />
    </Wrap>
);

const WebpagesLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="4" fill="#0EA5E9" />
        <rect x="4" y="6" width="16" height="12" rx="1.5" fill="#fff" />
        <rect x="4" y="6" width="16" height="3" rx="1.5" fill="#0284C7" />
        <circle cx="6" cy="7.5" r="0.6" fill="#fff" />
        <circle cx="8" cy="7.5" r="0.6" fill="#fff" />
        <rect x="6" y="11" width="12" height="1" rx="0.5" fill="#0EA5E9" />
        <rect x="6" y="13" width="9" height="1" rx="0.5" fill="#0EA5E9" />
        <rect x="6" y="15" width="6" height="1" rx="0.5" fill="#0EA5E9" />
    </Wrap>
);

const ImageGenLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <defs>
            <linearGradient id="logo_imgen_g1" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0EA5E9" />
                <stop offset="1" stopColor="#22D3EE" />
            </linearGradient>
        </defs>
        <rect x="2" y="2" width="20" height="20" rx="4" fill="url(#logo_imgen_g1)" />
        <circle cx="9" cy="10" r="2" fill="#fff" />
        <path d="M3 19l5-6 4 4 4-5 5 7H3z" fill="#fff" />
    </Wrap>
);

const VideoGenLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="4" fill="#0EA5E9" />
        <rect x="4" y="6" width="14" height="12" rx="1" fill="#fff" />
        <path d="M18 9l4-2v10l-4-2z" fill="#fff" />
        <path d="M9 10l5 3-5 3z" fill="#0EA5E9" />
    </Wrap>
);

const ElevenLabsLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="4" fill="#000" />
        <text x="12" y="16" textAnchor="middle" fontFamily="Inter,Arial,sans-serif" fontWeight="700" fontSize="11" fill="#fff">11</text>
        <path d="M5 18.5h14" stroke="#fff" strokeWidth="0.8" />
    </Wrap>
);

const TranscriptionLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="4" fill="#0EA5E9" />
        <rect x="11" y="4" width="2" height="10" rx="1" fill="#fff" />
        <path d="M8 12a4 4 0 0 0 8 0" stroke="#fff" strokeWidth="1.4" fill="none" />
        <path d="M12 16v3M9 19h6" stroke="#fff" strokeWidth="1.2" />
    </Wrap>
);

const AgentSearchLogo = (p) => (
    <Wrap {...p} viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="6.5" stroke="#0EA5E9" strokeWidth="2" fill="rgba(14,165,233,0.12)" />
        <line x1="16" y1="16" x2="21" y2="21" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" />
        <circle cx="11" cy="11" r="2" fill="#0EA5E9" />
    </Wrap>
);

// ── id → logo registry ─────────────────────────────────────────

export const INTEGRATION_LOGOS = {
    // Google
    gmail: GmailLogo,
    google_drive: GoogleDriveLogo,
    google_calendar: GoogleCalendarLogo,
    google_docs: GoogleDocsLogo,
    google_sheets: GoogleSheetsLogo,
    google_slides: GoogleSlidesLogo,
    google_contacts: GoogleContactsLogo,
    google_keep: GoogleKeepLogo,
    google_groups: GoogleGroupsLogo,
    maps: GoogleMapsLogo,
    google_maps: GoogleMapsLogo,

    // Microsoft
    outlook: OutlookLogo,
    outlook_readonly: OutlookLogo, // 'outlook-readonly' catalog id — read-only variant shares the Outlook brand mark
    ms_calendar: MsCalendarLogo,
    onedrive: OneDriveLogo,
    ms_contacts: MsContactsLogo,

    // Nextcloud (official mark — every sub-app uses the same avatar,
    // the node label tells you which Nextcloud surface it targets)
    nextcloud: NextcloudLogo,
    nextcloud_calendar: NextcloudLogo,
    nextcloud_contacts: NextcloudLogo,
    nextcloud_deck: NextcloudLogo,
    nextcloud_talk: NextcloudLogo,
    nextcloud_tasks: NextcloudLogo,
    nextcloud_notes: NextcloudLogo,
    nextcloud_mail: NextcloudLogo,
    nextcloud_activity: NextcloudLogo,
    nextcloud_notifications: NextcloudLogo,
    nextcloud_status: NextcloudLogo,

    // Third-Party
    fireflies: FirefliesLogo,
    youtrack: YouTrackLogo,
    gamma: GammaLogo,
    afas_profit: AfasLogo,
    nmbrs: NmbrsLogo,
    linkedin: LinkedInLogo,
    github: GitHubLogo,
    signrequest: SignRequestLogo,
    n8n: N8nLogo,
    kb_search: KbSearchLogo,
    webpages: WebpagesLogo,

    // AI / Generation
    image_gen: ImageGenLogo,
    video_gen: VideoGenLogo,
    elevenlabs: ElevenLabsLogo,
    transcription: TranscriptionLogo,
    agent_search: AgentSearchLogo,
    web_search: AgentSearchLogo,
};

/**
 * Look up a brand logo for an integration id (dash or underscore form).
 * Returns the React component or null if none registered — callers fall
 * back to the brand letter mark from `INTEGRATION_META`.
 */
export function getIntegrationLogo(integrationId) {
    if (!integrationId) return null;
    const normalised = String(integrationId).replace(/-/g, '_');
    return INTEGRATION_LOGOS[normalised] || INTEGRATION_LOGOS[integrationId] || null;
}
