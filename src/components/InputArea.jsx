import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, StopCircle, MessageCircle, FileText, Image, File as FileIcon, FileSpreadsheet, ArrowUp, Sparkles, LayoutGrid, Globe, BookOpen, Brain } from 'lucide-react';
import ModelTierSelector from './ModelTierSelector';
import EffortSelector from './EffortSelector';
import GoogleDrivePicker from './chat/GoogleDrivePicker';
import GmailPicker from './chat/GmailPicker';
import ImageGenSettings, { loadSettings } from './chat/ImageGenSettings';
import MusicGenSettings from './chat/MusicGenSettings';
import ElevenLabsSettings from './chat/ElevenLabsSettings';
import VideoGenSettings from './chat/VideoGenSettings';
import { API_BASE, authFetch } from '../utils/helpers';
import scopedStorage from '../utils/scopedStorage';
import SkillsPopover from './skills/SkillsPopover';
import ActiveSkillChips from './skills/ActiveSkillChips';
import VoiceCallButton from './chat/Voice/VoiceCallButton';
import VoiceInlinePanel from './chat/Voice/VoiceInlinePanel';
import { getIntegrationLogo } from '../utils/integrationLogos';
import { resizeImageForUpload, readAsDataUrl } from '../utils/imageResize';

// Tailwind w-N h-N → pixel dimensions for the chat sidebar's iconSvg
// callers (Tailwind defaults: w-4=16, w-5=20, w-6=24).
const TW_SIZE_TO_PX = { 'w-4 h-4': 16, 'w-5 h-5': 20, 'w-6 h-6': 24 };
function renderAppLogo(id, sizeClass = 'w-5 h-5') {
    const Logo = getIntegrationLogo(id);
    const px = TW_SIZE_TO_PX[sizeClass] || 20;
    if (Logo) return <Logo size={px} className={sizeClass} />;
    // Fallback: a brand-coloured letter mark would also work but the
    // shared logos cover every catalog id today, so this branch is only
    // hit if an entry above references an id we haven't authored yet.
    return <span className={`${sizeClass} flex items-center justify-center text-base`}>•</span>;
}

