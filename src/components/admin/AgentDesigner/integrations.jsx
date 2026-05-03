import React from 'react';

export const INTEGRATION_CATALOG = [
    { 
        id: 'gmail', label: 'Gmail', group: 'google', description: 'Read & send emails',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M45 16.2l-5 2.75-5 4.75V40h7c1.66 0 3-1.34 3-3V16.2z" fill="#4caf50" /><path d="M3 16.2l3.04 1.67L13 24.7V40H6c-1.66 0-3-1.34-3-3V16.2z" fill="#1e88e5" /><path d="M35 11.2l-11 8.5-11-8.5V24.7l11 8.5 11-8.5V11.2z" fill="#e53935" /><path d="M3 12.3V16.2l10 8.5V11.2L7.96 7.57A2.98 2.98 0 003 12.3z" fill="#c62828" /><path d="M45 12.3V16.2l-10 8.5V11.2l5.04-3.63A2.98 2.98 0 0145 12.3z" fill="#fbc02d" /></svg>
    },
    {
        id: 'google-calendar', label: 'Calendar', group: 'google', description: 'Create & manage events',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path d="M152.637 200H47.363C21.201 200 0 178.799 0 152.637V47.363C0 21.201 21.201 0 47.363 0h105.273C178.799 0 200 21.201 200 47.363v105.273C200 178.799 178.799 200 152.637 200z" fill="#fff" /><path d="M152.637 200H47.363C21.201 200 0 178.799 0 152.637V47.363C0 21.201 21.201 0 47.363 0h105.273C178.799 0 200 21.201 200 47.363v105.273C200 178.799 178.799 200 152.637 200z" fill="#4285f4" fillOpacity="0.12" /><path d="M148.363 32H51.637C40.799 32 32 40.799 32 51.637v96.726C32 159.201 40.799 168 51.637 168h96.726c10.838 0 19.637-8.799 19.637-19.637V51.637C168 40.799 159.201 32 148.363 32z" fill="#fff" /><path d="M168 68H32V51.637C32 40.799 40.799 32 51.637 32h96.726C159.201 32 168 40.799 168 51.637V68z" fill="#4285f4" /><rect x="60" y="42" width="8" height="20" rx="4" fill="#1a73e8" /><rect x="132" y="42" width="8" height="20" rx="4" fill="#1a73e8" /><text x="67" y="108" fontFamily="Google Sans,Arial,sans-serif" fontSize="28" fontWeight="600" fill="#70757a">27</text><rect x="56" y="120" width="36" height="4" rx="2" fill="#ea4335" /><rect x="56" y="130" width="28" height="4" rx="2" fill="#34a853" /><rect x="108" y="88" width="36" height="4" rx="2" fill="#4285f4" /><rect x="108" y="98" width="28" height="4" rx="2" fill="#fbbc04" /><rect x="108" y="120" width="36" height="4" rx="2" fill="#ea4335" /><rect x="108" y="130" width="20" height="4" rx="2" fill="#34a853" /></svg>
    },
    {
        id: 'google-drive', label: 'Drive', group: 'google', description: 'Search & access files',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" /><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" /><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.8z" fill="#ea4335" /><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" /><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" /><path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" /></svg>
    },
    {
        id: 'google-sheets', label: 'Sheets', group: 'google', description: 'Read & write spreadsheets',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#0F9D58" /><path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#087B4A" /><rect x="13" y="22" width="22" height="16" rx="1" fill="#fff" /><line x1="13" y1="28" x2="35" y2="28" stroke="#0F9D58" strokeWidth="1" /><line x1="13" y1="33" x2="35" y2="33" stroke="#0F9D58" strokeWidth="1" /><line x1="24" y1="22" x2="24" y2="38" stroke="#0F9D58" strokeWidth="1" /></svg>
    },
    {
        id: 'google-docs', label: 'Docs', group: 'google', description: 'Create & edit documents',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#4285F4" /><path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#2A67C8" /><rect x="14" y="22" width="16" height="2" rx="1" fill="#fff" /><rect x="14" y="27" width="20" height="2" rx="1" fill="#fff" /><rect x="14" y="32" width="12" height="2" rx="1" fill="#fff" /></svg>
    },
    {
        id: 'google-slides', label: 'Slides', group: 'google', description: 'Create presentations',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#FBBC04" /><path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#E8A400" /><rect x="13" y="24" width="22" height="14" rx="1.5" fill="#fff" /><rect x="17" y="28" width="14" height="2" rx="1" fill="#FBBC04" /><rect x="17" y="33" width="10" height="2" rx="1" fill="#FBBC04" /></svg>
    },
    {
        id: 'google-contacts', label: 'Contacts', group: 'google', description: 'Search, create & update contacts',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#4285F4" /><path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#2A67C8" /><circle cx="24" cy="22" r="6" fill="#fff" /><path d="M14 38c0-5.52 4.48-10 10-10s10 4.48 10 10" fill="#fff" /></svg>
    },
    {
        id: 'google-keep', label: 'Keep', group: 'google', description: 'List, create & delete notes (Workspace only)',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="3" width="38" height="42" rx="3" fill="#FBBC04" /><rect x="14" y="16" width="20" height="3" rx="1.5" fill="#fff" /><rect x="14" y="23" width="20" height="3" rx="1.5" fill="#fff" /><rect x="14" y="30" width="14" height="3" rx="1.5" fill="#fff" /><circle cx="24" cy="10" r="3" fill="#fff" /></svg>
    },
    {
        id: 'google-groups', label: 'Groups', group: 'google', description: 'Read & reply to group conversations',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="14" r="8" fill="#4285F4" /><circle cx="12" cy="18" r="6" fill="#34A853" /><circle cx="36" cy="18" r="6" fill="#FBBC04" /><path d="M24 24c-6 0-11 3.6-13 8.8C13 38 18 42 24 42s11-4 13-9.2C35 27.6 30 24 24 24z" fill="#4285F4" /><path d="M12 26c-4 0-7.5 2.4-9 5.8C4.2 36 7.8 39 12 39c2 0 3.8-.6 5.2-1.6C15 34.2 13 30.4 12 26z" fill="#34A853" /><path d="M36 26c-1 4.4-3 8.2-5.2 11.4C32.2 38.4 34 39 36 39c4.2 0 7.8-3 9-7.2C43.5 28.4 40 26 36 26z" fill="#FBBC04" /></svg>
    },
    {
        id: 'outlook', label: 'Outlook', group: 'microsoft', description: 'Read & send emails',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ol_ag" x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse"><stop stopColor="#1490DF"/><stop offset="1" stopColor="#1068BF"/></linearGradient></defs><path d="M44 10.88V37.12A2.88 2.88 0 0 1 41.12 40H22V8h19.12A2.88 2.88 0 0 1 44 10.88z" fill="#1490DF"/><path d="M22 8h11v16H22z" fill="#1068BF" fillOpacity="0.5"/><path d="M33 8h8.12A2.88 2.88 0 0 1 44 10.88V24H33z" fill="#28A8EA"/><path d="M33 24H44v13.12A2.88 2.88 0 0 1 41.12 40H33z" fill="#0078D4"/><path d="M22 24h11v16H22z" fill="#1068BF"/><path d="M26 14L44 14V10.88A2.88 2.88 0 0 0 41.12 8H22l4 6z" fill="#28A8EA" fillOpacity="0.7"/><rect x="2" y="12" width="24" height="24" rx="2.4" fill="url(#ol_ag)"/><text x="14" y="30" textAnchor="middle" fontFamily="Segoe UI,Arial,sans-serif" fontWeight="600" fontSize="16" fill="white">O</text></svg>
    },
    {
        id: 'ms-calendar', label: 'Calendar', group: 'microsoft', description: 'Create & manage events',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mc_ag" x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse"><stop stopColor="#1490DF"/><stop offset="1" stopColor="#1068BF"/></linearGradient></defs><path d="M44 10.88V37.12A2.88 2.88 0 0 1 41.12 40H22V8h19.12A2.88 2.88 0 0 1 44 10.88z" fill="#1490DF"/><path d="M22 8h11v16H22z" fill="#1068BF" fillOpacity="0.5"/><path d="M33 8h8.12A2.88 2.88 0 0 1 44 10.88V24H33z" fill="#28A8EA"/><path d="M33 24H44v13.12A2.88 2.88 0 0 1 41.12 40H33z" fill="#0078D4"/><path d="M22 24h11v16H22z" fill="#1068BF"/><rect x="27" y="14" width="3" height="3" rx="0.5" fill="white"/><rect x="32" y="14" width="3" height="3" rx="0.5" fill="white"/><rect x="37" y="14" width="3" height="3" rx="0.5" fill="white"/><rect x="27" y="19" width="3" height="3" rx="0.5" fill="white"/><rect x="32" y="19" width="3" height="3" rx="0.5" fill="white"/><rect x="37" y="19" width="3" height="3" rx="0.5" fill="white"/><rect x="2" y="12" width="24" height="24" rx="2.4" fill="url(#mc_ag)"/><rect x="7" y="19" width="14" height="14" rx="1" fill="white"/><rect x="7" y="17" width="14" height="4" rx="1" fill="#1068BF"/><rect x="10" y="15.5" width="1.5" height="3" rx="0.75" fill="white"/><rect x="16.5" y="15.5" width="1.5" height="3" rx="0.75" fill="white"/><rect x="9" y="24" width="3" height="2" rx="0.5" fill="#1490DF" fillOpacity="0.8"/><rect x="14" y="24" width="3" height="2" rx="0.5" fill="#1490DF" fillOpacity="0.5"/><rect x="9" y="28" width="3" height="2" rx="0.5" fill="#1490DF" fillOpacity="0.5"/></svg>
    },
    {
        id: 'onedrive', label: 'OneDrive', group: 'microsoft', description: 'Search & access files',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M19.55 22.1l8.65-5.3a11.09 11.09 0 0 1 5.7-1.57A11.23 11.23 0 0 1 44 24.9l.08.6A7.54 7.54 0 0 1 39.5 39H14.05a9.05 9.05 0 0 1-3.85-17.25z" fill="#0364B8"/><path d="M19.55 22.1l.15-.25A12.8 12.8 0 0 1 26.35 17a11.09 11.09 0 0 1 1.85-.17l-.4-.03A12.75 12.75 0 0 0 14.95 8.5a12.8 12.8 0 0 0-12.7 10.72 9.55 9.55 0 0 1 7.95 2.53z" fill="#0078D4"/><path d="M10.2 21.75A9.55 9.55 0 0 0 2.25 19.22 9.55 9.55 0 0 0 3.9 38.04l.15.01 10-1.05.01-.01a9.05 9.05 0 0 1-3.86-15.24z" fill="#1490DF"/><path d="M33.9 15.23A11.23 11.23 0 0 0 28.2 16.8l-8.65 5.3a9.05 9.05 0 0 0 3.85 14.95l.65.01H39.5a7.54 7.54 0 0 0 4.58-13.56l-.08-.6a11.23 11.23 0 0 0-10.1-7.67z" fill="#28A8EA"/></svg>
    },
    {
        id: 'ms-contacts', label: 'Contacts', group: 'microsoft', description: 'Search, create & update contacts',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mp_ag" x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse"><stop stopColor="#1490DF"/><stop offset="1" stopColor="#1068BF"/></linearGradient></defs><path d="M44 10.88V37.12A2.88 2.88 0 0 1 41.12 40H22V8h19.12A2.88 2.88 0 0 1 44 10.88z" fill="#1490DF"/><path d="M22 8h11v16H22z" fill="#1068BF" fillOpacity="0.5"/><path d="M33 8h8.12A2.88 2.88 0 0 1 44 10.88V24H33z" fill="#28A8EA"/><path d="M33 24H44v13.12A2.88 2.88 0 0 1 41.12 40H33z" fill="#0078D4"/><path d="M22 24h11v16H22z" fill="#1068BF"/><circle cx="34" cy="17" r="4" fill="white"/><path d="M27.5 31c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" fill="white"/><rect x="2" y="12" width="24" height="24" rx="2.4" fill="url(#mp_ag)"/><circle cx="14" cy="21" r="3.5" fill="white"/><path d="M8 31c0-3.31 2.69-6 6-6s6 2.69 6 6" fill="white"/></svg>
    },
    {
        id: 'image-gen', label: 'Image Generation', group: 'platform', description: 'Generate images with AI',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="3" fill="url(#ig_g1)" /><circle cx="9" cy="9" r="2" fill="white" fillOpacity="0.9" /><path d="M3 15l5-4 3 3 4-5 6 7v2a3 3 0 01-3 3H6a3 3 0 01-3-3v-3z" fill="white" fillOpacity="0.4" /><defs><linearGradient id="ig_g1" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#F59E0B" /><stop offset="1" stopColor="#EF4444" /></linearGradient></defs></svg>
    },
    {
        id: 'music-gen', label: 'Music Generation', group: 'platform', description: 'Generate music with AI',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="3" fill="url(#mg_g1)" /><path d="M9 17V7l8-2v10" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /><circle cx="7" cy="17" r="2" fill="white" fillOpacity="0.9" /><circle cx="15" cy="15" r="2" fill="white" fillOpacity="0.9" /><defs><linearGradient id="mg_g1" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#8B5CF6" /><stop offset="1" stopColor="#EC4899" /></linearGradient></defs></svg>
    },
    {
        id: 'video-gen', label: 'Video Generation', group: 'platform', description: 'Generate videos with AI',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="3" fill="url(#vg_g1)" /><path d="M10 8l6 4-6 4V8z" fill="white" fillOpacity="0.9" /><defs><linearGradient id="vg_g1" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#3B82F6" /><stop offset="1" stopColor="#06B6D4" /></linearGradient></defs></svg>
    },
    {
        id: 'elevenlabs', label: 'ElevenLabs', group: 'platform', description: 'Music with vocals, TTS & SFX',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="3" fill="url(#el_g1)" /><path d="M8 7v10M11 7v10M14 9v6" stroke="white" strokeWidth="2" strokeLinecap="round" /><defs><linearGradient id="el_g1" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#6366F1" /><stop offset="1" stopColor="#EC4899" /></linearGradient></defs></svg>
    },
    {
        id: 'agent-search', label: 'Web Search', group: 'platform', description: 'Search the internet',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="7" stroke="#6366F1" strokeWidth="2" fill="none" /><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" /><circle cx="11" cy="11" r="3" stroke="#6366F1" strokeWidth="1.5" fill="rgba(99,102,241,0.1)" /></svg>
    },
    {
        id: 'fireflies', label: 'Fireflies', group: 'third-party', description: 'Meeting transcriptions',
        iconSvg: <svg className="w-5 h-5" viewBox="22 20 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30.5749 22H24V28.5267H30.5749V22Z" fill="url(#ff_cap_g1)" /><path d="M38.3633 29.8789H31.7883V36.4056H38.3633V29.8789Z" fill="url(#ff_cap_g2)" /><path d="M38.3633 22H31.7883V28.5267H43.9998V27.594C43.9997 26.1104 43.4058 24.6875 42.3489 23.6384C41.2919 22.5894 39.8585 22 38.3638 22H38.3633Z" fill="url(#ff_cap_g3)" /><path d="M24 29.8789V36.4056C24.0002 37.8892 24.594 39.3121 25.6509 40.3612C26.7079 41.4103 28.1413 41.9996 29.636 41.9996H30.5749V29.8789H24Z" fill="url(#ff_cap_g4)" /><defs><linearGradient id="ff_cap_g1" x1="40.08" y1="38.51" x2="12.44" y2="9.47" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ff_cap_g2" x1="40.18" y1="38.42" x2="12.54" y2="9.38" gradientUnits="userSpaceOnUse"><stop stopColor="#FF3C82" /><stop offset="0.49" stopColor="#B251B2" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ff_cap_g3" x1="44.77" y1="34.05" x2="35.4" y2="0.12" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ff_cap_g4" x1="35.55" y1="42.82" x2="2.03" y2="32.61" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient></defs></svg>
    },
    {
        id: 'youtrack', label: 'YouTrack', group: 'third-party', description: 'Issue tracking',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="yt_cap_g1" x1="12" y1="58" x2="58" y2="12" gradientUnits="userSpaceOnUse"><stop stopColor="#FC3791" /><stop offset="0.52" stopColor="#9B4AB0" /><stop offset="1" stopColor="#6166E8" /></linearGradient></defs><rect width="70" height="70" rx="14" fill="url(#yt_cap_g1)" /><path d="M16 18h38v34H16z" fill="white" fillOpacity="0.9" /><path d="M20 25h20v3H20zM20 32h28v3H20zM20 39h14v3H20z" fill="url(#yt_cap_g1)" /></svg>
    },
    {
        id: 'gamma', label: 'Gamma', group: 'third-party', description: 'Generate presentations',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v16H4z" rx="3" fill="url(#gamma_cap_g1)" /><path d="M8 9h8v1.5H8zM8 12.5h6v1.5H8zM8 16h4v1.5H8z" fill="white" fillOpacity="0.9" /><defs><linearGradient id="gamma_cap_g1" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop stopColor="#6366F1" /><stop offset="1" stopColor="#A855F7" /></linearGradient></defs></svg>
    },
    {
        id: 'n8n', label: 'n8n', group: 'third-party', description: 'Workflow automations',
        iconSvg: <img src="/n8n-color.png" alt="n8n" className="w-5 h-5 object-contain" />
    },
    {
        id: 'linkedin', label: 'LinkedIn', group: 'third-party', description: 'Post to LinkedIn',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="4" fill="#0A66C2" /><path d="M7.5 9.5h2v7h-2v-7zm1-3.2a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4zm3.5 3.2h1.9v1h0c.27-.5 .92-1.1 1.9-1.1 2 0 2.4 1.3 2.4 3.1v3.6h-2v-3.2c0-.8 0-1.8-1.1-1.8s-1.3.9-1.3 1.7v3.3h-2v-6.6z" fill="white" /></svg>
    },
    {
        id: 'transcription', label: 'Meeting Transcription', group: 'platform', description: 'Transcribe audio with speaker diarization',
        iconSvg: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="18" rx="3" fill="url(#tr_g1)" /><path d="M12 7v6m0 0l-2-2m2 2l2-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 15a4 4 0 008 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" /><line x1="12" y1="19" x2="12" y2="20" stroke="white" strokeWidth="1.5" strokeLinecap="round" /><defs><linearGradient id="tr_g1" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop stopColor="#6366F1" /><stop offset="1" stopColor="#06B6D4" /></linearGradient></defs></svg>
    },
];
