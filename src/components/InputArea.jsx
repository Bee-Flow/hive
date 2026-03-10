import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, StopCircle, MessageCircle, FileText, Image, File, FileSpreadsheet, ArrowUp, Sparkles, LayoutGrid } from 'lucide-react';
import ModelTierSelector from './ModelTierSelector';
import GoogleDrivePicker from './chat/GoogleDrivePicker';
import GmailPicker from './chat/GmailPicker';
import ImageGenSettings, { loadSettings } from './chat/ImageGenSettings';
import MusicGenSettings from './chat/MusicGenSettings';
import ElevenLabsSettings from './chat/ElevenLabsSettings';
import VideoGenSettings from './chat/VideoGenSettings';
import { API_BASE, authFetch } from '../utils/helpers';

// App definitions for the apps overlay
const APP_DEFS = [
    {
        id: 'google-drive', label: 'Google Drive', description: 'Attach files from Drive', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" /><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" /><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.8z" fill="#ea4335" /><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" /><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" /><path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" /></svg>,
    },
    {
        id: 'gmail', label: 'Gmail', description: 'Attach emails', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M45 16.2l-5 2.75-5 4.75V40h7c1.66 0 3-1.34 3-3V16.2z" fill="#4caf50" /><path d="M3 16.2l3.04 1.67L13 24.7V40H6c-1.66 0-3-1.34-3-3V16.2z" fill="#1e88e5" /><path d="M35 11.2l-11 8.5-11-8.5V24.7l11 8.5 11-8.5V11.2z" fill="#e53935" /><path d="M3 12.3V16.2l10 8.5V11.2L7.96 7.57A2.98 2.98 0 003 12.3z" fill="#c62828" /><path d="M45 12.3V16.2l-10 8.5V11.2l5.04-3.63A2.98 2.98 0 0145 12.3z" fill="#fbc02d" /></svg>,
    },
    {
        id: 'google-calendar', label: 'Google Calendar', description: 'Ask about your schedule', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path d="M152.637 200H47.363C21.201 200 0 178.799 0 152.637V47.363C0 21.201 21.201 0 47.363 0h105.273C178.799 0 200 21.201 200 47.363v105.273C200 178.799 178.799 200 152.637 200z" fill="#fff" /><path d="M152.637 200H47.363C21.201 200 0 178.799 0 152.637V47.363C0 21.201 21.201 0 47.363 0h105.273C178.799 0 200 21.201 200 47.363v105.273C200 178.799 178.799 200 152.637 200z" fill="#4285f4" fillOpacity="0.12" /><path d="M148.363 32H51.637C40.799 32 32 40.799 32 51.637v96.726C32 159.201 40.799 168 51.637 168h96.726c10.838 0 19.637-8.799 19.637-19.637V51.637C168 40.799 159.201 32 148.363 32z" fill="#fff" /><path d="M168 68H32V51.637C32 40.799 40.799 32 51.637 32h96.726C159.201 32 168 40.799 168 51.637V68z" fill="#4285f4" /><rect x="60" y="42" width="8" height="20" rx="4" fill="#1a73e8" /><rect x="132" y="42" width="8" height="20" rx="4" fill="#1a73e8" /><text x="67" y="108" fontFamily="Google Sans,Arial,sans-serif" fontSize="28" fontWeight="600" fill="#70757a">27</text><rect x="56" y="120" width="36" height="4" rx="2" fill="#ea4335" /><rect x="56" y="130" width="28" height="4" rx="2" fill="#34a853" /><rect x="108" y="88" width="36" height="4" rx="2" fill="#4285f4" /><rect x="108" y="98" width="28" height="4" rx="2" fill="#fbbc04" /><rect x="108" y="120" width="36" height="4" rx="2" fill="#ea4335" /><rect x="108" y="130" width="20" height="4" rx="2" fill="#34a853" /></svg>,
    },
    {
        id: 'google-slides', label: 'Google Slides', description: 'Ask about presentations', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#FBBC04" /><path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#E8A400" /><rect x="13" y="24" width="22" height="14" rx="1.5" fill="#fff" /><rect x="17" y="28" width="14" height="2" rx="1" fill="#FBBC04" /><rect x="17" y="33" width="10" height="2" rx="1" fill="#FBBC04" /></svg>,
    },
    {
        id: 'google-sheets', label: 'Google Sheets', description: 'Create & edit spreadsheets', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#0F9D58" /><path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#087B4A" /><rect x="13" y="22" width="22" height="16" rx="1" fill="#fff" /><line x1="13" y1="28" x2="35" y2="28" stroke="#0F9D58" strokeWidth="1" /><line x1="13" y1="33" x2="35" y2="33" stroke="#0F9D58" strokeWidth="1" /><line x1="24" y1="22" x2="24" y2="38" stroke="#0F9D58" strokeWidth="1" /></svg>,
    },
    {
        id: 'google-docs', label: 'Google Docs', description: 'Create & read documents', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#4285F4" /><path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#2A67C8" /><rect x="14" y="22" width="16" height="2" rx="1" fill="#fff" /><rect x="14" y="27" width="20" height="2" rx="1" fill="#fff" /><rect x="14" y="32" width="12" height="2" rx="1" fill="#fff" /></svg>,
    },
    {
        id: 'fireflies', label: 'Fireflies.ai', description: 'Meeting transcripts', requiresFireflies: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="22 20 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30.5749 22H24V28.5267H30.5749V22Z" fill="url(#ff_app_g1)" /><path d="M38.3633 29.8789H31.7883V36.4056H38.3633V29.8789Z" fill="url(#ff_app_g2)" /><path d="M38.3633 22H31.7883V28.5267H43.9998V27.594C43.9997 26.1104 43.4058 24.6875 42.3489 23.6384C41.2919 22.5894 39.8585 22 38.3638 22H38.3633Z" fill="url(#ff_app_g3)" /><path d="M24 29.8789V36.4056C24.0002 37.8892 24.594 39.3121 25.6509 40.3612C26.7079 41.4103 28.1413 41.9996 29.636 41.9996H30.5749V29.8789H24Z" fill="url(#ff_app_g4)" /><defs><linearGradient id="ff_app_g1" x1="40.08" y1="38.51" x2="12.44" y2="9.47" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ff_app_g2" x1="40.18" y1="38.42" x2="12.54" y2="9.38" gradientUnits="userSpaceOnUse"><stop stopColor="#FF3C82" /><stop offset="0.49" stopColor="#B251B2" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ff_app_g3" x1="44.77" y1="34.05" x2="35.4" y2="0.12" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ff_app_g4" x1="35.55" y1="42.82" x2="2.03" y2="32.61" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient></defs></svg>,
    },
    {
        id: 'youtrack', label: 'YouTrack', description: 'Issues and projects', requiresYouTrack: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="yt_app_g1" x1="12" y1="58" x2="58" y2="12" gradientUnits="userSpaceOnUse"><stop stopColor="#FC3791" /><stop offset="0.52" stopColor="#9B4AB0" /><stop offset="1" stopColor="#6166E8" /></linearGradient></defs><rect width="70" height="70" rx="14" fill="url(#yt_app_g1)" /><path d="M16 18h38v34H16z" fill="white" fillOpacity="0.9" /><path d="M20 25h20v3H20zM20 32h28v3H20zM20 39h14v3H20z" fill="url(#yt_app_g1)" /></svg>,
    },
    {
        id: 'gamma', label: 'Gamma', description: 'AI presentations', requiresGamma: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v16H4z" rx="3" fill="url(#gamma_app_g1)" /><path d="M8 9h8v1.5H8zM8 12.5h6v1.5H8zM8 16h4v1.5H8z" fill="white" fillOpacity="0.9" /><defs><linearGradient id="gamma_app_g1" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop stopColor="#6366F1" /><stop offset="1" stopColor="#A855F7" /></linearGradient></defs></svg>,
    },
    {
        id: 'web-search', label: 'Web Search', description: 'Search the web', requiresNone: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="7" stroke="#6366F1" strokeWidth="2" fill="none" /><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" /><circle cx="11" cy="11" r="3" stroke="#6366F1" strokeWidth="1.5" fill="rgba(99,102,241,0.1)" /></svg>,
    },
    {
        id: 'google-maps', label: 'Google Maps', description: 'Directions, routes & places', requiresNone: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>,
    },

    {
        id: 'image-gen', label: 'Image Generation', description: 'AI image creation settings', requiresNone: true,
        iconSvg: (s = 'w-5 h-5') => <span className={`${s} flex items-center justify-center text-base`}>🍌</span>,
    },
    {
        id: 'elevenlabs', label: 'ElevenLabs', description: 'Music with vocals, TTS & sound effects', requiresNone: true,
        iconSvg: (s = 'w-5 h-5') => <span className={`${s} flex items-center justify-center text-base`}>🎵</span>,
    },
    {
        id: 'whatsapp', label: 'WhatsApp', description: 'Send & read messages', requiresWhatsApp: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
    },
];

const InputArea = ({
    onSendMessage,
    onStopGenerating,
    isLoading,
    selectedAgent,
    activeThreadParent,
    threadTitle,
    onExitThread,
    warningText,
    directMode,
    modelTiers,
    selectedTier,
    onTierChange,
    input,
    setInput,
    agentIntegrations,
    isMobile
}) => {
    const [attachments, setAttachments] = useState([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [drivePickerOpen, setDrivePickerOpen] = useState(false);
    const [gmailPickerOpen, setGmailPickerOpen] = useState(false);
    const [imageGenOpen, setImageGenOpen] = useState(false);
    const [imageGenSettings, setImageGenSettings] = useState(loadSettings);
    const [musicGenOpen, setMusicGenOpen] = useState(false);
    const [elevenLabsOpen, setElevenLabsOpen] = useState(false);
    const [videoGenOpen, setVideoGenOpen] = useState(false);
    const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
    // Per-integration enable/disable (persisted in localStorage)
    const [disabledMedia, setDisabledMedia] = useState(() => {
        try { return JSON.parse(localStorage.getItem('disabledMedia') || '{}'); } catch { return {}; }
    });
    const [hasFirefliesKey, setHasFirefliesKey] = useState(false);
    const [orgEnabledIntegrations, setOrgEnabledIntegrations] = useState(null);
    const [hasYouTrackConfig, setHasYouTrackConfig] = useState(false);
    const [hasGammaKey, setHasGammaKey] = useState(false);
    const [hasWhatsApp, setHasWhatsApp] = useState(false);
    const [n8nWorkflows, setN8nWorkflows] = useState([]);

    const [isGoogleUser, setIsGoogleUser] = useState(false);
    const imageGenBtnRef = useRef(null);
    const musicGenBtnRef = useRef(null);
    const elevenLabsBtnRef = useRef(null);
    const videoGenBtnRef = useRef(null);
    const mediaMenuBtnRef = useRef(null);
    const mediaMenuRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);
    const appsRef = useRef(null);
    const [appsOverlayOpen, setAppsOverlayOpen] = useState(false);
    const [appSearch, setAppSearch] = useState('');

    // Close media menu on click outside
    useEffect(() => {
        if (!mediaMenuOpen) return;
        const handler = (e) => {
            if (mediaMenuRef.current?.contains(e.target)) return;
            if (mediaMenuBtnRef.current?.contains(e.target)) return;
            setMediaMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [mediaMenuOpen]);

    // Apps enable/disable state (loaded from server, synced on change)
    const [enabledApps, setEnabledApps] = useState(null); // null = all enabled

    // Save enabled apps to server
    const toggleApp = (appId) => {
        setEnabledApps(prev => {
            const defaults = APP_DEFS.filter(a => !a.requiresNone).map(a => a.id);
            const current = prev || defaults;
            const next = current.includes(appId)
                ? current.filter(id => id !== appId)
                : [...current, appId];
            // Persist to server (fire-and-forget)
            authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabledApps: next }),
            }).catch(() => { });
            return next;
        });
    };

    const isAppEnabled = (appId) => {
        if (!enabledApps) return true; // all enabled by default
        return enabledApps.includes(appId);
    };

    // Close apps overlay on outside click
    useEffect(() => {
        if (!appsOverlayOpen) return;
        const close = (e) => { if (appsRef.current && !appsRef.current.contains(e.target)) setAppsOverlayOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [appsOverlayOpen]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px';
        }
    }, [input]);

    // Check user settings (Fireflies key, Google SSO status, enabled apps)
    useEffect(() => {
        authFetch(`${API_BASE}/ai/user-settings`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) {
                    setHasFirefliesKey(!!data.hasFirefliesKey);
                    setHasYouTrackConfig(!!data.hasYouTrackConfig);
                    setHasGammaKey(!!data.hasGammaKey);

                    setIsGoogleUser(!!data.isGoogleUser);
                    if (data.enabledApps) setEnabledApps(data.enabledApps);
                    if (data.orgEnabledIntegrations !== undefined) setOrgEnabledIntegrations(data.orgEnabledIntegrations);
                }
            })
            .catch(() => { });
        // Fetch n8n workflows if n8n is available
        authFetch(`${API_BASE}/ai/n8n/config`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.workflows?.length) {
                    setN8nWorkflows(data.workflows.filter(w => w.enabled));
                }
            })
            .catch(() => { });
        // Check WhatsApp connection status
        authFetch(`${API_BASE}/api/integrations/whatsapp/status`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && (data.status === 'connected' || data.hasSavedSession)) {
                    setHasWhatsApp(true);
                }
            })
            .catch(() => { });
    }, []);

    // Process files (shared between file input, drop, and paste)
    const processFiles = useCallback(async (files) => {
        if (files.length === 0) return;
        const newAttachments = [];

        for (const file of files) {
            // Limit file size to 20MB
            if (file.size > 20 * 1024 * 1024) {
                console.warn(`File ${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)}MB), max 20MB`);
                continue;
            }

            const reader = new FileReader();
            const content = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });

            newAttachments.push({
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                content: content
            });
        }

        if (newAttachments.length > 0) {
            setAttachments(prev => [...prev, ...newAttachments]);
        }
    }, []);

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        await processFiles(files);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ---- Drag & Drop ----
    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set false if leaving the drop zone entirely
        if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget)) {
            setIsDragOver(false);
        }
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0) {
            await processFiles(files);
        }
    }, [processFiles]);

    // ---- Paste (Ctrl+V) ----
    // Extract files from clipboardData (sync — classic approach)
    const extractPasteFiles = useCallback((clipboardData) => {
        if (!clipboardData) return [];
        const files = [];

        // Method 1: clipboardData.items (Chrome, Edge, most browsers)
        const items = Array.from(clipboardData.items || []);
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    if (file.type.startsWith('image/') && (!file.name || file.name === 'image.png')) {
                        const ext = file.type.split('/')[1] || 'png';
                        files.push(new File([file], `pasted-image-${Date.now()}.${ext}`, { type: file.type }));
                    } else {
                        files.push(file);
                    }
                }
            }
        }

        // Method 2: clipboardData.files fallback (Firefox)
        if (files.length === 0) {
            const clipFiles = Array.from(clipboardData.files || []);
            for (const file of clipFiles) {
                if (file.type.startsWith('image/')) {
                    const ext = file.type.split('/')[1] || 'png';
                    files.push(new File([file], `pasted-image-${Date.now()}.${ext}`, { type: file.type }));
                } else {
                    files.push(file);
                }
            }
        }

        return files;
    }, []);

    // Extract image from HTML clipboard data (e.g. images copied from web pages)
    const extractImageFromHtml = useCallback(async (clipboardData) => {
        if (!clipboardData) return null;
        const items = Array.from(clipboardData.items || []);
        const htmlItem = items.find(i => i.kind === 'string' && i.type === 'text/html');
        if (!htmlItem) return null;

        const html = await new Promise(resolve => htmlItem.getAsString(resolve));
        // Look for <img> tags with data URLs or http URLs
        const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (!imgMatch) return null;

        const src = imgMatch[1];
        try {
            if (src.startsWith('data:image/')) {
                // Base64 data URL — convert to File
                const res = await fetch(src);
                const blob = await res.blob();
                const ext = blob.type.split('/')[1] || 'png';
                return new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: blob.type });
            } else if (src.startsWith('http')) {
                // Try to fetch the remote image
                const res = await fetch(src);
                if (res.ok) {
                    const blob = await res.blob();
                    if (blob.type.startsWith('image/')) {
                        const ext = blob.type.split('/')[1] || 'png';
                        return new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: blob.type });
                    }
                }
            }
        } catch (err) {
            console.warn('[Paste] Failed to extract image from HTML:', err);
        }
        return null;
    }, []);

    // Async fallback using navigator.clipboard.read() (works on Linux/Wayland where clipboardData is empty)
    const readClipboardAsync = useCallback(async () => {
        if (!navigator.clipboard?.read) {
            console.log('[Paste] navigator.clipboard.read not available');
            return [];
        }
        try {
            const clipboardItems = await navigator.clipboard.read();
            const files = [];
            for (const item of clipboardItems) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        const blob = await item.getType(type);
                        const ext = type.split('/')[1] || 'png';
                        files.push(new File([blob], `pasted-image-${Date.now()}.${ext}`, { type }));
                    }
                }
            }
            console.log(`[Paste] navigator.clipboard.read() found ${files.length} image(s)`);
            return files;
        } catch (err) {
            console.warn('[Paste] navigator.clipboard.read() failed:', err.message);
            return [];
        }
    }, []);

    // Check if clipboard might contain image data (even if not directly accessible sync)
    const clipboardMayHaveImage = useCallback((clipboardData) => {
        if (!clipboardData) return false;
        const items = Array.from(clipboardData.items || []);
        // Check for any image type in items (even string items that hint at image content)
        for (const item of items) {
            if (item.type.startsWith('image/')) return true;
        }
        // If clipboard has NO items at all, it might be Linux/Wayland with image data
        // only accessible via async API — assume it might have an image
        if (items.length === 0 && Array.from(clipboardData.files || []).length === 0) {
            return true;
        }
        return false;
    }, []);

    const handlePaste = useCallback(async (e) => {
        console.log('[Paste] Paste event fired. Items:', e.clipboardData?.items?.length, 'Files:', e.clipboardData?.files?.length);

        // Try sync extraction first (fastest, works on most browsers)
        let files = extractPasteFiles(e.clipboardData);

        if (files.length > 0) {
            console.log('[Paste] Sync extraction found', files.length, 'file(s)');
            e.preventDefault();
            await processFiles(files);
            return;
        }

        // Try extracting image from HTML clipboard (copied from web pages)
        const htmlImage = await extractImageFromHtml(e.clipboardData);
        if (htmlImage) {
            console.log('[Paste] HTML image extraction succeeded');
            e.preventDefault();
            await processFiles([htmlImage]);
            return;
        }

        // Async fallback: navigator.clipboard.read() for Linux/Wayland screenshots
        // On Linux, screenshots are often placed on the clipboard as raw image data
        // that isn't available through the sync clipboardData API.
        // Only preventDefault if the clipboard might contain image data (not plain text paste)
        const hasClipboardAPI = !!navigator.clipboard?.read;
        const maybeImage = clipboardMayHaveImage(e.clipboardData);

        if (hasClipboardAPI && maybeImage) {
            console.log('[Paste] Trying async clipboard API (Linux/Wayland screenshot fallback)');
            // Must preventDefault BEFORE the async call to avoid the textarea inserting garbage
            e.preventDefault();
            files = await readClipboardAsync();
            if (files.length > 0) {
                await processFiles(files);
            } else {
                console.log('[Paste] Async clipboard API returned no images');
            }
        }
        // If none of the above matched, let the default paste behavior handle it (text paste)
    }, [processFiles, extractPasteFiles, extractImageFromHtml, readClipboardAsync, clipboardMayHaveImage]);

    // Document-level paste listener (catches pastes ONLY when textarea doesn't have focus)
    useEffect(() => {
        const onDocumentPaste = async (e) => {
            if (!textareaRef.current) return;
            const activeEl = document.activeElement;
            // If the textarea has focus, its own onPaste handler already handles it — skip
            if (activeEl === textareaRef.current) return;
            // Skip other inputs/textareas too
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) return;

            console.log('[Paste/Doc] Document paste event. Items:', e.clipboardData?.items?.length, 'Files:', e.clipboardData?.files?.length);

            let files = extractPasteFiles(e.clipboardData);
            if (files.length > 0) {
                e.preventDefault();
                await processFiles(files);
                textareaRef.current?.focus();
                return;
            }

            // HTML image fallback
            const htmlImage = await extractImageFromHtml(e.clipboardData);
            if (htmlImage) {
                e.preventDefault();
                await processFiles([htmlImage]);
                textareaRef.current?.focus();
                return;
            }

            // Async clipboard API fallback — only if clipboard might have image data
            if (clipboardMayHaveImage(e.clipboardData)) {
                e.preventDefault();
                files = await readClipboardAsync();
                if (files.length > 0) {
                    await processFiles(files);
                    textareaRef.current?.focus();
                }
            }
        };

        document.addEventListener('paste', onDocumentPaste);
        return () => document.removeEventListener('paste', onDocumentPaste);
    }, [processFiles, extractPasteFiles, extractImageFromHtml, readClipboardAsync, clipboardMayHaveImage]);

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const getFileIcon = (type) => {
        if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
        if (type.includes('pdf') || type.includes('word') || type.includes('.document')) return <FileText className="w-4 h-4" />;
        if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return <FileSpreadsheet className="w-4 h-4" />;
        return <File className="w-4 h-4" />;
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleSend = () => {
        if ((!input.trim() && attachments.length === 0) || isLoading) return;
        onSendMessage(input, attachments, activeThreadParent);
        setInput('');
        setAttachments([]);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleKeyDown = (e) => {
        // On mobile, Enter creates a new line (send via button only)
        // On desktop, Enter sends, Shift+Enter creates new line
        if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
            e.preventDefault();
            handleSend();
        }
    };



    return (
        <>
            <div
                ref={dropZoneRef}
                className={`${isMobile ? 'px-2 py-1.5' : 'px-4 py-2.5'} bg-[var(--bg-primary)] relative z-20`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Drag overlay */}
                {isDragOver && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--accent-primary)] bg-opacity-10 border-2 border-dashed border-[var(--accent-primary)] rounded-xl backdrop-blur-sm pointer-events-none"
                        style={{ margin: '8px' }}
                    >
                        <div className="flex flex-col items-center gap-2 text-[var(--accent-primary)]">
                            <Image className="w-8 h-8" />
                            <span className="text-sm font-medium">Drop files here</span>
                        </div>
                    </div>
                )}

                <div className="max-w-3xl mx-auto">

                    {/* Thread Banner */}
                    {activeThreadParent && (
                        <div className="flex items-center justify-between bg-[var(--bg-secondary)] px-4 py-2 rounded-t-lg border-x border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] animate-slide-up">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="w-3 h-3 text-[var(--accent-primary)]" />
                                <span>Replying to <span className="font-medium text-[var(--text-primary)]">{threadTitle || 'Thread'}</span></span>
                            </div>
                            <button onClick={onExitThread} className="hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {/* Attachment Preview */}
                    {attachments.length > 0 && (
                        <div className={`flex flex-wrap gap-2 bg-[var(--bg-secondary)] px-3 py-2 border-x border-t border-[var(--border-subtle)] ${activeThreadParent ? '' : 'rounded-t-lg'}`}>
                            {attachments.map((att, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center gap-2 bg-[var(--bg-tertiary)] px-2 py-1.5 rounded-lg text-xs text-[var(--text-secondary)]"
                                >
                                    {att.type.startsWith('image/') ? (
                                        <img
                                            src={att.content}
                                            alt={att.name}
                                            className="w-8 h-8 object-cover rounded"
                                        />
                                    ) : (
                                        getFileIcon(att.type)
                                    )}
                                    <div className="flex flex-col min-w-0">
                                        <span className="truncate max-w-[120px] font-medium">{att.name}</span>
                                        <span className="text-[10px] text-[var(--text-tertiary)]">{formatFileSize(att.size)}</span>
                                    </div>
                                    <button
                                        onClick={() => removeAttachment(idx)}
                                        className="p-0.5 hover:bg-[var(--bg-secondary)] rounded text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}


                    <div className={`relative flex flex-col bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] shadow-sm transition-all focus-within:border-[var(--accent-primary)] focus-within:shadow-md ${(activeThreadParent || attachments.length > 0) ? 'rounded-t-none border-t-0' : ''} ${isDragOver ? 'border-[var(--accent-primary)]' : ''}`}>

                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            multiple
                            accept="image/*,.pdf,.docx,.csv,.xlsx,.xls,.txt,.md,.json,.js,.jsx,.ts,.tsx,.py,.html,.css"
                            className="hidden"
                        />

                        {/* Textarea Row */}
                        <div className={`${isMobile ? 'px-2' : 'px-4'} pt-3 pb-1`}>
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                placeholder={activeThreadParent ? "Reply to thread..." : directMode ? "Message AI..." : "Message " + (selectedAgent?.name || "Agent") + "..."}
                                rows={1}
                                className="w-full max-h-[180px] bg-transparent border-none focus:ring-0 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none py-2 text-[15px] leading-relaxed overflow-y-auto outline-none"
                            />
                        </div>

                        {/* Toolbar Row */}
                        <div className="flex items-center justify-between px-3 pb-3">
                            <div className="flex items-center gap-1">
                                {/* Attach Button */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                                    title="Attach file"
                                >
                                    <Paperclip className="w-5 h-5" />
                                </button>
                                {/* Multimedia Creation — grouped dropdown */}
                                <div className="relative">
                                    <button
                                        ref={mediaMenuBtnRef}
                                        onClick={() => setMediaMenuOpen(!mediaMenuOpen)}
                                        className={`p-2 rounded-lg transition-colors text-base leading-none ${mediaMenuOpen || imageGenOpen || musicGenOpen || elevenLabsOpen || videoGenOpen ? 'bg-purple-500/10 text-purple-400' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                                        title="Multimedia Creation"
                                    >
                                        🎨
                                    </button>
                                    {mediaMenuOpen && (
                                        <div
                                            ref={mediaMenuRef}
                                            className="absolute bottom-full left-0 mb-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-xl p-1.5 min-w-[180px] z-50"
                                        >
                                            <button
                                                ref={imageGenBtnRef}
                                                onClick={() => { setMediaMenuOpen(false); setImageGenOpen(true); }}
                                                onContextMenu={(e) => { e.preventDefault(); const next = { ...disabledMedia, image: !disabledMedia.image }; setDisabledMedia(next); localStorage.setItem('disabledMedia', JSON.stringify(next)); }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm text-left"
                                                style={{ opacity: disabledMedia.image ? 0.35 : 1 }}
                                            >
                                                <span className="text-base">🍌</span>
                                                <span className="text-[var(--text-primary)]">Image Generation</span>
                                            </button>
                                            <button
                                                ref={musicGenBtnRef}
                                                onClick={() => { setMediaMenuOpen(false); setMusicGenOpen(true); }}
                                                onContextMenu={(e) => { e.preventDefault(); const next = { ...disabledMedia, music: !disabledMedia.music }; setDisabledMedia(next); localStorage.setItem('disabledMedia', JSON.stringify(next)); }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm text-left"
                                                style={{ opacity: disabledMedia.music ? 0.35 : 1 }}
                                            >
                                                <span className="text-base">🎹</span>
                                                <span className="text-[var(--text-primary)]">Music Generation</span>
                                            </button>
                                            <button
                                                ref={elevenLabsBtnRef}
                                                onClick={() => { setMediaMenuOpen(false); setElevenLabsOpen(true); }}
                                                onContextMenu={(e) => { e.preventDefault(); const next = { ...disabledMedia, elevenlabs: !disabledMedia.elevenlabs }; setDisabledMedia(next); localStorage.setItem('disabledMedia', JSON.stringify(next)); }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm text-left"
                                                style={{ opacity: disabledMedia.elevenlabs ? 0.35 : 1 }}
                                            >
                                                <span className="text-base">🎵</span>
                                                <span className="text-[var(--text-primary)]">ElevenLabs</span>
                                            </button>
                                            <button
                                                ref={videoGenBtnRef}
                                                onClick={() => { setMediaMenuOpen(false); setVideoGenOpen(true); }}
                                                onContextMenu={(e) => { e.preventDefault(); const next = { ...disabledMedia, video: !disabledMedia.video }; setDisabledMedia(next); localStorage.setItem('disabledMedia', JSON.stringify(next)); }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm text-left"
                                                style={{ opacity: disabledMedia.video ? 0.35 : 1 }}
                                            >
                                                <span className="text-base">🎬</span>
                                                <span className="text-[var(--text-primary)]">Video Generation</span>
                                            </button>
                                        </div>
                                    )}
                                    <ImageGenSettings
                                        isOpen={imageGenOpen}
                                        onClose={() => setImageGenOpen(false)}
                                        anchorRef={imageGenBtnRef}
                                        settings={imageGenSettings}
                                        onSettingsChange={setImageGenSettings}
                                    />
                                    <MusicGenSettings
                                        isOpen={musicGenOpen}
                                        onClose={() => setMusicGenOpen(false)}
                                        anchorRef={musicGenBtnRef}
                                    />
                                    <ElevenLabsSettings
                                        isOpen={elevenLabsOpen}
                                        onClose={() => setElevenLabsOpen(false)}
                                        anchorRef={elevenLabsBtnRef}
                                    />
                                    <VideoGenSettings
                                        isOpen={videoGenOpen}
                                        onClose={() => setVideoGenOpen(false)}
                                        anchorRef={videoGenBtnRef}
                                    />
                                </div>
                                {/* Apps Button — hidden if no apps available */}
                                {(() => {
                                    const n8nAppDefs = n8nWorkflows.map(wf => ({
                                        id: `n8n_run_${wf.slug}`,
                                        label: wf.name,
                                        description: wf.description || 'n8n workflow',
                                        iconSvg: (s = 'w-5 h-5') => <img src="/n8n-color.png" alt="n8n" className={`${s} object-contain`} />,
                                        isN8n: true,
                                    }));
                                    const allAppDefs = [...APP_DEFS, ...n8nAppDefs];
                                    const availableApps = allAppDefs.filter(app => {
                                        // Base availability checks
                                        if (app.requiresGoogle && !isGoogleUser) return false;
                                        if (app.requiresFireflies && !hasFirefliesKey) return false;
                                        if (app.requiresYouTrack && !hasYouTrackConfig) return false;
                                        if (app.requiresGamma && !hasGammaKey) return false;
                                        if (app.requiresWhatsApp && !hasWhatsApp) return false;
                                        if (orgEnabledIntegrations && !app.isN8n && !orgEnabledIntegrations.includes(app.id)) return false;
                                        if (app.requiresNone) return false;
                                        // Agent-level integration filtering
                                        if (agentIntegrations) {
                                            if (app.isN8n) return agentIntegrations.includes('n8n');
                                            return agentIntegrations.includes(app.id);
                                        }
                                        return true;
                                    });
                                    if (availableApps.length === 0) return null;
                                    return (
                                        <div className="relative" ref={appsRef}>
                                            <button
                                                onClick={() => { setAppsOverlayOpen(v => !v); setAppSearch(''); }}
                                                className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${appsOverlayOpen ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                                                title="Apps"
                                            >
                                                <LayoutGrid className="w-5 h-5" />
                                            </button>
                                            {appsOverlayOpen && (() => {
                                                const filtered = appSearch.trim()
                                                    ? availableApps.filter(a => a.label.toLowerCase().includes(appSearch.toLowerCase()) || a.description.toLowerCase().includes(appSearch.toLowerCase()))
                                                    : availableApps;
                                                const handleAppClick = (app) => {
                                                    if (!isAppEnabled(app.id)) return;
                                                    setAppsOverlayOpen(false);
                                                    switch (app.id) {
                                                        case 'google-drive': setDrivePickerOpen(true); break;
                                                        case 'gmail': setGmailPickerOpen(true); break;
                                                        case 'google-calendar': setInput("What's on my calendar this week?"); break;
                                                        case 'google-slides': setInput('List my recent presentations'); break;
                                                        case 'google-sheets': setInput('List my Google Sheets spreadsheets'); break;
                                                        case 'google-docs': setInput('List my recent Google Docs documents'); break;
                                                        case 'fireflies': setInput('List my recent meeting transcripts'); break;
                                                        case 'youtrack': setInput('Search my YouTrack issues'); break;
                                                        case 'gamma': setInput('Create a presentation about '); break;
                                                        case 'whatsapp': setInput('List my recent WhatsApp chats'); break;
                                                        default:
                                                            if (app.isN8n) {
                                                                setInput(`Run the ${app.label} workflow `);
                                                            }
                                                            break;

                                                    }
                                                };
                                                return (
                                                    <div
                                                        className="absolute bottom-full left-0 mb-2 w-80 rounded-xl border shadow-2xl overflow-hidden z-50"
                                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', animation: 'appsOverlayIn .15s ease-out' }}
                                                    >
                                                        {/* Header */}
                                                        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Apps</h3>
                                                                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                                                    {availableApps.filter(a => isAppEnabled(a.id)).length}/{availableApps.length} active
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] mb-2.5" style={{ color: 'var(--text-tertiary)' }}>Click to use · Toggle to enable/disable</p>
                                                            {/* Search */}
                                                            <input
                                                                type="text"
                                                                value={appSearch}
                                                                onChange={e => setAppSearch(e.target.value)}
                                                                placeholder="Search apps..."
                                                                autoFocus
                                                                className="w-full px-3 py-1.5 text-sm rounded-lg border outline-none transition-colors focus:border-[var(--accent-primary)]"
                                                                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                                            />
                                                        </div>
                                                        {/* App List */}
                                                        <div className="p-1.5 max-h-72 overflow-y-auto">
                                                            {filtered.length === 0 ? (
                                                                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>No apps found</div>
                                                            ) : filtered.map(app => {
                                                                const enabled = isAppEnabled(app.id);
                                                                return (
                                                                    <div
                                                                        key={app.id}
                                                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${enabled ? 'cursor-pointer hover:bg-[var(--bg-tertiary)]' : 'opacity-50'}`}
                                                                        onClick={() => handleAppClick(app)}
                                                                    >
                                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--bg-tertiary)]">
                                                                            {app.iconSvg('w-5 h-5')}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{app.label}</div>
                                                                            <div className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>{app.description}</div>
                                                                        </div>
                                                                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                                            <input type="checkbox" checked={enabled} onChange={() => toggleApp(app.id)} className="sr-only peer" />
                                                                            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                                                        </label>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Model Tier Selector (Direct Mode) */}
                                {directMode && modelTiers && (
                                    <div className="mr-1">
                                        <ModelTierSelector
                                            tiers={modelTiers}
                                            value={selectedTier}
                                            onChange={onTierChange}
                                        />
                                    </div>
                                )}

                                {/* Send / Stop Buttons */}
                                {isLoading ? (
                                    <button
                                        onClick={onStopGenerating}
                                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm active:scale-95 transform duration-100"
                                        title="Stop generating"
                                    >
                                        <StopCircle className="w-5 h-5" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() && attachments.length === 0}
                                        className="p-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95 transform duration-100"
                                        title="Send message (Enter)"
                                    >
                                        <ArrowUp className="w-6 h-6" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>


                    <div className="text-center mt-1.5 mb-0.5 select-none">
                        <p className="text-[10px] text-[var(--text-tertiary)]">
                            {warningText || 'AI can make mistakes. Please verify important information.'}
                            {!isMobile && (
                                <>
                                    <span className="mx-1.5">·</span>
                                    <span>Shift+Enter for new line</span>
                                </>
                            )}
                        </p>
                    </div>

                    <style>{`
                        @keyframes appsOverlayIn {
                            from { opacity: 0; transform: translateY(4px); }
                            to   { opacity: 1; transform: translateY(0); }
                        }
                    `}</style>
                </div>
            </div>

            {/* Google Drive Picker Modal */}
            <GoogleDrivePicker
                isOpen={drivePickerOpen}
                onClose={() => setDrivePickerOpen(false)}
                apiBase={API_BASE}
                onFilesSelected={(driveFiles) => {
                    const newAttachments = driveFiles.map(f => ({
                        name: f.name,
                        type: f.type || 'text/plain',
                        size: f.size || f.content?.length || 0,
                        content: f.content,
                        source: 'google-drive',
                    }));
                    setAttachments(prev => [...prev, ...newAttachments]);
                }}
            />

            {/* Gmail Picker Modal */}
            <GmailPicker
                isOpen={gmailPickerOpen}
                onClose={() => setGmailPickerOpen(false)}
                apiBase={API_BASE}
                onFilesSelected={(emailFiles) => {
                    const newAttachments = emailFiles.map(f => ({
                        name: f.name,
                        type: f.type || 'text/plain',
                        size: f.size || f.content?.length || 0,
                        content: f.content,
                        source: 'gmail',
                    }));
                    setAttachments(prev => [...prev, ...newAttachments]);
                }}
            />
        </>
    );
};
export default InputArea;