// App definitions for the apps overlay. Each entry's iconSvg is a thin
// wrapper around the shared INTEGRATION_LOGOS map so the chat sidebar
// and the automation palette always render the same brand mark.
const APP_DEFS = [
    { id: 'google-drive',    label: 'Google Drive',    description: 'Attach files from Drive',                requiresGoogle: true,    iconSvg: (s = 'w-5 h-5') => renderAppLogo('google-drive', s) },
    { id: 'gmail',           label: 'Gmail',           description: 'Attach emails',                          requiresGoogle: true,    iconSvg: (s = 'w-5 h-5') => renderAppLogo('gmail', s) },
    { id: 'google-calendar', label: 'Google Calendar', description: 'Ask about your schedule',                requiresGoogle: true,    iconSvg: (s = 'w-5 h-5') => renderAppLogo('google-calendar', s) },
    { id: 'google-slides',   label: 'Google Slides',   description: 'Ask about presentations',                requiresGoogle: true,    iconSvg: (s = 'w-5 h-5') => renderAppLogo('google-slides', s) },
    { id: 'google-sheets',   label: 'Google Sheets',   description: 'Create & edit spreadsheets',             requiresGoogle: true,    iconSvg: (s = 'w-5 h-5') => renderAppLogo('google-sheets', s) },
    { id: 'google-docs',     label: 'Google Docs',     description: 'Create & read documents',                requiresGoogle: true,    iconSvg: (s = 'w-5 h-5') => renderAppLogo('google-docs', s) },
    { id: 'google-contacts', label: 'Google Contacts', description: 'Search, create & update contacts',       requiresGoogle: true,    iconSvg: (s = 'w-5 h-5') => renderAppLogo('google-contacts', s) },
    { id: 'google-keep',     label: 'Google Keep',     description: 'List, create & delete notes',            requiresGoogle: true,    iconSvg: (s = 'w-5 h-5') => renderAppLogo('google-keep', s) },
    { id: 'outlook',         label: 'Outlook',         description: 'Send & read emails',                     requiresMicrosoft: true, iconSvg: (s = 'w-5 h-5') => renderAppLogo('outlook', s) },
    { id: 'outlook-readonly', label: 'Outlook Read-Only', description: 'Search and read emails',               requiresMicrosoft: true, iconSvg: (s = 'w-5 h-5') => renderAppLogo('outlook-readonly', s) },
    { id: 'ms-calendar',     label: 'MS Calendar',     description: 'Manage your schedule',                   requiresMicrosoft: true, iconSvg: (s = 'w-5 h-5') => renderAppLogo('ms-calendar', s) },
    { id: 'onedrive',        label: 'OneDrive',        description: 'Access files & folders',                 requiresMicrosoft: true, iconSvg: (s = 'w-5 h-5') => renderAppLogo('onedrive', s) },
    { id: 'ms-contacts',     label: 'MS Contacts',     description: 'Search & manage contacts',               requiresMicrosoft: true, iconSvg: (s = 'w-5 h-5') => renderAppLogo('ms-contacts', s) },
    { id: 'fireflies',       label: 'Fireflies.ai',    description: 'Meeting transcripts',                    requiresFireflies: true, iconSvg: (s = 'w-5 h-5') => renderAppLogo('fireflies', s) },
    { id: 'youtrack',        label: 'YouTrack',        description: 'Issues and projects',                    requiresYouTrack: true,  iconSvg: (s = 'w-5 h-5') => renderAppLogo('youtrack', s) },
    { id: 'gamma',           label: 'Gamma',           description: 'AI presentations',                       requiresGamma: true,     iconSvg: (s = 'w-5 h-5') => renderAppLogo('gamma', s) },
    { id: 'web-search',      label: 'Web Search',      description: 'Search the web',                         requiresNone: true,      iconSvg: (s = 'w-5 h-5') => renderAppLogo('web-search', s) },
    { id: 'google-maps',     label: 'Google Maps',     description: 'Directions, routes & places',            requiresNone: true,      iconSvg: (s = 'w-5 h-5') => renderAppLogo('google-maps', s) },
    { id: 'image-gen',       label: 'Image Generation', description: 'AI image creation settings',            requiresNone: true,      iconSvg: (s = 'w-5 h-5') => renderAppLogo('image-gen', s) },
    { id: 'elevenlabs',      label: 'ElevenLabs',      description: 'Music with vocals, TTS & sound effects', requiresNone: true,      iconSvg: (s = 'w-5 h-5') => renderAppLogo('elevenlabs', s) },
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
    isMobile,
    user,
    activeSkillIds = [],
    agentAttachedSkillIds = [],
    directSessionSkills = [],
    directActivatedSessionSkillIds = [],
    directConversationId = null,
    onToggleSkill,
    // Direct-chat KB picker (only shown in direct mode).
    availableKBs = [],
    selectedKBIds = [],
    onChangeKBIds,
    // Voice mode wiring — parent passes its live messages list so voice
    // turns use the real chat history as context, and injects completed
    // turns back via onVoiceTurnComplete so they render as chat bubbles.
    messages,
    onVoiceTurnComplete,
}) => {
    const [voiceMode, setVoiceMode] = useState(false);
    // Live-read accessor used by the voice hook — avoids stale closures
    // over the `messages` prop while a turn is streaming.
    const messagesRef = useRef(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);
    const getHistoryForVoice = useCallback(() => messagesRef.current || [], []);
    const handleVoiceTurn = useCallback((turn) => {
        if (onVoiceTurnComplete) onVoiceTurnComplete(turn);
    }, [onVoiceTurnComplete]);
    // Simple Mode strips the composer toolbar to attachment + web search.
    // Model tier defaults to 'auto' (server resolves) and the secondary icons
    // (memory, KB, voice, skills, apps) are hidden until the user turns it off.
    const _simpleMode = !!user?.simpleMode;
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
    // Per-integration enable/disable — user-scoped so toggling "disable images"
    // as user A doesn't persist into user B's composer on the same browser.
    const [disabledMedia, setDisabledMedia] = useState(() => scopedStorage.getJSON('disabledMedia', {}));
    const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
        const v = scopedStorage.getItem('webSearchEnabled');
        return v === null ? true : v === 'true';
    });
    // Memory write toggle — when off, the server skips memoryExtractor for this
    // session. The read path (existing memories injected into prompt) still
    // works so the user keeps context they've already curated.
    const [memoryWriteEnabled, setMemoryWriteEnabled] = useState(() => {
        const v = scopedStorage.getItem('memoryWriteEnabled');
        return v === null ? true : v === 'true';
    });
    const [showKBPicker, setShowKBPicker] = useState(false);
    const [kbPickerSearch, setKbPickerSearch] = useState('');
    const kbPickerRef = useRef(null);

    useEffect(() => {
        if (!showKBPicker) return;
        const onClick = (e) => {
            if (kbPickerRef.current && !kbPickerRef.current.contains(e.target)) {
                setShowKBPicker(false);
            }
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [showKBPicker]);

    const toggleKBId = (id) => {
        if (typeof onChangeKBIds !== 'function') return;
        const next = selectedKBIds.includes(id)
            ? selectedKBIds.filter(k => k !== id)
            : [...selectedKBIds, id];
        onChangeKBIds(next);
    };

    const filteredKBs = (availableKBs || []).filter(kb => {
        if (!kbPickerSearch.trim()) return true;
        const q = kbPickerSearch.toLowerCase();
        return (kb.name || '').toLowerCase().includes(q) || (kb.description || '').toLowerCase().includes(q);
    });
    const [orgDisableSearchOnUpload, setOrgDisableSearchOnUpload] = useState(false);
    const [searchProviderConfig, setSearchProviderConfig] = useState('agent-search');
    const [hasFirefliesKey, setHasFirefliesKey] = useState(false);
    const [orgEnabledIntegrations, setOrgEnabledIntegrations] = useState(null);
    const [hasGoogleKey, setHasGoogleKey] = useState(false);
    const [hasElevenLabsKey, setHasElevenLabsKey] = useState(false);
    const [hasYouTrackConfig, setHasYouTrackConfig] = useState(false);
    const [hasGammaKey, setHasGammaKey] = useState(false);
    const [n8nWorkflows, setN8nWorkflows] = useState([]);
    const [mcpServers, setMcpServers] = useState([]);

    const [isGoogleUser, setIsGoogleUser] = useState(false);
    const [isMicrosoftUser, setIsMicrosoftUser] = useState(false);
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

    const isTouchDevice = typeof window !== 'undefined'
        && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

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

    // Auto-resize textarea. We toggle overflow-y inline so the scrollbar
    // (or its native +/- arrows on some GTK themes) only appears once the
    // content actually exceeds the 180px cap — otherwise it stays hidden.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        const needsScroll = el.scrollHeight > 180;
        el.style.height = Math.min(el.scrollHeight, 180) + 'px';
        el.style.overflowY = needsScroll ? 'auto' : 'hidden';
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
                    setIsMicrosoftUser(!!data.isMicrosoftUser);
                    if (data.enabledApps) setEnabledApps(data.enabledApps);
                    if (data.orgEnabledIntegrations !== undefined) setOrgEnabledIntegrations(data.orgEnabledIntegrations);
                    if (data.hasGoogleKey !== undefined) setHasGoogleKey(data.hasGoogleKey);
                    if (data.hasElevenLabsKey !== undefined) setHasElevenLabsKey(data.hasElevenLabsKey);
                    if (data.disableSearchOnUpload) setOrgDisableSearchOnUpload(true);
                    if (data.searchProvider) setSearchProviderConfig(data.searchProvider);
                }
            })
            .catch(() => { });
        // Fetch n8n workflows if n8n is available
        authFetch(`${API_BASE}/ai/n8n/config`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.workflows?.length) {
                    setN8nWorkflows(data.workflows.filter(w => w.enabled && !w.allowKbIngestion));
                }
            })
            .catch(() => { });
        // Fetch MCP servers for apps menu
        authFetch(`${API_BASE}/ai/mcp-servers/user-credentials`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.servers?.length) {
                    setMcpServers(data.servers.filter(s => s.toolCount > 0));
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

            let content;
            let finalType = file.type || 'application/octet-stream';
            let finalSize = file.size;

            if (file.type && file.type.startsWith('image/')) {
                try {
                    const resized = await resizeImageForUpload(file);
                    content = resized.dataUrl;
                    finalType = resized.mimeType;
                    finalSize = resized.resizedSize;
                } catch (err) {
                    console.warn(`Image resize failed for ${file.name}, using original:`, err);
                    content = await readAsDataUrl(file);
                }
            } else {
                content = await readAsDataUrl(file);
            }

            newAttachments.push({
                name: file.name,
                type: finalType,
                size: finalSize,
                content,
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
        // Check for any image type in items
        for (const item of items) {
            if (item.type.startsWith('image/')) return true;
        }
        // Also check files list
        const clipFiles = Array.from(clipboardData.files || []);
        if (clipFiles.some(f => f.type.startsWith('image/'))) return true;
        // On Linux/Wayland, screenshot images are only accessible via the async
        // navigator.clipboard.read() API — clipboardData.items will be empty.
        // Text paste on the same systems DOES populate items with text/plain,
        // so empty items reliably signals a potential screenshot, not plain text.
        if (items.length === 0 && clipFiles.length === 0) return true;
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
        // This fires when the sync clipboardData shows image MIME types but getAsFile()
        // returns null (a known Wayland/browser quirk).
        // We also try if items has explicit image types but sync extraction somehow missed them.
        const hasClipboardAPI = !!navigator.clipboard?.read;
        const maybeImage = clipboardMayHaveImage(e.clipboardData);

        if (hasClipboardAPI && maybeImage) {
            console.log('[Paste] Trying async clipboard API (Linux/Wayland screenshot fallback)');
            // Check permission first to avoid blocking text paste if denied
            let permissionOk = true;
            try {
                const perm = await navigator.permissions.query({ name: 'clipboard-read' });
                if (perm.state === 'denied') {
                    console.warn('[Paste] clipboard-read permission denied — skipping async API, letting text paste proceed');
                    permissionOk = false;
                }
            } catch (_) { /* permissions API not available — proceed optimistically */ }

            if (permissionOk) {
                // Must preventDefault BEFORE the async call to avoid the textarea inserting garbage
                e.preventDefault();
                files = await readClipboardAsync();
                if (files.length > 0) {
                    await processFiles(files);
                } else {
                    console.log('[Paste] Async clipboard API returned no images');
                }
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

            // Async clipboard API fallback — only if items explicitly show image types
            if (clipboardMayHaveImage(e.clipboardData) && navigator.clipboard?.read) {
                let permissionOk = true;
                try {
                    const perm = await navigator.permissions.query({ name: 'clipboard-read' });
                    if (perm.state === 'denied') permissionOk = false;
                } catch (_) { /* proceed */ }

                if (permissionOk) {
                    e.preventDefault();
                    files = await readClipboardAsync();
                    if (files.length > 0) {
                        await processFiles(files);
                        textareaRef.current?.focus();
                    }
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
        return <FileIcon className="w-4 h-4" />;
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
        // Enter sends on desktop (incl. narrow windows). On true touch
        // devices Enter inserts a newline — send via the button.
        if (e.key === 'Enter' && !e.shiftKey && !isTouchDevice) {
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
                        <div className={`flex flex-wrap gap-2 bg-[var(--bg-secondary)] px-3 py-2.5 border-x border-t border-[var(--border-subtle)] ${activeThreadParent ? '' : 'rounded-t-xl'}`}>
                            {attachments.map((att, idx) =>
                                att.type.startsWith('image/') ? (
                                    // Image attachment — card with thumbnail + overlaid remove button
                                    <div
                                        key={idx}
                                        className="relative group flex-shrink-0"
                                    >
                                        <img
                                            src={att.content}
                                            alt={att.name}
                                            className="w-16 h-16 object-cover rounded-xl border border-[var(--border-subtle)] shadow-sm"
                                        />
                                        {/* Filename overlay at bottom */}
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 rounded-b-xl px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-white text-[9px] truncate block">{att.name}</span>
                                        </div>
                                        {/* Remove button — top-right corner */}
                                        <button
                                            onClick={() => removeAttachment(idx)}
                                            className="absolute -top-1.5 -right-1.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:border-red-300 hover:text-red-500 text-[var(--text-tertiary)]"
                                            aria-label="Remove attachment"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    // Non-image attachment — refined pill
                                    <div
                                        key={idx}
                                        className="flex items-center gap-2 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--border-primary)] px-2.5 py-2 rounded-xl text-xs text-[var(--text-secondary)] transition-colors group"
                                    >
                                        <div className="text-[var(--text-tertiary)]">{getFileIcon(att.type)}</div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate max-w-[120px] font-medium text-[var(--text-primary)]">{att.name}</span>
                                            <span className="text-[10px] text-[var(--text-tertiary)]">{formatFileSize(att.size)}</span>
                                        </div>
                                        <button
                                            onClick={() => removeAttachment(idx)}
                                            className="p-0.5 ml-0.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                                            aria-label="Remove attachment"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )
                            )}
                        </div>
                    )}


                    {/* Active Skills Preview — shows which skills apply to the next send */}
                    <ActiveSkillChips
                        activeSkillIds={activeSkillIds}
                        attachedSkillIds={agentAttachedSkillIds}
                        onToggleSkill={onToggleSkill}
                        hasThreadBanner={!!activeThreadParent}
                        hasAttachments={attachments.length > 0}
                    />

                    {voiceMode ? (
                        <VoiceInlinePanel
                            agentId={selectedAgent?.id || null}
                            agentName={selectedAgent?.name || null}
                            getHistory={getHistoryForVoice}
                            onTurnComplete={handleVoiceTurn}
                            onExit={() => setVoiceMode(false)}
                            isMobile={isMobile}
                        />
                    ) : (
                    <div role="form" aria-label="Chat message input" data-testid="chat-input-form" className={`chat-composer relative flex flex-col rounded-2xl transition-all focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/35 ${(activeThreadParent || attachments.length > 0 || activeSkillIds.length > 0 || agentAttachedSkillIds.length > 0) ? 'rounded-t-none' : ''} ${isDragOver ? 'ring-2 ring-[var(--accent-primary)]' : ''}`}>

                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            multiple
                            accept="image/*,.pdf,.docx,.csv,.xlsx,.xls,.txt,.md,.json,.js,.jsx,.ts,.tsx,.py,.html,.css"
                            className="hidden"
                            aria-label="Upload file attachment"
                            data-testid="file-upload"
                        />

                        {/* Textarea Row */}
                        <div className={`${isMobile ? 'px-2' : 'px-4'} pt-3 pb-1`}>
                            <textarea
                                ref={textareaRef}
                                id="chat-message-input"
                                name="message"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                placeholder={activeThreadParent ? "Reply to thread..." : directMode ? "Message AI..." : "Message " + (selectedAgent?.name || "Agent") + "..."}
                                aria-label="Chat message"
                                data-testid="chat-message-input"
                                rows={1}
                                className="w-full max-h-[180px] bg-transparent border-none focus:ring-0 text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none py-2 text-[15px] leading-relaxed outline-none"
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
                                    aria-label="Attach file"
                                    data-testid="attach-file-button"
                                >
                                    <Paperclip className="w-5 h-5" />
                                </button>
                                {/* Multimedia Creation — grouped dropdown (gated by org settings + agent disableExternalTools) */}
                                {!selectedAgent?.config?.disableExternalTools && (() => {
                                    const orgOn = (id) => !orgEnabledIntegrations || orgEnabledIntegrations.includes(id);
                                    const showImageGen = orgOn('image-gen') && hasGoogleKey;
                                    const showMusicGen = orgOn('music-gen') && hasGoogleKey;
                                    const showElevenLabs = orgOn('elevenlabs') && hasElevenLabsKey;
                                    const showVideoGen = orgOn('video-gen') && hasGoogleKey;
                                    if (!showImageGen && !showMusicGen && !showElevenLabs && !showVideoGen) return null;
                                    return (
                                        <div className="relative">
                                            <button
                                                ref={mediaMenuBtnRef}
                                                onClick={() => setMediaMenuOpen(!mediaMenuOpen)}
                                                className={`p-2 rounded-lg transition-colors text-base leading-none ${mediaMenuOpen || imageGenOpen || musicGenOpen || elevenLabsOpen || videoGenOpen ? 'bg-purple-500/10 text-purple-400' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                                                title="Multimedia Creation"
                                                aria-label="Multimedia Creation"
                                                data-testid="multimedia-button"
                                            >
                                                🎨
                                            </button>
                                            {mediaMenuOpen && (
                                                <div
                                                    ref={mediaMenuRef}
                                                    className="absolute bottom-full left-0 mb-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-xl p-1.5 min-w-[180px] z-50"
                                                >
                                                    {showImageGen && (
                                                        <button
                                                            ref={imageGenBtnRef}
                                                            onClick={() => { setMediaMenuOpen(false); setImageGenOpen(true); }}
                                                            onContextMenu={(e) => { e.preventDefault(); const next = { ...disabledMedia, image: !disabledMedia.image }; setDisabledMedia(next); scopedStorage.setJSON('disabledMedia', next); }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm text-left"
                                                            style={{ opacity: disabledMedia.image ? 0.35 : 1 }}
                                                        >
                                                            <span className="text-base">🍌</span>
                                                            <span className="text-[var(--text-primary)]">Image Generation</span>
                                                        </button>
                                                    )}
                                                    {showMusicGen && (
                                                        <button
                                                            ref={musicGenBtnRef}
                                                            onClick={() => { setMediaMenuOpen(false); setMusicGenOpen(true); }}
                                                            onContextMenu={(e) => { e.preventDefault(); const next = { ...disabledMedia, music: !disabledMedia.music }; setDisabledMedia(next); scopedStorage.setJSON('disabledMedia', next); }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm text-left"
                                                            style={{ opacity: disabledMedia.music ? 0.35 : 1 }}
                                                        >
                                                            <span className="text-base">🎹</span>
                                                            <span className="text-[var(--text-primary)]">Music Generation</span>
                                                        </button>
                                                    )}
                                                    {showElevenLabs && (
                                                        <button
                                                            ref={elevenLabsBtnRef}
                                                            onClick={() => { setMediaMenuOpen(false); setElevenLabsOpen(true); }}
                                                            onContextMenu={(e) => { e.preventDefault(); const next = { ...disabledMedia, elevenlabs: !disabledMedia.elevenlabs }; setDisabledMedia(next); scopedStorage.setJSON('disabledMedia', next); }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm text-left"
                                                            style={{ opacity: disabledMedia.elevenlabs ? 0.35 : 1 }}
                                                        >
                                                            <span className="text-base">🎵</span>
                                                            <span className="text-[var(--text-primary)]">ElevenLabs</span>
                                                        </button>
                                                    )}
                                                    {showVideoGen && (
                                                        <button
                                                            ref={videoGenBtnRef}
                                                            onClick={() => { setMediaMenuOpen(false); setVideoGenOpen(true); }}
                                                            onContextMenu={(e) => { e.preventDefault(); const next = { ...disabledMedia, video: !disabledMedia.video }; setDisabledMedia(next); scopedStorage.setJSON('disabledMedia', next); }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm text-left"
                                                            style={{ opacity: disabledMedia.video ? 0.35 : 1 }}
                                                        >
                                                            <span className="text-base">🎬</span>
                                                            <span className="text-[var(--text-primary)]">Video Generation</span>
                                                        </button>
                                                    )}
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
                                    );
                                })()}
                                {/* Web Search Toggle (gated by org settings for agent-search + agent disableExternalTools) */}
                                {!selectedAgent?.config?.disableExternalTools && searchProviderConfig !== 'disabled' && (!orgEnabledIntegrations || orgEnabledIntegrations.includes('agent-search')) && (
                                <button
                                    onClick={() => {
                                        if (orgDisableSearchOnUpload && attachments.length > 0) return;
                                        const next = !webSearchEnabled;
                                        setWebSearchEnabled(next);
                                        scopedStorage.setItem('webSearchEnabled', String(next));
                                    }}
                                    className={`p-2 rounded-lg transition-colors ${
                                        orgDisableSearchOnUpload && attachments.length > 0
                                            ? 'composer-toggle-warn opacity-60 cursor-not-allowed'
                                            : webSearchEnabled
                                                ? 'composer-toggle-on'
                                                : 'text-[var(--text-tertiary)] opacity-40 hover:opacity-70 hover:bg-[var(--bg-tertiary)]'
                                    }`}
                                    title={orgDisableSearchOnUpload && attachments.length > 0 ? 'Web search disabled by organisation policy (files attached)' : webSearchEnabled ? 'Web search enabled (click to disable)' : 'Web search disabled (click to enable)'}
                                    aria-label={webSearchEnabled ? 'Web search enabled' : 'Web search disabled'}
                                    aria-pressed={webSearchEnabled}
                                    data-testid="web-search-toggle"
                                >
                                    <Globe className="w-5 h-5" />
                                </button>
                                )}
                                {/* Memory Write Toggle — pause saving new memories for this session. */}
                                {!_simpleMode && (
                                    <button
                                        onClick={() => {
                                            const next = !memoryWriteEnabled;
                                            setMemoryWriteEnabled(next);
                                            scopedStorage.setItem('memoryWriteEnabled', String(next));
                                        }}
                                        className={`p-2 rounded-lg transition-colors ${memoryWriteEnabled ? 'composer-toggle-on' : 'text-[var(--text-tertiary)] opacity-40 hover:opacity-70 hover:bg-[var(--bg-tertiary)]'}`}
                                        title={memoryWriteEnabled ? 'Memory saving enabled (click to pause)' : 'Memory saving paused (click to resume)'}
                                        aria-label={memoryWriteEnabled ? 'Memory saving enabled' : 'Memory saving paused'}
                                        aria-pressed={memoryWriteEnabled}
                                        data-testid="memory-write-toggle"
                                    >
                                        <Brain className="w-5 h-5" />
                                    </button>
                                )}
                                {/* Knowledge Bases picker — only in direct mode. Lets the user
                                    attach KBs they have access to so the backend grounds answers
                                    on their content via /api/kb search. */}
                                {!_simpleMode && directMode && typeof onChangeKBIds === 'function' && (user?.isAdmin || (user?.permissions || []).includes('all') || (Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('knowledge_bases_beta'))) && (
                                    <div className="relative" ref={kbPickerRef}>
                                        <button
                                            onClick={() => setShowKBPicker(v => !v)}
                                            className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${selectedKBIds.length > 0 ? 'composer-toggle-on' : 'text-[var(--text-tertiary)] opacity-60 hover:opacity-90 hover:bg-[var(--bg-tertiary)]'}`}
                                            title={selectedKBIds.length > 0 ? `${selectedKBIds.length} knowledge base${selectedKBIds.length > 1 ? 's' : ''} attached` : 'Attach knowledge bases'}
                                            aria-label="Attach knowledge bases"
                                            aria-pressed={selectedKBIds.length > 0}
                                            data-testid="direct-kb-picker"
                                            type="button"
                                        >
                                            <BookOpen className="w-5 h-5" />
                                            {selectedKBIds.length > 0 && (
                                                <span
                                                    className="text-[10px] font-bold leading-none px-1 rounded"
                                                    style={{ background: 'var(--accent-primary)', color: 'var(--accent-primary-fg, #fff)' }}
                                                >{selectedKBIds.length}</span>
                                            )}
                                        </button>

                                        {showKBPicker && (
                                            <div
                                                className="absolute bottom-full left-0 mb-2 w-[22rem] rounded-2xl z-50 overflow-hidden"
                                                style={{
                                                    background: 'var(--bg-card)',
                                                    border: '1px solid var(--border-default)',
                                                    boxShadow: 'var(--shadow-popover, 0 12px 36px rgba(15,23,42,0.18))',
                                                    animation: 'modelTierPanelIn 140ms cubic-bezier(0.22, 1, 0.36, 1) both',
                                                    transformOrigin: 'bottom left',
                                                }}
                                            >
                                                <div className="px-3.5 pt-3 pb-2">
                                                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Knowledge Bases</p>
                                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Pick one or more to ground this chat.</p>
                                                </div>
                                                <div className="px-3 pb-2">
                                                    <input
                                                        type="text"
                                                        value={kbPickerSearch}
                                                        onChange={e => setKbPickerSearch(e.target.value)}
                                                        placeholder="Search…"
                                                        className="w-full px-3 py-1.5 rounded-lg border text-xs outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/25"
                                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                                    />
                                                </div>
                                                <div className="max-h-72 overflow-auto px-1.5 pb-1.5">
                                                    {filteredKBs.length === 0 ? (
                                                        <div className="px-3 py-6 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                                                            {availableKBs.length === 0
                                                                ? 'No knowledge bases available. Create one in the Knowledge Bases section.'
                                                                : 'No matches.'}
                                                        </div>
                                                    ) : (
                                                        filteredKBs.map(kb => {
                                                            const checked = selectedKBIds.includes(kb.id);
                                                            const isEmpty = !(kb.document_count || 0);
                                                            // Visibility badge — derive from the actual publish state
                                                            // rather than just `organization_id`, which is also set on
                                                            // personal KBs the user created inside an org. Three modes
                                                            // mirror the publish-menu options (Personal / Org / Groups).
                                                            const groups = (() => {
                                                                if (Array.isArray(kb.shared_groups)) return kb.shared_groups;
                                                                if (typeof kb.shared_groups === 'string') {
                                                                    try { return JSON.parse(kb.shared_groups || '[]'); } catch { return []; }
                                                                }
                                                                return [];
                                                            })();
                                                            // Theme-aware visibility tags. Personal → neutral chrome;
                                                            // Org → accent (the org's brand colour); Groups → warning hue.
                                                            const visibility = !kb.is_published
                                                                ? { label: 'Personal', bg: 'var(--bg-tertiary)', fg: 'var(--text-secondary)' }
                                                                : groups.length > 0
                                                                    ? { label: `${groups.length} group${groups.length > 1 ? 's' : ''}`, bg: 'color-mix(in srgb, var(--warning) 12%, transparent)', fg: 'var(--warning)' }
                                                                    : { label: 'Org', bg: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)', fg: 'var(--accent-primary)' };
                                                            return (
                                                                <label
                                                                    key={kb.id}
                                                                    className="flex items-center gap-3 px-2.5 py-2 rounded-lg cursor-pointer transition-colors"
                                                                    style={{
                                                                        background: checked ? 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' : 'transparent',
                                                                    }}
                                                                    onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                                                    onMouseLeave={e => { if (!checked) e.currentTarget.style.background = 'transparent'; }}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        onChange={() => toggleKBId(kb.id)}
                                                                        className="accent-[var(--accent-primary)] w-4 h-4 flex-shrink-0"
                                                                    />
                                                                    <span
                                                                        className="flex-shrink-0 w-7 h-7 rounded-md inline-flex items-center justify-center text-[15px]"
                                                                        style={{ background: 'var(--bg-secondary)' }}
                                                                    >{kb.icon && (kb.icon.startsWith('data:') || kb.icon.startsWith('http')) ? (
                                                                        <img src={kb.icon} alt="" className="w-5 h-5 rounded object-cover" />
                                                                    ) : (kb.icon || '📚')}</span>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{kb.name}</p>
                                                                            <span
                                                                                className="px-1.5 py-0.5 rounded font-medium text-[9px] flex-shrink-0 uppercase tracking-wide"
                                                                                style={{ background: visibility.bg, color: visibility.fg }}
                                                                            >{visibility.label}</span>
                                                                        </div>
                                                                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                                                            {isEmpty
                                                                                ? 'Empty'
                                                                                : `${(kb.document_count || 0)} doc${kb.document_count === 1 ? '' : 's'} · ${(kb.total_chunks || 0)} chunks`}
                                                                        </p>
                                                                    </div>
                                                                </label>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                                <div className="px-3 py-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                                                    <button
                                                        onClick={() => onChangeKBIds([])}
                                                        disabled={selectedKBIds.length === 0}
                                                        className="px-2 py-1 rounded-md text-[11px] hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
                                                        style={{ color: 'var(--text-muted)' }}
                                                    >Clear</button>
                                                    <button
                                                        onClick={() => setShowKBPicker(false)}
                                                        className="px-3 py-1.5 rounded-md text-[11px] font-semibold"
                                                        style={{ background: 'var(--accent-primary)', color: 'var(--accent-primary-fg, #fff)' }}
                                                    >Done</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {/* Voice Chat (Beta) — toggles voiceMode. When active, the
                                    composer is replaced by <VoiceInlinePanel>. Voice turns
                                    flow into the chat as regular messages via onVoiceTurnComplete. */}
                                {!_simpleMode && (
                                    <VoiceCallButton
                                        user={user}
                                        voiceMode={voiceMode}
                                        onToggleVoiceMode={setVoiceMode}
                                    />
                                )}
                                {/* Skills Popover — gated by the `skills` beta feature.
                                    Matches the pattern used on the sidebar entry. */}
                                {!_simpleMode && onToggleSkill && Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('skills') && (
                                    <SkillsPopover
                                        user={user}
                                        activeSkillIds={activeSkillIds}
                                        attachedSkillIds={agentAttachedSkillIds}
                                        directMode={!!directMode}
                                        directConversationId={directConversationId}
                                        directSessionSkills={directSessionSkills}
                                        directActivatedSessionSkillIds={directActivatedSessionSkillIds}
                                        onToggleSkill={onToggleSkill}
                                    />
                                )}
                                {/* Apps Button — hidden if no apps available or agent disableExternalTools */}
                                {!_simpleMode && !selectedAgent?.config?.disableExternalTools && (() => {
                                    const n8nAppDefs = n8nWorkflows.map(wf => ({
                                        id: `n8n_run_${wf.slug}`,
                                        label: wf.name,
                                        description: wf.description || 'n8n workflow',
                                        iconSvg: (s = 'w-5 h-5') => <img src="/n8n-color.png" alt="n8n" className={`${s} object-contain`} />,
                                        isN8n: true,
                                    }));
                                    const mcpAppDefs = mcpServers.map(srv => ({
                                        id: `mcp_${srv.id}`,
                                        label: srv.name,
                                        description: `${srv.toolCount} tools available${srv.allConfigured ? '' : ' — credentials needed'}`,
                                        iconSvg: (s = 'w-5 h-5') => <span className={`${s} flex items-center justify-center text-base`}>{srv.icon || '🔌'}</span>,
                                        isMcp: true,
                                        mcpConfigured: srv.allConfigured,
                                        requiresNone: false,
                                    }));
                                    const allAppDefs = [...APP_DEFS, ...n8nAppDefs, ...mcpAppDefs];
                                    const availableApps = allAppDefs.filter(app => {
                                        // Base availability checks
                                        if (app.requiresGoogle && !isGoogleUser) return false;
                                        if (app.requiresMicrosoft && !isMicrosoftUser) return false;
                                        if (app.requiresFireflies && !hasFirefliesKey) return false;
                                        if (app.requiresYouTrack && !hasYouTrackConfig) return false;
                                        if (app.requiresGamma && !hasGammaKey) return false;
                                        // Org-level gating — gate ALL apps (matching backend ORG_EXEMPT_APPS logic)
                                        if (orgEnabledIntegrations) {
                                            if (app.isMcp) {
                                                // MCP servers use mcp:{serverId} format in enabledIntegrations
                                                const mcpId = `mcp:${app.id.replace(/^mcp_/, '')}`;
                                                if (!orgEnabledIntegrations.includes(mcpId)) return false;
                                            } else if (app.isN8n) {
                                                if (!orgEnabledIntegrations.includes('n8n')) return false;
                                            } else if (!app.requiresNone) {
                                                // All standard apps (Google, Microsoft, AI, third-party)
                                                if (!orgEnabledIntegrations.includes(app.id)) return false;
                                            }
                                        }
                                        if (app.requiresNone) return false;
                                        // Agent-level integration filtering (MCP apps bypass — they're globally available)
                                        if (agentIntegrations && !app.isMcp) {
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
                                                        case 'google-contacts': setInput('Search my contacts for '); break;
                                                        case 'google-keep': setInput('List my Google Keep notes'); break;
                                                        case 'fireflies': setInput('List my recent meeting transcripts'); break;
                                                        case 'youtrack': setInput('Search my YouTrack issues'); break;
                                                        case 'gamma': setInput('Create a presentation about '); break;
                                                        case 'outlook': setInput('Show my recent Outlook emails'); break;
                                                        case 'outlook-readonly': setInput('Show my recent Outlook emails'); break;
                                                        case 'ms-calendar': setInput("What's on my calendar this week?"); break;
                                                        case 'onedrive': setInput('List my OneDrive files'); break;
                                                        case 'ms-contacts': setInput('Search my contacts for '); break;
                                                        default:
                                                            if (app.isN8n) {
                                                                setInput(`Run the ${app.label} workflow `);
                                                            } else if (app.isMcp) {
                                                                setInput(`Use ${app.label} to `);
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
                                {!_simpleMode && directMode && modelTiers && (
                                    <div className="mr-1">
                                        <ModelTierSelector
                                            tiers={modelTiers}
                                            value={selectedTier}
                                            onChange={onTierChange}
                                            variant="input"
                                        />
                                    </div>
                                )}

                                {/* Thinking-effort selector — shown when the currently-selected
                                    tier resolves to a reasoning-capable model. Mirrors the
                                    `supportsReasoning` regexes used by the backend provider
                                    adapters so server and client agree on availability. */}
                                {!_simpleMode && directMode && modelTiers && (() => {
                                    const modelId = modelTiers?.[selectedTier]?.model || '';
                                    const supportsReasoning = /claude-opus-4|claude-sonnet-4|^o\d|gpt-5|gemini-2\.5|gemini-3|magistral/i.test(modelId);
                                    if (!supportsReasoning) return null;
                                    return (
                                        <div className="mr-1">
                                            <EffortSelector modelId={modelId} />
                                        </div>
                                    );
                                })()}

                                {/* Send / Stop Buttons */}
                                {isLoading ? (
                                    <button
                                        onClick={onStopGenerating}
                                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm active:scale-95 transform duration-100"
                                        title="Stop generating"
                                        aria-label="Stop generating"
                                        data-testid="stop-generating-button"
                                    >
                                        <StopCircle className="w-5 h-5" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() && attachments.length === 0}
                                        className="p-2 bg-[var(--text-primary)] text-white rounded-full hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95 transform duration-100"
                                        title="Send message (Enter)"
                                        aria-label="Send message"
                                        data-testid="send-message-button"
                                    >
                                        <ArrowUp className="w-6 h-6" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    )}


                    <div className="text-center mt-1.5 mb-0.5 select-none">
                        <p className="text-[10px] text-[var(--text-tertiary)]">
                            {warningText || 'AI can make mistakes. Please verify important information.'}
                            {!isTouchDevice && (
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

