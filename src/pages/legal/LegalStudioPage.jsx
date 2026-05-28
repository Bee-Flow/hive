import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    ArrowLeft, Plus, Trash2, Scale, Loader2, AlertCircle, CheckCircle2,
    Search, X, ChevronRight, ChevronDown, Pencil, Download, FileDown, FileType2,
    PanelLeft, History, ListChecks, FolderOpen, Clock, PenTool
} from 'lucide-react';
import { API_BASE, authFetch } from '../../utils/helpers';
import useChatEngine from '../../hooks/useChatEngine';
import NotebookEditor from '../notebooks/NotebookEditor';
import NotebookChat from '../notebooks/NotebookChat';
import NotebookSources from '../notebooks/NotebookSources';
import NotebookVersions from '../notebooks/NotebookVersions';
import CitationOverlay from '../notebooks/CitationOverlay';
import SendForSigningModal from '../notebooks/SendForSigningModal';
import { preprocessMermaidContent } from '../notebooks/MermaidExtension';
import { embedImagesAsBase64 } from '../../utils/imageEmbedding';
import LegalResearchPanel from './LegalResearchPanel';
import TableOfAuthorities from './TableOfAuthorities';
import LegalStudio from './LegalStudio';

/* ── Helpers ──────────────────────────────────────────────────── */
function timeAgo(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return 'zojuist';
    if (diff < 3600) return `${Math.floor(diff / 60)} min geleden`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} u geleden`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} d geleden`;
    return d.toLocaleDateString('nl-NL');
}

const RECHTSGEBIED_LABELS = {
    civiel: 'Civiel', 'personen-en-familierecht': 'Familie', 'civiel-personen-familie': 'Familie',
    arbeidsrecht: 'Arbeid', ondernemingsrecht: 'Onderneming', insolventierecht: 'Insolventie',
    verbintenissenrecht: 'Verbintenissen', huurrecht: 'Huur', goederenrecht: 'Goederen',
    'intellectuele-eigendom': 'IE', aanbestedingsrecht: 'Aanbesteding', 'internationaal-privaatrecht': 'IPR',
    bestuursrecht: 'Bestuur', belastingrecht: 'Belasting', socialezekerheidsrecht: 'Sociale zekerheid',
    vreemdelingenrecht: 'Vreemdelingen', omgevingsrecht: 'Omgeving', ambtenarenrecht: 'Ambtenaren',
    strafrecht: 'Straf', europees: 'Europees',
};

// Ordered, de-duplicated choices for the new-matter form (excludes the legacy
// 'civiel-personen-familie' alias, which RECHTSGEBIED_LABELS keeps only for
// displaying older matters).
const RECHTSGEBIED_CHOICES = [
    ['personen-en-familierecht', 'Personen- & familierecht'], ['arbeidsrecht', 'Arbeidsrecht'],
    ['ondernemingsrecht', 'Ondernemingsrecht'], ['insolventierecht', 'Insolventierecht'],
    ['verbintenissenrecht', 'Verbintenissenrecht'], ['huurrecht', 'Huurrecht'], ['goederenrecht', 'Goederenrecht'],
    ['intellectuele-eigendom', 'Intellectuele eigendom'], ['aanbestedingsrecht', 'Aanbestedingsrecht'],
    ['internationaal-privaatrecht', 'Internationaal privaatrecht'], ['civiel', 'Civiel (overig)'],
    ['bestuursrecht', 'Bestuursrecht'], ['belastingrecht', 'Belastingrecht'],
    ['socialezekerheidsrecht', 'Sociale zekerheid'], ['vreemdelingenrecht', 'Vreemdelingenrecht'],
    ['omgevingsrecht', 'Omgevingsrecht'], ['ambtenarenrecht', 'Ambtenarenrecht'],
    ['strafrecht', 'Strafrecht'], ['europees', 'Europees recht'],
];

// Deadline chip: red ≤3d/overdue, amber ≤14d, emerald otherwise.
function deadlineInfo(dateStr) {
    if (!dateStr) return null;
    const days = Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
    let color = '#22c55e';
    if (days <= 3) color = '#ef4444';
    else if (days <= 14) color = '#f59e0b';
    const label = days < 0 ? `${Math.abs(days)} d te laat` : days === 0 ? 'vandaag' : `over ${days} d`;
    return { days, color, label, date: new Date(dateStr).toLocaleDateString('nl-NL') };
}

// Soonest upcoming (or overdue) deadline from a matter's deadline list.
function soonestDeadline(deadlines) {
    if (!Array.isArray(deadlines) || deadlines.length === 0) return null;
    const dated = deadlines
        .filter(d => d && d.date)
        .map(d => ({ label: d.label || 'Deadline', info: deadlineInfo(d.date) }))
        .filter(d => d.info);
    if (dated.length === 0) return null;
    dated.sort((a, b) => a.info.days - b.info.days);
    return dated[0];
}

async function matterApi(path, opts = {}) {
    const url = `${API_BASE}/api/legal-matters${path === '/' ? '' : path}`;
    const res = await authFetch(url, { headers: { 'Content-Type': 'application/json', ...opts.headers }, ...opts });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `API ${res.status}`);
    }
    return res.json();
}
// Sources/chat/export reuse the notebook routes (a matter IS a notebook).
async function nbApi(id, path, opts = {}) {
    const res = await authFetch(`${API_BASE}/api/notebooks/${id}${path}`, { headers: { 'Content-Type': 'application/json', ...opts.headers }, ...opts });
    if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `API ${res.status}`); }
    return res.json();
}

/* ── Compact export menu (reuses notebook export endpoints) ──────── */
function ExportMenu({ onExport, exporting, disabled }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    return (
        <div className="relative" ref={ref}>
            <button disabled={disabled || !!exporting} onClick={() => setOpen(o => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition-colors text-sm font-medium" style={{ color: 'var(--text-secondary)' }} title="Exporteren">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent-primary)' }} /> : <Download className="w-4 h-4" />}
                Export <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && !disabled && (
                <div className="absolute top-full right-0 mt-1 w-48 rounded-xl shadow-xl border overflow-hidden z-50 p-1" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }}>
                    <button onClick={() => { setOpen(false); onExport('pdf'); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] flex items-center gap-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                        <FileDown className="w-4 h-4" style={{ color: '#ef4444' }} /> Download als PDF
                    </button>
                    <button onClick={() => { setOpen(false); onExport('docx'); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] flex items-center gap-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                        <FileType2 className="w-4 h-4" style={{ color: '#3b82f6' }} /> Download als Word
                    </button>
                </div>
            )}
        </div>
    );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function LegalStudioPage({ user, onBack, initialMatterId, onMatterChange }) {
    const canUse = !!(user?.permissions?.includes('all') || user?.permissions?.includes('use_notebooks'));

    const [matters, setMatters] = useState([]);
    const [selected, setSelected] = useState(null);
    const [sources, setSources] = useState([]);
    const [citations, setCitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');
    const [sidebarFocusId, setSidebarFocusId] = useState(null);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [dragOver, setDragOver] = useState(false);

    // New-matter form
    const [form, setForm] = useState({ name: '', clientName: '', wederpartij: '', rechtsgebied: '', zaaknummer: '', deadline: '' });

    // Layout
    const [leftTab, setLeftTab] = useState('sources'); // sources | research | authorities
    const [leftOpen, setLeftOpen] = useState(true);
    const [rightWidth, setRightWidth] = useState(340);
    const rightDragRef = useRef(false);
    const [versionsOpen, setVersionsOpen] = useState(false);

    // Editor + chat
    const [documentContent, setDocumentContent] = useState('');
    const [saveState, setSaveState] = useState('idle');
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [exporting, setExporting] = useState(null);
    const [verifying, setVerifying] = useState(false);
    const [verifyToast, setVerifyToast] = useState(null); // { tone, message }
    const [generating, setGenerating] = useState(null); // generator type or null
    const generationAbortRef = useRef(null);
    useEffect(() => () => { generationAbortRef.current?.abort?.(); }, []);
    // SignRequest + Nextcloud export (reuse notebook export endpoints)
    const [signModalOpen, setSignModalOpen] = useState(false);
    const [signSending, setSignSending] = useState(false);
    const [signRequestConfigured, setSignRequestConfigured] = useState(false);
    const [nextcloudConfigured, setNextcloudConfigured] = useState(false);
    const [nextcloudExporting, setNextcloudExporting] = useState(false);
    const [selectedTier, setSelectedTier] = useState('auto');
    const [modelTiers, setModelTiers] = useState({});
    const [citationSource, setCitationSource] = useState(null);
    const pendingContentRef = useRef(null);
    const retryTimerRef = useRef(null);
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);
    const pendingSelectionRef = useRef(null);

    /* ── Chat engine (reused, pointed at the notebook stream) ── */
    const { messages: chatMessages, setMessages: setChatMessages, isLoading: chatLoading,
        sendMessage: sendChatMessage, stopGenerating: stopChatGenerating,
        retryMessage: retryChatMessage, editAndRegenerate: editAndRegenerateChat,
    } = useChatEngine({
        selectedAgent: null,
        currentConversation: null,
        onConversationCreated: useCallback(() => {}, []),
        getNotebookPayload: useCallback(() => ({}), []),
        onNotebookUpdate: useCallback(() => {}, []),
        directMode: useMemo(() => ({
            enabled: true,
            modelTier: selectedTier,
            customEndpoint: selected ? '/ai/chat/notebook/stream' : undefined,
            getExtraPayload: () => {
                if (!selected) return {};
                const payload = { notebookId: selected.id, documentContent };
                if (pendingSelectionRef.current) { payload.notebookSelection = pendingSelectionRef.current; pendingSelectionRef.current = null; }
                return payload;
            },
        }), [selectedTier, selected?.id, documentContent]),
        onDirectConversationCreated: useCallback(() => {}, []),
        onNotebookDocUpdate: useCallback((content) => {
            setDocumentContent(content);
            editorRef.current?.setContent?.(content);
        }, []),
        onNotebookSourceAdded: useCallback((source) => setSources(prev => [...prev, source]), []),
    });

    /* ── Load model tiers + export integrations config ── */
    useEffect(() => {
        authFetch(`${API_BASE}/ai/config/chat-models`).then(r => r.ok ? r.json() : {}).then(setModelTiers).catch(() => {});
        authFetch(`${API_BASE}/ai/user-settings`).then(r => r.ok ? r.json() : {}).then(d => setSignRequestConfigured(!!d.hasSignRequestConfig)).catch(() => {});
        authFetch(`${API_BASE}/auth/app-password-status`).then(r => r.ok ? r.json() : {}).then(d => setNextcloudConfigured(!!d.hasAppPassword)).catch(() => {});
    }, []);

    /* ── Right-panel resize ── */
    useEffect(() => {
        const move = (e) => { if (!rightDragRef.current) return; const w = document.body.clientWidth - e.clientX; setRightWidth(Math.max(280, Math.min(w, 720))); };
        const up = () => { if (rightDragRef.current) { rightDragRef.current = false; document.body.style.cursor = 'default'; document.body.style.userSelect = 'auto'; } };
        document.addEventListener('mousemove', move); document.addEventListener('mouseup', up);
        return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
    }, []);

    /* ── Fetch matters ── */
    const didAutoSelect = useRef(false);
    const fetchMatters = useCallback(async () => {
        try {
            setLoading(true);
            const data = await matterApi('/');
            const list = data.matters || [];
            setMatters(list);
            if (initialMatterId && !didAutoSelect.current) {
                didAutoSelect.current = true;
                const match = list.find(m => String(m.id) === String(initialMatterId));
                if (match) selectMatter(match);
            }
        } catch (e) { setError(e.message); } finally { setLoading(false); }
    }, [initialMatterId]);
    useEffect(() => { fetchMatters(); }, [fetchMatters]);

    /* ── Select matter ── */
    const selectMatter = useCallback(async (m) => {
        try {
            const data = await matterApi(`/${m.id}`);
            setSelected(data.matter);
            setSources(data.sources || []);
            setCitations(data.citations || []);
            setDocumentContent(preprocessMermaidContent(data.matter?.documentContent || ''));
            setChatMessages([]);
            setLeftTab('sources');
            onMatterChange?.(m.id);
        } catch (e) { setError(e.message); }
    }, [setChatMessages, onMatterChange]);

    /* ── Poll processing sources ── */
    useEffect(() => {
        if (!selected) return;
        if (!sources.some(s => s.status === 'processing')) return;
        const t = setInterval(async () => {
            try { const d = await nbApi(selected.id, '/sources'); setSources(d.sources || []); } catch {}
        }, 3000);
        return () => clearInterval(t);
    }, [selected, sources]);

    /* ── Refetch citations when a chat turn finishes (captures legal_citation_found upserts) ── */
    const prevChatLoading = useRef(false);
    useEffect(() => {
        if (prevChatLoading.current && !chatLoading && selected) {
            matterApi(`/${selected.id}/citations`).then(d => setCitations(d.citations || [])).catch(() => {});
        }
        prevChatLoading.current = chatLoading;
    }, [chatLoading, selected]);

    /* ── Document autosave (idle/saving/error + retry) ── */
    const handleDocSave = useCallback(async (html, { isRetry = false } = {}) => {
        if (!selected) return;
        pendingContentRef.current = html;
        if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
        setSaveState('saving');
        try {
            await nbApi(selected.id, '', { method: 'PUT', body: JSON.stringify({ documentContent: html }) });
            pendingContentRef.current = null;
            setSaveState('idle');
            setLastSavedAt(Date.now());
        } catch (e) {
            setSaveState('error');
            if (!isRetry) retryTimerRef.current = setTimeout(() => { if (pendingContentRef.current !== null) handleDocSave(pendingContentRef.current, { isRetry: true }); }, 5000);
        }
    }, [selected]);

    useEffect(() => {
        if (saveState === 'idle') return;
        const h = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', h);
        return () => window.removeEventListener('beforeunload', h);
    }, [saveState]);

    useEffect(() => {
        const onKey = (e) => {
            const metaS = (e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S');
            if (!metaS || !selected) return;
            e.preventDefault();
            const html = editorRef.current?.getEditor?.()?.getHTML?.() ?? documentContent;
            handleDocSave(html);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selected, documentContent, handleDocSave]);

    /* ── Editor AI bubble action (reused contract) ── */
    const handleEditorAIAction = useCallback((actionKey, selectedText, range, customQuery) => {
        if (!selectedText?.trim()) return;
        pendingSelectionRef.current = { text: selectedText, from: range?.from ?? null, to: range?.to ?? null, action: actionKey };
        const sel = selectedText.length > 300 ? selectedText.slice(0, 300).trimEnd() + '…' : selectedText;
        const prompts = {
            rewrite: 'Herschrijf de geselecteerde tekst. Gebruik notebook_doc_replace om de wijziging direct toe te passen.',
            shorten: 'Maak de geselecteerde tekst korter. Gebruik notebook_doc_replace.',
            expand: 'Breid de geselecteerde tekst uit met meer detail. Gebruik notebook_doc_replace.',
            ask: `**Geselecteerde tekst:**\n> ${sel.split('\n').join('\n> ')}\n\n${customQuery || 'Analyseer deze tekst.'}`,
        };
        sendChatMessage(prompts[actionKey] || prompts.ask);
    }, [sendChatMessage]);

    const handleInsertToDocument = useCallback((content) => {
        const html = content.split('\n').filter(l => l.trim()).map(l => `<p>${l}</p>`).join('');
        setDocumentContent(prev => prev + html);
        editorRef.current?.insertContent?.(html);
    }, []);

    // Import a .docx/.pdf/.txt into the editor (reuses the notebook import route).
    const handleImportFile = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file || !selected) { e.target.value = ''; return; }
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await authFetch(`${API_BASE}/api/notebooks/${selected.id}/import-file`, { method: 'POST', body: fd });
            if (!res.ok) throw new Error('Bestand kon niet worden ingelezen');
            const data = await res.json();
            if (data.text) editorRef.current?.insertContent?.(data.text);
        } catch (err) { setError(err.message); }
        finally { e.target.value = ''; }
    }, [selected]);

    // Chat send: the AI reads attachments this turn (server extracts them), and
    // non-image files are ALSO added to Stukken so they persist + get indexed.
    const handleChatSend = useCallback((text, attachments) => {
        if (!text?.trim() && !(attachments && attachments.length)) return;
        const fileAtts = (attachments || []).filter(a => a && a.content && !(a.type || '').startsWith('image/'));
        if (fileAtts.length && selected) {
            Promise.all(fileAtts.map(a => dataUrlToFile(a).catch(() => null)))
                .then(files => { const valid = files.filter(Boolean); if (valid.length) handleFileUpload(valid); })
                .catch(() => {});
        }
        sendChatMessage(text, attachments);
    }, [selected, sendChatMessage]);

    /* ── Create matter ── */
    const handleCreate = async () => {
        if (!form.name.trim()) return;
        try {
            setCreating(true);
            const data = await matterApi('/', { method: 'POST', body: JSON.stringify(form) });
            setForm({ name: '', clientName: '', wederpartij: '', rechtsgebied: '', zaaknummer: '', deadline: '' });
            await fetchMatters();
            if (data.matter) await selectMatter(data.matter);
        } catch (e) { setError(e.message); } finally { setCreating(false); }
    };

    const confirmDelete = async () => {
        const m = pendingDelete; if (!m?.id) return;
        try {
            await matterApi(`/${m.id}`, { method: 'DELETE' });
            if (selected?.id === m.id) { setSelected(null); setSources([]); setCitations([]); }
            setPendingDelete(null);
            fetchMatters();
        } catch (e) { setError(e.message); setPendingDelete(null); }
    };

    const handleRename = async (id) => {
        if (!renameValue.trim()) return;
        try {
            await matterApi(`/${id}`, { method: 'PATCH', body: JSON.stringify({ name: renameValue.trim() }) });
            if (selected?.id === id) setSelected(p => ({ ...p, name: renameValue.trim() }));
            fetchMatters();
        } catch (e) { setError(e.message); }
        setRenamingId(null);
    };

    /* ── Sources ── */
    const refreshSources = useCallback(async () => { if (selected) { const d = await nbApi(selected.id, '/sources'); setSources(d.sources || []); } }, [selected]);
    const handleFileUpload = async (files) => {
        if (!files?.length || !selected) return;
        for (const file of files) {
            try { const form = new FormData(); form.append('file', file); await authFetch(`${API_BASE}/api/notebooks/${selected.id}/sources/file`, { method: 'POST', body: form }); }
            catch (e) { setError(`Upload mislukt: ${file.name}`); }
        }
        refreshSources();
    };
    const handleAddUrl = async (url) => { if (url?.trim() && selected) { try { await nbApi(selected.id, '/sources/url', { method: 'POST', body: JSON.stringify({ url: url.trim() }) }); refreshSources(); } catch (e) { setError(e.message); } } };
    const handleAddText = async (text, name) => { if (text?.trim() && selected) { try { await nbApi(selected.id, '/sources/text', { method: 'POST', body: JSON.stringify({ text: text.trim(), name: name?.trim() || undefined }) }); refreshSources(); } catch (e) { setError(e.message); } } };
    const handleAddMeeting = async (meetingId, opts = {}) => { if (meetingId && selected) { try { await nbApi(selected.id, '/sources/meeting', { method: 'POST', body: JSON.stringify({ meetingId, mode: opts.mode === 'summary' ? 'summary' : 'full' }) }); refreshSources(); } catch (e) { setError(e.message); } } };
    const handleDeleteSource = async (sid) => { if (!selected) return; try { await nbApi(selected.id, `/sources/${sid}`, { method: 'DELETE' }); setSources(p => p.filter(s => s.id !== sid)); } catch (e) { setError(e.message); } };
    const handleRetrySource = async (sid) => { if (!selected) return; try { await nbApi(selected.id, `/sources/${sid}/retry`, { method: 'POST' }); setSources(p => p.map(s => s.id === sid ? { ...s, status: 'processing', error: null } : s)); } catch (e) { setError(e.message); } };
    const handleCancelSource = async (sid) => { if (!selected) return; try { await nbApi(selected.id, `/sources/${sid}/cancel`, { method: 'POST' }); setSources(p => p.map(s => s.id === sid ? { ...s, status: 'error', error: 'Geannuleerd' } : s)); } catch (e) { setError(e.message); } };

    /* ── Citations / bronnenlijst ── */
    const refreshCitations = useCallback(async () => { if (selected) { try { const d = await matterApi(`/${selected.id}/citations`); setCitations(d.citations || []); } catch {} } }, [selected]);
    const addAuthority = useCallback(async (cite) => {
        if (!selected) return;
        try { await matterApi(`/${selected.id}/citations`, { method: 'POST', body: JSON.stringify(cite) }); refreshCitations(); }
        catch (e) { setError(e.message); }
    }, [selected, refreshCitations]);
    const removeAuthority = useCallback(async (cid) => {
        if (!selected) return;
        try { await matterApi(`/${selected.id}/citations/${cid}`, { method: 'DELETE' }); setCitations(p => p.filter(c => c.id !== cid)); }
        catch (e) { setError(e.message); }
    }, [selected]);
    const citeInDocument = useCallback((cite) => {
        const label = cite.title && cite.identifier && cite.title !== cite.identifier ? `${cite.title}, ${cite.identifier}` : (cite.identifier || cite.title || '');
        if (label) editorRef.current?.insertContent?.(`<p>${label}</p>`);
        addAuthority(cite);
    }, [addAuthority]);
    const openFullText = useCallback((row) => { if (row.url) window.open(row.url, '_blank', 'noopener,noreferrer'); }, []);
    const handleVerifyCitations = useCallback(async () => {
        if (!selected || verifying) return;
        // Use the live editor HTML so unsaved edits are included.
        const text = editorRef.current?.getEditor?.()?.getHTML?.() ?? documentContent;
        setVerifying(true);
        setVerifyToast(null);
        try {
            const data = await matterApi(`/${selected.id}/citations/verify`, { method: 'POST', body: JSON.stringify({ text }) });
            setCitations(data.citations || []);
            const r = data.report || { total: 0, verified: [], notFound: [], unverified: [] };
            if (r.total === 0) {
                setVerifyToast({ tone: 'info', message: 'Geen verwijzingen (ECLI/CELEX/BWB) gevonden in het document.' });
            } else {
                const parts = [`${r.verified.length}/${r.total} geverifieerd`];
                if (r.notFound.length) parts.push(`${r.notFound.length} niet gevonden`);
                if (r.unverified.length) parts.push(`${r.unverified.length} niet te verifiëren`);
                setVerifyToast({ tone: r.notFound.length ? 'warn' : 'success', message: parts.join(' · ') });
            }
            setTimeout(() => setVerifyToast(null), 7000);
        } catch (e) { setError(e.message); }
        finally { setVerifying(false); }
    }, [selected, verifying, documentContent]);
    const insertAuthoritiesList = useCallback(() => {
        if (!citations.length) return;
        const byKind = {};
        citations.forEach(c => { (byKind[c.kind] = byKind[c.kind] || []).push(c); });
        const KIND_LABELS = { jurisprudentie: 'Jurisprudentie', wet: 'Wetgeving', eu: 'EU-recht', tuchtrecht: 'Tuchtrecht', kamerstuk: 'Parlementaire stukken', bekendmaking: 'Officiële publicaties', literatuur: 'Literatuur' };
        let html = '<h2>Bronnenlijst</h2>';
        for (const kind of Object.keys(byKind)) {
            html += `<h3>${KIND_LABELS[kind] || kind}</h3><ul>`;
            for (const c of byKind[kind]) html += `<li><p>${c.title && c.title !== c.identifier ? c.title + ', ' : ''}${c.identifier || ''}${c.pinpoint ? ' (' + c.pinpoint + ')' : ''}</p></li>`;
            html += '</ul>';
        }
        editorRef.current?.insertContent?.(html);
    }, [citations]);

    /* ── Generate a legal document (SSE → editor) ── */
    const handleGenerate = useCallback(async (type) => {
        if (!selected || generating) return;
        setGenerating(type);
        setVerifyToast(null);
        generationAbortRef.current?.abort?.();
        const controller = new AbortController();
        generationAbortRef.current = controller;
        try {
            const res = await authFetch(`${API_BASE}/api/notebooks/${selected.id}/generate/${type}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ modelTier: selectedTier, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                signal: controller.signal,
            });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Genereren mislukt (${res.status})`); }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '', content = '', currentEvent = '', report = null, redacted = null;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (line.startsWith('event: ')) currentEvent = line.slice(7).trim();
                    else if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (currentEvent === 'content' && data.text) content += data.text;
                            else if (currentEvent === 'citation_report') { report = data; redacted = data.redactedContent || null; }
                            else if (currentEvent === 'error') throw new Error(data.error || 'Genereerfout');
                        } catch (e) { if (e.message?.includes('Genereer')) throw e; }
                    }
                }
            }
            const finalContent = redacted || content;
            if (finalContent && editorRef.current) {
                const processed = preprocessMermaidContent(finalContent);
                editorRef.current.setContent(processed);
                const html = editorRef.current.getEditor?.()?.getHTML?.();
                if (html) { setDocumentContent(html); handleDocSave(html); }
            }
            refreshCitations();
            // Summarise the run + citation verification in a toast.
            if (report) {
                const parts = [`${report.verified.length}/${report.total} bronnen geverifieerd`];
                if (report.notFound.length) parts.push(`${report.notFound.length} niet gevonden`);
                if (report.unverified.length) parts.push(`${report.unverified.length} niet te verifiëren`);
                if (redacted) parts.push('onbevestigde verwijzingen weggelaten (strikt)');
                setVerifyToast({ tone: report.notFound.length ? 'warn' : 'success', message: `Document gegenereerd · ${parts.join(' · ')}` });
            } else {
                setVerifyToast({ tone: 'success', message: 'Document gegenereerd en in de editor geplaatst.' });
            }
            setTimeout(() => setVerifyToast(null), 8000);
        } catch (e) {
            if (e.name !== 'AbortError') setError(e.message);
        } finally {
            setGenerating(null);
            if (generationAbortRef.current === controller) generationAbortRef.current = null;
        }
    }, [selected, generating, selectedTier, handleDocSave, refreshCitations]);

    const handleToggleStrict = useCallback(async () => {
        if (!selected) return;
        const next = selected.settings?.legal?.citationMode === 'strict_formal' ? 'flag' : 'strict_formal';
        // Optimistic local update so the toggle reflects immediately.
        setSelected(prev => ({ ...prev, settings: { ...(prev.settings || {}), legal: { ...(prev.settings?.legal || {}), citationMode: next } } }));
        try { await matterApi(`/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ citationMode: next }) }); }
        catch (e) { setError(e.message); }
    }, [selected]);

    /* ── Export ── */
    const handleExport = useCallback(async (format) => {
        if (!selected || !documentContent) return;
        setExporting(format);
        try {
            const content = await embedImagesAsBase64(documentContent);
            const res = await authFetch(`${API_BASE}/api/notebooks/${selected.id}/export/${format}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, title: selected.name }) });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Export mislukt (${res.status})`); }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${selected.name.replace(/[^a-zA-Z0-9.\-_ ]/g, '_')}.${format === 'pdf' ? 'pdf' : 'docx'}`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        } catch (e) { setError(e.message); } finally { setExporting(null); }
    }, [selected, documentContent]);

    /* ── Send for signing (SignRequest) — e.g. a vaststellingsovereenkomst ── */
    const handleSendForSigning = useCallback(async ({ signers, subject, message }) => {
        if (!selected || !documentContent) return null;
        setSignSending(true);
        try {
            const content = await embedImagesAsBase64(documentContent);
            const res = await authFetch(`${API_BASE}/api/notebooks/${selected.id}/export/signrequest`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, title: selected.name, signers, subject, message }),
            });
            if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `SignRequest mislukt (${res.status})`); }
            return await res.json();
        } catch (e) { setError(e.message); return null; }
        finally { setSignSending(false); }
    }, [selected, documentContent]);

    /* ── Export the document to the firm's Nextcloud (dossier) ── */
    const handleNextcloudExport = useCallback(async () => {
        if (!selected || !documentContent) return;
        setNextcloudExporting(true);
        try {
            const content = await embedImagesAsBase64(documentContent);
            const res = await authFetch(`${API_BASE}/api/notebooks/${selected.id}/export/nextcloud`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, title: selected.name }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Upload mislukt (${res.status})`);
            setVerifyToast({ tone: 'success', message: `Opgeslagen in Nextcloud: ${data.path || 'dossier'}` });
            setTimeout(() => setVerifyToast(null), 6000);
        } catch (e) { setError(e.message); }
        finally { setNextcloudExporting(false); }
    }, [selected, documentContent]);

    /* ── Derived ── */
    const filtered = useMemo(() => matters.filter(m => m.name.toLowerCase().includes(search.toLowerCase())), [matters, search]);
    const readySources = sources.filter(s => s.status === 'ready');
    const totalWords = sources.reduce((s, src) => s + (src.wordCount || 0), 0);
    const showMeetingNotes = user?.featureFlags?.meeting_notes !== false && (user?.isAdmin || user?.permissions?.includes('all') || (Array.isArray(user?.betaFeatures) && user.betaFeatures.includes('meeting_notes')));

    /* ── Permission gate ── */
    if (!canUse) {
        return (
            <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-center p-8 rounded-2xl border max-w-md" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-default)' }}>
                    <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                        <AlertCircle className="w-7 h-7" style={{ color: '#ef4444' }} />
                    </div>
                    <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Juridisch is uitgeschakeld</h2>
                    <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Je rol bevat geen toegang. Vraag een beheerder om de rechten "Notebooks gebruiken".</p>
                    {onBack && <button onClick={onBack} className="px-4 py-2 rounded-lg font-medium text-white" style={{ background: 'var(--accent-primary)' }}>Terug</button>}
                </div>
            </div>
        );
    }

    /* ━━━ DETAIL VIEW ━━━ */
    if (selected) {
        const nearest = soonestDeadline(selected.settings?.legal?.deadlines);
        const dl = nearest?.info || null;
        return (
            <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
                {/* Header */}
                <div className="shrink-0 flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                    <button onClick={() => { setSelected(null); setSources([]); setCitations([]); setChatMessages([]); setDocumentContent(''); }} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] shrink-0" title="Terug naar dossiers">
                        <ArrowLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <div className="w-10 h-10 rounded-xl border-[1.5px] flex items-center justify-center shrink-0" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}>
                        <Scale className="w-5 h-5" style={{ color: 'var(--brand-primary)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }} title={selected.name}>{selected.name}</h2>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {selected.settings?.legal?.clientName ? `${selected.settings.legal.clientName}` : 'Dossier'}
                            {selected.settings?.legal?.wederpartij ? ` / ${selected.settings.legal.wederpartij}` : ''}
                            {' · '}{sources.length} stuk{sources.length !== 1 ? 'ken' : ''} · {totalWords.toLocaleString('nl-NL')} woorden
                        </p>
                    </div>
                    {dl && (
                        <span className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium" style={{ background: `${dl.color}1a`, color: dl.color }} title={`Deadline ${dl.date}`}>
                            <Clock className="w-3 h-3" /> {dl.label}
                        </span>
                    )}
                    <div className="shrink-0 flex items-center min-w-[64px] justify-end">
                        {saveState === 'saving' && <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}><Loader2 className="w-3 h-3 animate-spin" />Opslaan…</span>}
                        {saveState === 'error' && <button onClick={() => pendingContentRef.current && handleDocSave(pendingContentRef.current)} className="flex items-center gap-1 text-xs text-red-500 hover:underline"><AlertCircle className="w-3 h-3" />Opnieuw</button>}
                        {saveState === 'idle' && lastSavedAt && (Date.now() - lastSavedAt < 4000) && <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}><CheckCircle2 className="w-3 h-3" />Opgeslagen</span>}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 pl-2 ml-1 border-l" style={{ borderColor: 'var(--border-subtle)' }}>
                        <button onClick={() => setLeftOpen(o => !o)} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]" title="Linkerpaneel" style={{ background: leftOpen ? 'var(--bg-tertiary)' : 'transparent' }}>
                            <PanelLeft className="w-4 h-4" style={{ color: leftOpen ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                        </button>
                        <button onClick={() => setVersionsOpen(o => !o)} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]" title="Versiegeschiedenis" style={{ background: versionsOpen ? 'var(--bg-tertiary)' : 'transparent' }}>
                            <History className="w-4 h-4" style={{ color: versionsOpen ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                        </button>
                        <div className="pl-1 ml-1 border-l flex items-center gap-0.5" style={{ borderColor: 'var(--border-subtle)' }}>
                            <ExportMenu onExport={handleExport} exporting={exporting} disabled={!documentContent} />
                            {signRequestConfigured && (
                                <button disabled={!documentContent || !!exporting} onClick={() => setSignModalOpen(true)}
                                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition-colors" style={{ color: 'var(--text-secondary)' }} title="Versturen ter ondertekening (SignRequest)">
                                    <PenTool className="w-4 h-4 text-green-500" />
                                </button>
                            )}
                            {nextcloudConfigured && (
                                <button disabled={!documentContent || !!exporting || !!nextcloudExporting} onClick={handleNextcloudExport}
                                    className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition-colors" style={{ color: 'var(--text-secondary)' }} title="Opslaan in Nextcloud (dossier)">
                                    {nextcloudExporting ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#0082C9' }} />
                                        : <svg viewBox="0 0 32 32" fill="none" className="w-4 h-4"><path d="M11.5 11.2c-2 0-3.7 1.4-4.2 3.3a3.5 3.5 0 1 0 0 3 4.4 4.4 0 0 0 7 1.7l1.5-1.4 1.6 1.4a4.4 4.4 0 0 0 7-1.7 3.5 3.5 0 1 0 0-3 4.4 4.4 0 0 0-7-1.7l-1.6 1.4-1.5-1.4a4.4 4.4 0 0 0-2.8-1.6zm0 2.2a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8zm9 0a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8z" fill="#0082C9" /></svg>}
                                </button>
                            )}
                        </div>
                    </div>
                    <LegalStudio
                        onGenerate={handleGenerate}
                        generating={generating}
                        disabled={readySources.length === 0}
                        citationMode={selected.settings?.legal?.citationMode}
                        onToggleStrict={handleToggleStrict}
                    />
                </div>

                {error && (
                    <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border bg-red-50 border-red-200 text-red-700 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /><span className="flex-1">{error}</span>
                        <button onClick={() => setError(null)} className="font-bold text-sm leading-none">&times;</button>
                    </div>
                )}
                {verifyToast && (
                    <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs" style={verifyToastStyle(verifyToast.tone)}>
                        {verifyToast.tone === 'warn' ? <AlertCircle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        <span className="flex-1">{verifyToast.message}</span>
                        <button onClick={() => setVerifyToast(null)} className="font-bold text-sm leading-none">&times;</button>
                    </div>
                )}
                {dl && dl.days <= 3 && (
                    <div className="mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium"
                        style={{ background: `${dl.color}14`, borderColor: `${dl.color}55`, color: dl.color }}>
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        <span className="flex-1">{nearest.label}: {dl.date} — {dl.label}{dl.days < 0 ? ' (verstreken)' : ''}</span>
                    </div>
                )}

                {/* 3-panel */}
                <div className="flex-1 flex overflow-hidden">
                    {leftOpen && (
                        <div className="w-[240px] xl:w-[300px] shrink-0 border-r flex flex-col overflow-hidden" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}>
                            {/* Left tab switcher */}
                            <div className="shrink-0 flex items-center gap-0.5 p-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                {[['sources', 'Stukken', FolderOpen], ['research', 'Bronnen', Scale], ['authorities', 'Lijst', ListChecks]].map(([key, label, Icon]) => (
                                    <button key={key} onClick={() => setLeftTab(key)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                                        style={leftTab === key ? { background: 'var(--bg-tertiary)', color: 'var(--accent-primary)' } : { color: 'var(--text-secondary)' }}>
                                        <Icon className="w-3.5 h-3.5" /> {label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                {leftTab === 'sources' && (
                                    <NotebookSources
                                        sources={sources}
                                        onFileUpload={(files) => handleFileUpload(Array.from(files))}
                                        onAddUrl={(url) => { if (url?.trim()) handleAddUrl(url); }}
                                        onAddText={(text, name) => { if (text?.trim()) handleAddText(text, name); }}
                                        onAddMeeting={handleAddMeeting}
                                        onDeleteSource={handleDeleteSource}
                                        onRetrySource={handleRetrySource}
                                        onCancelSource={handleCancelSource}
                                        dragOver={dragOver}
                                        setDragOver={setDragOver}
                                        totalWords={totalWords}
                                        readyCount={readySources.length}
                                        showMeetingNotes={showMeetingNotes}
                                    />
                                )}
                                {leftTab === 'research' && (
                                    <LegalResearchPanel matterId={selected.id} onCite={citeInDocument} onAddAuthority={addAuthority} onOpenFullText={openFullText} />
                                )}
                                {leftTab === 'authorities' && (
                                    <TableOfAuthorities citations={citations} onRemove={removeAuthority} onInsertList={insertAuthoritiesList} onVerify={handleVerifyCitations} verifying={verifying} />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Center editor */}
                    <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--bg-primary)' }}>
                        <NotebookEditor
                            ref={editorRef}
                            onImportClick={() => fileInputRef.current?.click()}
                            content={documentContent}
                            onChange={setDocumentContent}
                            onSave={handleDocSave}
                            onAIAction={handleEditorAIAction}
                            saving={saveState === 'saving'}
                            notebookId={selected?.id}
                            placeholder="Begin met schrijven, of genereer een stuk via de werkbalk of de AI-chat…"
                        />
                    </div>

                    {/* Right: chat */}
                    <div className="w-[4px] hover:bg-[var(--accent-primary)] cursor-col-resize transition-colors shrink-0 z-10 -ml-[2px]" style={{ borderLeft: '1px solid var(--border-subtle)' }}
                        onMouseDown={(e) => { e.preventDefault(); rightDragRef.current = true; document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'; }} />
                    <div className="shrink-0 flex flex-col overflow-hidden" style={{ width: rightWidth, background: 'var(--bg-primary)' }}>
                        <NotebookChat
                            messages={chatMessages}
                            isLoading={chatLoading}
                            onSend={handleChatSend}
                            onStop={stopChatGenerating}
                            onRetry={retryChatMessage}
                            onEdit={editAndRegenerateChat}
                            modelTiers={modelTiers}
                            selectedTier={selectedTier}
                            onTierChange={setSelectedTier}
                            onInsertToDocument={handleInsertToDocument}
                            onCitationClick={(s) => setCitationSource(s)}
                        />
                    </div>
                </div>

                <CitationOverlay source={citationSource} onClose={() => setCitationSource(null)} />
                <SendForSigningModal open={signModalOpen} onClose={() => setSignModalOpen(false)} onSend={handleSendForSigning} sending={signSending} notebookTitle={selected?.name} />
                {versionsOpen && selected && (
                    <NotebookVersions notebookId={selected.id} currentContent={documentContent}
                        onRestore={(content) => { editorRef.current?.setContent?.(content); setDocumentContent(content); handleDocSave(content); }}
                        onClose={() => setVersionsOpen(false)} />
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.doc,.docx,.txt,.md" onChange={handleImportFile} />
            </div>
        );
    }

    /* ━━━ LIST VIEW ━━━ */
    const focused = filtered.find(m => m.id === sidebarFocusId) || null;
    return (
        <div className="h-full flex flex-col" style={{ background: 'var(--bg-primary)' }}>
            <div className="shrink-0 px-6 py-3 border-b flex items-center gap-4" style={{ borderColor: 'var(--border-default)' }}>
                <button onClick={onBack} className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]"><ArrowLeft className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <Scale className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
                        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Juridisch</h1>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Dossiers, juridisch onderzoek en het opstellen van stukken met geverifieerde bronnen</p>
                </div>
            </div>

            {error && (
                <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-red-50 border-red-200 text-red-700 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" /><span className="flex-1">{error}</span>
                    <button onClick={() => setError(null)} className="font-bold text-lg leading-none">&times;</button>
                </div>
            )}

            <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Sidebar */}
                <aside className="w-72 flex-shrink-0 border-r flex flex-col" style={{ borderColor: 'var(--border-default)' }}>
                    <div className="px-3 py-2.5 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-default)' }}>
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoeken…" className="w-full pl-8 pr-2 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-1"
                                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-primary)' }} />
                        </div>
                        <button onClick={() => setSidebarFocusId('__new__')} title="Nieuw dossier" className="p-1.5 rounded-lg hover:bg-[var(--bg-secondary)]" style={{ color: 'var(--accent-primary)' }}><Plus size={16} /></button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5">
                        {loading && <div className="text-xs p-3" style={{ color: 'var(--text-tertiary)' }}>…</div>}
                        {!loading && filtered.length === 0 && <div className="text-xs p-4 text-center" style={{ color: 'var(--text-tertiary)' }}>{search ? 'Geen resultaten' : 'Nog geen dossiers'}</div>}
                        {filtered.map((m) => {
                            const isFocused = sidebarFocusId === m.id;
                            const dl = deadlineInfo(m.settings?.legal?.deadlines?.[0]?.date);
                            const rg = m.settings?.legal?.rechtsgebied;
                            return (
                                <div key={m.id} onClick={() => setSidebarFocusId(m.id)} onDoubleClick={() => selectMatter(m)} title="Klik om te bekijken · dubbelklik om te openen"
                                    className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm transition ${isFocused ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'}`}>
                                    <Scale className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand-primary)' }} />
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate">{m.name}</div>
                                        <div className="text-[10px] truncate flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                                            {rg && <span>{RECHTSGEBIED_LABELS[rg] || rg}</span>}
                                            {rg && <span>·</span>}
                                            <span>{m.sourceCount || 0} stuk</span>
                                            {dl && <span style={{ color: dl.color }}>· {dl.label}</span>}
                                        </div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); setPendingDelete(m); }} title="Verwijderen" className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500" style={{ color: 'var(--text-tertiary)' }}><Trash2 size={13} /></button>
                                </div>
                            );
                        })}
                    </div>
                </aside>

                {/* Detail pane */}
                <section className="flex-1 min-w-0 overflow-y-auto" style={{ background: 'var(--bg-secondary)' }}>
                    {loading ? (
                        <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-muted)' }} /></div>
                    ) : sidebarFocusId === '__new__' ? (
                        <div className="h-full flex flex-col items-center justify-center px-6">
                            <div className="w-full max-w-md">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-xl border-[1.5px] flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}><Plus className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} /></div>
                                    <div><h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Nieuw dossier</h2><p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Vul de zaakgegevens in</p></div>
                                </div>
                                <div className="space-y-2.5">
                                    <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setSidebarFocusId(null); }} placeholder="Naam dossier (bv. Jansen / Pietersen)…" className="w-full px-4 py-3 text-base rounded-xl border-[1.5px] focus:outline-none focus:border-[var(--accent-primary)]" style={fieldStyle} />
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Cliënt" className="px-3 py-2 text-sm rounded-xl border-[1.5px] focus:outline-none focus:border-[var(--accent-primary)]" style={fieldStyle} />
                                        <input value={form.wederpartij} onChange={e => setForm(f => ({ ...f, wederpartij: e.target.value }))} placeholder="Wederpartij" className="px-3 py-2 text-sm rounded-xl border-[1.5px] focus:outline-none focus:border-[var(--accent-primary)]" style={fieldStyle} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <select value={form.rechtsgebied} onChange={e => setForm(f => ({ ...f, rechtsgebied: e.target.value }))} className="px-3 py-2 text-sm rounded-xl border-[1.5px] focus:outline-none focus:border-[var(--accent-primary)]" style={fieldStyle}>
                                            <option value="">Rechtsgebied…</option>
                                            {RECHTSGEBIED_CHOICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                        </select>
                                        <input value={form.zaaknummer} onChange={e => setForm(f => ({ ...f, zaaknummer: e.target.value }))} placeholder="Zaaknummer" className="px-3 py-2 text-sm rounded-xl border-[1.5px] focus:outline-none focus:border-[var(--accent-primary)]" style={fieldStyle} />
                                    </div>
                                    <label className="block text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Eerstvolgende deadline (optioneel)
                                        <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="mt-1 w-full px-3 py-2 text-sm rounded-xl border-[1.5px] focus:outline-none focus:border-[var(--accent-primary)]" style={fieldStyle} />
                                    </label>
                                </div>
                                <div className="flex items-center justify-end gap-2 mt-4">
                                    <button onClick={() => setSidebarFocusId(null)} className="px-4 py-2 rounded-full text-sm hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-secondary)' }}>Annuleren</button>
                                    <button onClick={handleCreate} disabled={!form.name.trim() || creating} className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white disabled:opacity-40" style={{ background: 'var(--accent-primary)' }}>
                                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Dossier aanmaken
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : !focused ? (
                        <div className="h-full flex flex-col items-center justify-center px-6 py-12">
                            <Scale size={36} className="mb-4" style={{ color: 'var(--accent-primary)', opacity: 0.5 }} />
                            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{filtered.length === 0 && !search ? 'Maak uw eerste dossier' : 'Kies een dossier'}</h3>
                            <p className="text-sm max-w-md text-center leading-relaxed mb-6" style={{ color: 'var(--text-tertiary)' }}>
                                {filtered.length === 0 && !search ? 'Verzamel processtukken, onderzoek wet en jurisprudentie, en stel adviezen en processtukken op met correcte, geverifieerde bronvermeldingen.' : 'Klik op een dossier om het te bekijken, of maak een nieuw dossier.'}
                            </p>
                            <button onClick={() => setSidebarFocusId('__new__')} className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white" style={{ background: 'var(--accent-primary)' }}><Plus size={15} /> Nieuw dossier</button>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
                                <div className="w-12 h-12 rounded-xl border-[1.5px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-default)' }}><Scale className="w-6 h-6" style={{ color: 'var(--brand-primary)' }} /></div>
                                <div className="flex-1 min-w-0">
                                    {renamingId === focused.id ? (
                                        <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRename(focused.id); if (e.key === 'Escape') setRenamingId(null); }} onBlur={() => handleRename(focused.id)} className="w-full text-lg font-bold bg-transparent outline-none border-b-[1.5px] focus:border-[var(--accent-primary)]" style={{ color: 'var(--text-primary)', borderColor: 'var(--border-subtle)' }} />
                                    ) : (
                                        <h2 className="text-lg font-bold truncate cursor-text" style={{ color: 'var(--text-primary)' }} onDoubleClick={() => { setRenamingId(focused.id); setRenameValue(focused.name); }} title="Dubbelklik om te hernoemen">{focused.name}</h2>
                                    )}
                                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                                        {focused.settings?.legal?.clientName || 'Dossier'}{focused.settings?.legal?.wederpartij ? ` / ${focused.settings.legal.wederpartij}` : ''} · {focused.sourceCount || 0} stuk{(focused.sourceCount || 0) !== 1 ? 'ken' : ''} · Bijgewerkt {timeAgo(focused.updatedAt || focused.createdAt)}
                                    </p>
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-2">
                                    <button onClick={() => { setRenamingId(focused.id); setRenameValue(focused.name); }} title="Hernoemen" className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-tertiary)' }}><Pencil size={16} /></button>
                                    <button onClick={() => setPendingDelete(focused)} title="Verwijderen" className="p-2 rounded-lg hover:bg-red-500/10 hover:text-red-500" style={{ color: 'var(--text-tertiary)' }}><Trash2 size={16} /></button>
                                    <button onClick={() => selectMatter(focused)} className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-white" style={{ background: 'var(--accent-primary)' }}>Open dossier <ChevronRight className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto px-6 py-6">
                                <div className="max-w-2xl grid grid-cols-2 gap-3">
                                    <Field label="Cliënt" value={focused.settings?.legal?.clientName} />
                                    <Field label="Wederpartij" value={focused.settings?.legal?.wederpartij} />
                                    <Field label="Rechtsgebied" value={RECHTSGEBIED_LABELS[focused.settings?.legal?.rechtsgebied] || focused.settings?.legal?.rechtsgebied} />
                                    <Field label="Zaaknummer" value={focused.settings?.legal?.zaaknummer} />
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {pendingDelete && (
                <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4" onClick={() => setPendingDelete(null)}>
                    <div className="rounded-xl w-full max-w-md shadow-xl border" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-default)' }} onClick={e => e.stopPropagation()}>
                        <div className="flex items-start justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
                            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Dossier verwijderen</div>
                            <button onClick={() => setPendingDelete(null)} style={{ color: 'var(--text-tertiary)' }}><X size={18} /></button>
                        </div>
                        <div className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Dossier <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{pendingDelete.name}</span> en alle stukken verwijderen? Dit kan niet ongedaan worden gemaakt.</div>
                        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t" style={{ borderColor: 'var(--border-default)' }}>
                            <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-full text-sm hover:bg-[var(--bg-secondary)]" style={{ color: 'var(--text-secondary)' }}>Annuleren</button>
                            <button onClick={confirmDelete} className="px-4 py-2 rounded-full text-sm bg-red-500 text-white hover:bg-red-600">Verwijderen</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const fieldStyle = { borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' };

// Convert a chat attachment's data-URL back into a File so it can be uploaded
// to Stukken via the same /sources/file pipeline as the File button.
async function dataUrlToFile(att) {
    const res = await fetch(att.content);
    const blob = await res.blob();
    return new File([blob], att.name || 'bestand', { type: att.type || blob.type || 'application/octet-stream' });
}

function verifyToastStyle(tone) {
    if (tone === 'warn') return { background: 'rgba(245,158,11,0.10)', borderColor: 'rgba(245,158,11,0.35)', color: '#b45309' };
    if (tone === 'success') return { background: 'rgba(34,197,94,0.10)', borderColor: 'rgba(34,197,94,0.35)', color: '#15803d' };
    return { background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' };
}

function Field({ label, value }) {
    return (
        <div className="rounded-xl border-[1.5px] px-4 py-3" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
            <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
            <div className="text-sm font-medium truncate" style={{ color: value ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{value || '—'}</div>
        </div>
    );
}
