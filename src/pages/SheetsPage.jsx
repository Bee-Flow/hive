/**
 * SheetsPage — Main page for the Sheets (spreadsheet) feature.
 *
 * 2-panel layout:
 * Left/Center: Grid editor with formula bar + sheet tabs
 * Right: SheetStudio (AI chat) panel
 *
 * List + Detail views with CRUD for spreadsheets.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    Plus, Search, Trash2, Loader2, ArrowLeft,
    Download, Table, PanelRightOpen,
    PanelRightClose, FileText, ChevronDown,
    MoreVertical, Copy, Scissors, ClipboardPaste,
    Bold, Italic, AlignLeft, AlignCenter, AlignRight,
    Palette, Hash, Type as TypeIcon
} from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import useChatEngine from '../hooks/useChatEngine';
import { getCellDisplayValue, getCellEditValue } from '../utils/formulaEngine';
import MessageItem from '../components/chat/MessageItem';
import InputArea from '../components/InputArea';

// ─── Constants ───────────────────────────────────────────────────
const DEFAULT_COL_WIDTH = 100;
const DEFAULT_ROW_HEIGHT = 28;
const ROW_HEADER_WIDTH = 48;
const NUM_COLS = 26; // A-Z
const NUM_ROWS = 100;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function colLetter(idx) { return ALPHABET[idx] || ALPHABET[idx % 26]; }
function cellRef(col, row) { return `${colLetter(col)}${row + 1}`; }

function parseCellRef(ref) {
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    const col = match[1].split('').reduce((acc, c) => acc * 26 + c.charCodeAt(0) - 64, 0) - 1;
    const row = parseInt(match[2], 10) - 1;
    return { col, row };
}

function createEmptySheet(name = 'Sheet 1') {
    return {
        id: crypto.randomUUID?.() || `sheet-${Date.now()}`,
        name,
        cells: {},
        colWidths: {},
        rowHeights: {},
    };
}

// getCellDisplay: show formula text (for formula bar and editing)
function getCellDisplay(cell) {
    return getCellEditValue(cell);
}

// getCellValue: compute formula result (for grid display)
function getCellValue(cell, allCells) {
    return getCellDisplayValue(cell, allCells);
}

function getCellStyle(cell) {
    if (!cell || typeof cell !== 'object') return {};
    return cell.style || {};
}

export default function SheetsPage({ user, onBack }) {

    // ─── State ────────────────────────────────────────────────────
    const [spreadsheets, setSpreadsheets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [sheetsContent, setSheetsContent] = useState([]);
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);
    const [sources, setSources] = useState([]);
    const [showStudio, setShowStudio] = useState(true);
    const [selectedTier, setSelectedTier] = useState('auto');
    const [modelTiers, setModelTiers] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [saving, setSaving] = useState(false);

    // Cell editing
    const [activeCell, setActiveCell] = useState(null); // "A1"
    const [editingCell, setEditingCell] = useState(null); // "A1" when editing
    const [editValue, setEditValue] = useState('');
    const [formulaBarValue, setFormulaBarValue] = useState('');
    const [selection, setSelection] = useState(null); // { start: {col,row}, end: {col,row} }

    const saveTimeoutRef = useRef(null);
    const gridRef = useRef(null);
    const cellInputRef = useRef(null);
    const formulaInputRef = useRef(null);

    // ─── Load model tiers (same as NotebooksPage) ────────────────
    useEffect(() => {
        authFetch(`${API_BASE}/ai/config/chat-models`)
            .then(r => r.ok ? r.json() : {})
            .then(data => setModelTiers(data))
            .catch(() => {});
    }, []);

    // ─── Load spreadsheets ───────────────────────────────────────
    useEffect(() => {
        loadSpreadsheets();
    }, []);

    const loadSpreadsheets = async () => {
        try {
            setLoading(true);
            const res = await authFetch(`${API_BASE}/api/sheets`);
            if (res.ok) {
                const data = await res.json();
                const list = data.spreadsheets || data || [];
                setSpreadsheets(list);

                // Auto-select from URL
                const urlParams = new URLSearchParams(window.location.search);
                const sheetId = urlParams.get('id');
                if (sheetId) {
                    const found = list.find(s => s.id === sheetId);
                    if (found) selectSpreadsheet(found);
                }
            }
        } catch (err) {
            console.error('[Sheets] Failed to load spreadsheets:', err);
        } finally {
            setLoading(false);
        }
    };

    // ─── Select spreadsheet ──────────────────────────────────────
    const selectSpreadsheet = useCallback(async (sheet) => {
        setSelected(sheet);
        window.history.replaceState({}, '', `/app/sheets?id=${sheet.id}`);

        let content = sheet.sheetsContent || sheet.sheets_content || [];
        if (!content || content.length === 0) {
            content = [createEmptySheet()];
        }
        setSheetsContent(content);
        setActiveSheetIndex(0);
        setActiveCell('A1');
        setEditingCell(null);

        // Load sources
        try {
            const res = await authFetch(`${API_BASE}/api/sheets/${sheet.id}/sources`);
            if (res.ok) {
                const data = await res.json();
                setSources(data.sources || data || []);
            }
        } catch (e) { console.warn('Failed to load sources:', e); }
    }, []);

    // ─── Create spreadsheet ──────────────────────────────────────
    const createSpreadsheet = async () => {
        try {
            const res = await authFetch(`${API_BASE}/api/sheets`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: 'Untitled Spreadsheet', description: '' }),
            });
            if (res.ok) {
                const data = await res.json();
                const sheet = data.spreadsheet || data;
                setSpreadsheets(prev => [sheet, ...prev]);
                selectSpreadsheet(sheet);
            }
        } catch (err) {
            console.error('[Sheets] Failed to create spreadsheet:', err);
        }
    };

    // ─── Delete spreadsheet ──────────────────────────────────────
    const deleteSpreadsheet = async (sheetId) => {
        if (!confirm('Delete this spreadsheet? This cannot be undone.')) return;
        try {
            const res = await authFetch(`${API_BASE}/api/sheets/${sheetId}`, { method: 'DELETE' });
            if (res.ok) {
                setSpreadsheets(prev => prev.filter(s => s.id !== sheetId));
                if (selected?.id === sheetId) {
                    setSelected(null);
                    window.history.replaceState({}, '', '/app/sheets');
                }
            }
        } catch (err) {
            console.error('[Sheets] Failed to delete spreadsheet:', err);
        }
    };

    // ─── Auto-save ───────────────────────────────────────────────
    const saveSheetsContent = useCallback((newContent) => {
        if (!selected) return;
        setSheetsContent(newContent);

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                setSaving(true);
                await authFetch(`${API_BASE}/api/sheets/${selected.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sheetsContent: newContent }),
                });
            } catch (err) {
                console.error('[Sheets] Auto-save failed:', err);
            } finally {
                setSaving(false);
            }
        }, 1500);
    }, [selected]);

    // ─── Cell editing ────────────────────────────────────────────
    const activeSheet = sheetsContent[activeSheetIndex] || null;

    const setCellValue = useCallback((ref, value) => {
        const newContent = [...sheetsContent];
        const sheet = { ...newContent[activeSheetIndex] };
        const cells = { ...sheet.cells };

        if (typeof value === 'object' && value !== null) {
            cells[ref] = value;
        } else if (typeof value === 'string' && value.startsWith('=')) {
            cells[ref] = { ...(cells[ref] || {}), value: value, formula: value };
        } else {
            // Try to parse as number
            const num = Number(value);
            const finalVal = value !== '' && !isNaN(num) ? num : value;
            if (typeof cells[ref] === 'object' && cells[ref] !== null) {
                cells[ref] = { ...cells[ref], value: finalVal, formula: null };
            } else {
                cells[ref] = finalVal;
            }
        }

        sheet.cells = cells;
        newContent[activeSheetIndex] = sheet;
        saveSheetsContent(newContent);
    }, [sheetsContent, activeSheetIndex, saveSheetsContent]);

    const commitEdit = useCallback(() => {
        if (editingCell && editValue !== undefined) {
            setCellValue(editingCell, editValue);
        }
        setEditingCell(null);
    }, [editingCell, editValue, setCellValue]);

    const startEditing = useCallback((ref) => {
        const cell = activeSheet?.cells?.[ref];
        const display = getCellDisplay(cell);
        setEditingCell(ref);
        setEditValue(String(display));
        setFormulaBarValue(String(display));
    }, [activeSheet]);

    // Update formula bar when active cell changes
    useEffect(() => {
        if (activeCell && activeSheet) {
            const cell = activeSheet.cells?.[activeCell];
            const display = getCellDisplay(cell);
            setFormulaBarValue(String(display));
        }
    }, [activeCell, activeSheet]);

    // ─── Keyboard navigation ─────────────────────────────────────
    const handleGridKeyDown = useCallback((e) => {
        if (!activeCell) return;
        const pos = parseCellRef(activeCell);
        if (!pos) return;

        if (editingCell) {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitEdit();
                // Move down
                const newRef = cellRef(pos.col, Math.min(pos.row + 1, NUM_ROWS - 1));
                setActiveCell(newRef);
            } else if (e.key === 'Escape') {
                setEditingCell(null);
            } else if (e.key === 'Tab') {
                e.preventDefault();
                commitEdit();
                const newRef = cellRef(Math.min(pos.col + 1, NUM_COLS - 1), pos.row);
                setActiveCell(newRef);
            }
            return;
        }

        const moveMap = {
            ArrowUp: () => cellRef(pos.col, Math.max(0, pos.row - 1)),
            ArrowDown: () => cellRef(pos.col, Math.min(NUM_ROWS - 1, pos.row + 1)),
            ArrowLeft: () => cellRef(Math.max(0, pos.col - 1), pos.row),
            ArrowRight: () => cellRef(Math.min(NUM_COLS - 1, pos.col + 1), pos.row),
            Tab: () => cellRef(Math.min(NUM_COLS - 1, pos.col + 1), pos.row),
            Enter: () => cellRef(pos.col, Math.min(NUM_ROWS - 1, pos.row + 1)),
        };

        if (moveMap[e.key]) {
            e.preventDefault();
            setActiveCell(moveMap[e.key]());
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            setCellValue(activeCell, '');
        } else if (e.key === 'F2') {
            startEditing(activeCell);
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            // Start typing
            setEditingCell(activeCell);
            setEditValue(e.key);
            setFormulaBarValue(e.key);
        }
    }, [activeCell, editingCell, commitEdit, setCellValue, startEditing]);

    // ─── Sheet tabs ──────────────────────────────────────────────
    const addSheet = useCallback(() => {
        const newContent = [...sheetsContent, createEmptySheet(`Sheet ${sheetsContent.length + 1}`)];
        saveSheetsContent(newContent);
        setActiveSheetIndex(newContent.length - 1);
    }, [sheetsContent, saveSheetsContent]);

    const deleteSheet = useCallback((idx) => {
        if (sheetsContent.length <= 1) return;
        const newContent = sheetsContent.filter((_, i) => i !== idx);
        saveSheetsContent(newContent);
        if (activeSheetIndex >= newContent.length) {
            setActiveSheetIndex(Math.max(0, newContent.length - 1));
        }
    }, [sheetsContent, activeSheetIndex, saveSheetsContent]);

    // ─── useChatEngine ───────────────────────────────────────────
    const { messages: chatMessages, setMessages: setChatMessages, isLoading: chatLoading,
        sendMessage: sendChatMessage, stopGenerating: stopChatGenerating,
        retryMessage: retryChatMessage, editAndRegenerate: editAndRegenerateChat,
        submittedFormIds, setSubmittedFormIds,
    } = useChatEngine({
        selectedAgent: null,
        currentConversation: null,
        onConversationCreated: useCallback(() => {}, []),
        getNotebookPayload: useCallback(() => ({}), []),
        onNotebookUpdate: useCallback(() => {}, []),
        directMode: useMemo(() => ({
            enabled: true,
            modelTier: selectedTier,
            customEndpoint: selected ? '/ai/chat/sheet/stream' : undefined,
            getExtraPayload: () => selected ? { spreadsheetId: selected.id, sheetsContent } : {},
        }), [selectedTier, selected?.id, sheetsContent]),
        onDirectConversationCreated: useCallback(() => {}, []),
        onNotebookDocUpdate: useCallback((cellsOrContent, sheetIndexOrTitle) => {
            // sheet_update: receives (cells, sheetIndex) — merge cell deltas
            if (cellsOrContent && typeof cellsOrContent === 'object' && !Array.isArray(cellsOrContent)) {
                const sheetIdx = typeof sheetIndexOrTitle === 'number' ? sheetIndexOrTitle : 0;
                setSheetsContent(prev => {
                    const newContent = [...prev];
                    if (newContent[sheetIdx]) {
                        newContent[sheetIdx] = {
                            ...newContent[sheetIdx],
                            cells: { ...(newContent[sheetIdx].cells || {}), ...cellsOrContent }
                        };
                    }
                    return newContent;
                });
            }
            // Full content array replacement (e.g. from bulk operations)
            else if (Array.isArray(cellsOrContent)) {
                saveSheetsContent(cellsOrContent);
            }
        }, [saveSheetsContent]),
        onNotebookSourceAdded: useCallback((source) => {
            setSources(prev => [...prev, source]);
        }, []),
    });

    const handleSendMessage = useCallback((text, attachments) => {
        if (!text?.trim() && (!attachments || attachments.length === 0)) return;
        sendChatMessage(text, attachments);
    }, [sendChatMessage]);

    // ─── Filtered spreadsheets ───────────────────────────────────
    const filteredSpreadsheets = spreadsheets.filter(s =>
        !searchQuery || (s.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // ─── Render ──────────────────────────────────────────────────

    // LIST VIEW
    if (!selected) {
        return (
            <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                background: 'var(--bg-primary)',
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div>
                        <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Table style={{ width: '22px', height: '22px', color: 'var(--accent-primary)' }} />
                            Sheets
                        </h1>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Create and analyze spreadsheets with AI
                        </p>
                    </div>
                    <button
                        onClick={createSpreadsheet}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px',
                            borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '14px',
                            fontWeight: 600, color: '#fff',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
                            transition: 'transform 0.15s ease',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        <Plus style={{ width: '16px', height: '16px' }} />
                        New Spreadsheet
                    </button>
                </div>

                {/* Search */}
                <div style={{ padding: '12px 24px' }}>
                    <div style={{ position: 'relative', maxWidth: '400px' }}>
                        <Search style={{
                            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
                            width: '16px', height: '16px', color: 'var(--text-muted)',
                        }} />
                        <input
                            type="text"
                            placeholder="Search spreadsheets..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 12px 10px 40px', borderRadius: '10px',
                                border: '1px solid var(--border-default)', background: 'var(--bg-secondary)',
                                fontSize: '13px', color: 'var(--text-primary)', outline: 'none',
                            }}
                        />
                    </div>
                </div>

                {/* Grid */}
                <div style={{ flex: 1, overflow: 'auto', padding: '12px 24px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                            <Loader2 style={{ width: '24px', height: '24px', animation: 'spin 1s linear infinite' }} />
                        </div>
                    ) : filteredSpreadsheets.length === 0 ? (
                        <div style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            justifyContent: 'center', padding: '60px', color: 'var(--text-muted)',
                        }}>
                            <Table style={{ width: '48px', height: '48px', marginBottom: '16px', opacity: 0.4 }} />
                            <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
                                {searchQuery ? 'No spreadsheets found' : 'No spreadsheets yet'}
                            </div>
                            <div style={{ fontSize: '13px' }}>
                                {searchQuery ? 'Try a different search' : 'Create your first AI-powered spreadsheet'}
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '16px',
                        }}>
                            {filteredSpreadsheets.map(sheet => (
                                <SpreadsheetCard
                                    key={sheet.id}
                                    sheet={sheet}
                                    onClick={() => selectSpreadsheet(sheet)}
                                    onDelete={() => deleteSpreadsheet(sheet.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // DETAIL VIEW
    return (
        <div style={{ display: 'flex', height: '100%', background: 'var(--bg-primary)' }}>
            {/* Center: Grid editor */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                {/* Top bar */}
                <div style={{
                    padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)',
                    display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0,
                    background: 'var(--bg-secondary)',
                }}>
                    <button
                        onClick={() => { setSelected(null); window.history.replaceState({}, '', '/app/sheets'); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px',
                            borderRadius: '6px', border: 'none', background: 'transparent',
                            cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px',
                        }}
                    >
                        <ArrowLeft style={{ width: '14px', height: '14px' }} />
                        Back
                    </button>
                    <SheetNameEditor
                        name={selected.name}
                        onSave={async (name) => {
                            try {
                                await authFetch(`${API_BASE}/api/sheets/${selected.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ name }),
                                });
                                setSelected(prev => ({ ...prev, name }));
                                setSpreadsheets(prev => prev.map(s => s.id === selected.id ? { ...s, name } : s));
                            } catch (err) {
                                console.error('Failed to rename:', err);
                            }
                        }}
                    />
                    <div style={{ flex: 1 }} />
                    {saving && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                            Saving...
                        </span>
                    )}
                    {/* Studio toggle */}
                    <button
                        onClick={() => setShowStudio(!showStudio)}
                        title={showStudio ? 'Hide AI Studio' : 'Show AI Studio'}
                        style={{
                            display: 'flex', alignItems: 'center', padding: '4px',
                            borderRadius: '6px', border: 'none', background: 'transparent',
                            cursor: 'pointer', color: 'var(--text-secondary)',
                        }}
                    >
                        {showStudio
                            ? <PanelRightClose style={{ width: '16px', height: '16px' }} />
                            : <PanelRightOpen style={{ width: '16px', height: '16px' }} />
                        }
                    </button>
                    {/* Export */}
                    <ExportButton selected={selected} sheetsContent={sheetsContent} />
                </div>

                {/* Formula bar */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '1px',
                    borderBottom: '1px solid var(--border-subtle)',
                    background: 'var(--bg-secondary)', flexShrink: 0,
                }}>
                    <div style={{
                        width: '80px', padding: '4px 8px', fontSize: '12px', fontWeight: 600,
                        color: 'var(--text-primary)', background: 'var(--bg-tertiary)',
                        textAlign: 'center', borderRight: '1px solid var(--border-subtle)',
                        flexShrink: 0,
                    }}>
                        {activeCell || ''}
                    </div>
                    <div style={{
                        padding: '0 4px', fontSize: '13px', color: 'var(--text-muted)',
                        fontStyle: 'italic', flexShrink: 0,
                    }}>
                        <span style={{ fontSize: '11px' }}>fx</span>
                    </div>
                    <input
                        ref={formulaInputRef}
                        value={editingCell ? editValue : formulaBarValue}
                        onChange={(e) => {
                            if (editingCell) {
                                setEditValue(e.target.value);
                            } else if (activeCell) {
                                startEditing(activeCell);
                                setEditValue(e.target.value);
                            }
                            setFormulaBarValue(e.target.value);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                if (editingCell) {
                                    setCellValue(editingCell, editValue);
                                    setEditingCell(null);
                                } else if (activeCell) {
                                    setCellValue(activeCell, formulaBarValue);
                                }
                                gridRef.current?.focus();
                            } else if (e.key === 'Escape') {
                                setEditingCell(null);
                                gridRef.current?.focus();
                            }
                        }}
                        onFocus={() => {
                            if (!editingCell && activeCell) {
                                startEditing(activeCell);
                            }
                        }}
                        style={{
                            flex: 1, padding: '5px 8px', border: 'none', background: 'transparent',
                            fontSize: '12px', color: 'var(--text-primary)', outline: 'none',
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        }}
                    />
                </div>

                {/* Grid container */}
                <div
                    ref={gridRef}
                    tabIndex={0}
                    onKeyDown={handleGridKeyDown}
                    style={{
                        flex: 1, overflow: 'auto', outline: 'none',
                        background: '#fff', position: 'relative',
                    }}
                >
                    <SpreadsheetGrid
                        sheet={activeSheet}
                        activeCell={activeCell}
                        editingCell={editingCell}
                        editValue={editValue}
                        onCellClick={(ref) => {
                            if (editingCell) commitEdit();
                            setActiveCell(ref);
                        }}
                        onCellDoubleClick={(ref) => startEditing(ref)}
                        onEditChange={(val) => {
                            setEditValue(val);
                            setFormulaBarValue(val);
                        }}
                        onEditCommit={() => {
                            commitEdit();
                            gridRef.current?.focus();
                        }}
                        onEditCancel={() => {
                            setEditingCell(null);
                            gridRef.current?.focus();
                        }}
                    />
                </div>

                {/* Sheet tabs */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0',
                    borderTop: '1px solid var(--border-subtle)',
                    background: 'var(--bg-secondary)', flexShrink: 0,
                    padding: '0 8px', height: '32px', overflow: 'auto',
                }}>
                    {sheetsContent.map((s, i) => (
                        <button
                            key={s.id}
                            onClick={() => { if (editingCell) commitEdit(); setActiveSheetIndex(i); setActiveCell('A1'); }}
                            onDoubleClick={() => {
                                const newName = prompt('Rename sheet:', s.name);
                                if (newName?.trim()) {
                                    const newContent = [...sheetsContent];
                                    newContent[i] = { ...newContent[i], name: newName.trim() };
                                    saveSheetsContent(newContent);
                                }
                            }}
                            style={{
                                padding: '4px 16px', fontSize: '12px', border: 'none',
                                borderBottom: i === activeSheetIndex ? '2px solid var(--accent-primary)' : '2px solid transparent',
                                background: i === activeSheetIndex ? 'var(--bg-primary)' : 'transparent',
                                color: i === activeSheetIndex ? 'var(--text-primary)' : 'var(--text-secondary)',
                                cursor: 'pointer', fontWeight: i === activeSheetIndex ? 600 : 400,
                                transition: 'all 0.15s',
                                borderRight: '1px solid var(--border-subtle)',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {s.name || `Sheet ${i + 1}`}
                        </button>
                    ))}
                    <button
                        onClick={addSheet}
                        style={{
                            padding: '4px 8px', border: 'none', background: 'transparent',
                            cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px',
                            display: 'flex', alignItems: 'center',
                        }}
                        title="Add sheet"
                    >
                        <Plus style={{ width: '14px', height: '14px' }} />
                    </button>
                </div>
            </div>

            {/* Right: AI Studio */}
            {showStudio && (
                <div style={{
                    width: '340px', minWidth: '300px', borderLeft: '1px solid var(--border-subtle)',
                    display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)',
                }}>
                    <SheetStudio
                        messages={chatMessages}
                        isLoading={chatLoading}
                        onSend={handleSendMessage}
                        onStop={stopChatGenerating}
                        onRetry={retryChatMessage}
                        onEdit={editAndRegenerateChat}
                        modelTiers={modelTiers}
                        selectedTier={selectedTier}
                        onTierChange={setSelectedTier}
                        submittedFormIds={submittedFormIds}
                        setSubmittedFormIds={setSubmittedFormIds}
                    />
                </div>
            )}
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function SpreadsheetGrid({ sheet, activeCell, editingCell, editValue, onCellClick, onCellDoubleClick, onEditChange, onEditCommit, onEditCancel }) {
    const cells = sheet?.cells || {};
    const colWidths = sheet?.colWidths || {};
    const rowHeights = sheet?.rowHeights || {};

    return (
        <table style={{
            borderCollapse: 'collapse', tableLayout: 'fixed',
            minWidth: '100%', userSelect: 'none',
        }}>
            <thead>
                <tr>
                    {/* Corner cell */}
                    <th style={{
                        width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH,
                        height: DEFAULT_ROW_HEIGHT,
                        background: '#f8f9fa', border: '1px solid #e0e0e0',
                        position: 'sticky', top: 0, left: 0, zIndex: 3,
                    }} />
                    {/* Column headers */}
                    {Array.from({ length: NUM_COLS }, (_, i) => (
                        <th key={i} style={{
                            width: colWidths[colLetter(i)] || DEFAULT_COL_WIDTH,
                            minWidth: 50,
                            height: DEFAULT_ROW_HEIGHT,
                            background: '#f8f9fa', border: '1px solid #e0e0e0',
                            fontSize: '11px', fontWeight: 600, color: '#666',
                            textAlign: 'center', position: 'sticky', top: 0, zIndex: 2,
                            padding: 0,
                        }}>
                            {colLetter(i)}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {Array.from({ length: NUM_ROWS }, (_, rowIdx) => (
                    <tr key={rowIdx}>
                        {/* Row header */}
                        <td style={{
                            width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH,
                            height: rowHeights[String(rowIdx + 1)] || DEFAULT_ROW_HEIGHT,
                            background: '#f8f9fa', border: '1px solid #e0e0e0',
                            fontSize: '11px', fontWeight: 500, color: '#888',
                            textAlign: 'center', position: 'sticky', left: 0, zIndex: 1,
                            padding: 0,
                        }}>
                            {rowIdx + 1}
                        </td>
                        {/* Data cells */}
                        {Array.from({ length: NUM_COLS }, (_, colIdx) => {
                            const ref = cellRef(colIdx, rowIdx);
                            const cell = cells[ref];
                            const isActive = ref === activeCell;
                            const isEditing = ref === editingCell;
                            const style = getCellStyle(cell);
                            const val = getCellValue(cell, cells);

                            return (
                                <td
                                    key={colIdx}
                                    onClick={() => onCellClick(ref)}
                                    onDoubleClick={() => onCellDoubleClick(ref)}
                                    style={{
                                        padding: 0,
                                        height: rowHeights[String(rowIdx + 1)] || DEFAULT_ROW_HEIGHT,
                                        border: '1px solid #e0e0e0',
                                        outline: isActive ? '2px solid var(--accent-primary)' : 'none',
                                        outlineOffset: '-1px',
                                        background: isActive ? '#e8f0fe' : (style.backgroundColor || '#fff'),
                                        position: 'relative',
                                        overflow: 'hidden',
                                        cursor: 'cell',
                                    }}
                                >
                                    {isEditing ? (
                                        <input
                                            autoFocus
                                            value={editValue}
                                            onChange={(e) => onEditChange(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') { e.preventDefault(); onEditCommit(); }
                                                else if (e.key === 'Escape') onEditCancel();
                                                else if (e.key === 'Tab') { e.preventDefault(); onEditCommit(); }
                                                e.stopPropagation();
                                            }}
                                            onBlur={() => onEditCommit()}
                                            style={{
                                                width: '100%', height: '100%',
                                                border: 'none', outline: 'none',
                                                padding: '2px 6px', fontSize: '12px',
                                                fontFamily: "'Inter', -apple-system, sans-serif",
                                                background: '#fff',
                                                boxSizing: 'border-box',
                                            }}
                                        />
                                    ) : (
                                        <div style={{
                                            padding: '2px 6px', fontSize: '12px',
                                            whiteSpace: 'nowrap', overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            fontFamily: "'Inter', -apple-system, sans-serif",
                                            fontWeight: style.fontWeight || 'normal',
                                            fontStyle: style.fontStyle || 'normal',
                                            color: style.color || '#333',
                                            textAlign: style.textAlign || (typeof val === 'number' ? 'right' : 'left'),
                                            lineHeight: `${(rowHeights[String(rowIdx + 1)] || DEFAULT_ROW_HEIGHT) - 4}px`,
                                        }}>
                                            {val !== '' && val !== null && val !== undefined ? String(val) : ''}
                                        </div>
                                    )}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function SpreadsheetCard({ sheet, onClick, onDelete }) {
    const cellCount = (() => {
        const content = sheet.sheetsContent || sheet.sheets_content || [];
        return content.reduce((sum, s) => sum + Object.keys(s?.cells || {}).length, 0);
    })();
    const sheetCount = (sheet.sheetsContent || sheet.sheets_content || []).length || 0;
    const updatedAt = new Date(sheet.updatedAt || sheet.updated_at || sheet.createdAt || sheet.created_at);
    const timeAgo = getTimeAgo(updatedAt);

    return (
        <div
            onClick={onClick}
            style={{
                padding: '16px', borderRadius: '12px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-secondary)', cursor: 'pointer',
                transition: 'all 0.15s ease', position: 'relative',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#10b981';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'translateY(0)';
            }}
        >
            {/* Preview */}
            <div style={{
                aspectRatio: '16/9', borderRadius: '8px', marginBottom: '12px',
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
            }}>
                <GridPreview cells={(sheet.sheetsContent || sheet.sheets_content || [])?.[0]?.cells || {}} />
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sheet.name || 'Untitled'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>{cellCount} cell{cellCount !== 1 ? 's' : ''}</span>
                {sheetCount > 0 && <><span>·</span><span>{sheetCount} sheet{sheetCount !== 1 ? 's' : ''}</span></>}
                <span>·</span>
                <span>{timeAgo}</span>
            </div>
            {/* Delete */}
            <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                style={{
                    position: 'absolute', top: '8px', right: '8px',
                    padding: '4px', borderRadius: '6px', border: 'none',
                    background: 'transparent', cursor: 'pointer',
                    color: 'var(--text-muted)', opacity: 0, transition: 'opacity 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.color = 'var(--error)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = 0; }}
            >
                <Trash2 style={{ width: '14px', height: '14px' }} />
            </button>
        </div>
    );
}

function GridPreview({ cells }) {
    // Show a mini visual preview of the spreadsheet
    const keys = Object.keys(cells).slice(0, 20);
    if (keys.length === 0) {
        return <Table style={{ width: '32px', height: '32px', color: '#10b981', opacity: 0.4 }} />;
    }

    return (
        <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '2px',
            padding: '12px', width: '100%', height: '100%',
        }}>
            {Array.from({ length: 16 }, (_, i) => {
                const ref = cellRef(i % 4, Math.floor(i / 4));
                const hasData = !!cells[ref];
                return (
                    <div key={i} style={{
                        background: hasData ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.5)',
                        borderRadius: '2px',
                        border: '1px solid rgba(16,185,129,0.1)',
                    }} />
                );
            })}
        </div>
    );
}

function SheetNameEditor({ name, onSave }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(name);
    const inputRef = useRef(null);

    useEffect(() => { setValue(name); }, [name]);
    useEffect(() => {
        if (editing && inputRef.current) inputRef.current.focus();
    }, [editing]);

    if (!editing) {
        return (
            <span
                onClick={() => setEditing(true)}
                style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'text' }}
            >
                {name || 'Untitled'}
            </span>
        );
    }

    return (
        <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onBlur={() => { setEditing(false); if (value.trim() && value !== name) onSave(value.trim()); }}
            onKeyDown={e => {
                if (e.key === 'Enter') { setEditing(false); if (value.trim() && value !== name) onSave(value.trim()); }
                if (e.key === 'Escape') { setEditing(false); setValue(name); }
            }}
            style={{
                fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)',
                border: '1px solid var(--accent-primary)', borderRadius: '4px',
                background: 'var(--bg-primary)', padding: '2px 6px', outline: 'none',
                width: '200px',
            }}
        />
    );
}

function ExportButton({ selected, sheetsContent }) {
    const [showMenu, setShowMenu] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!showMenu) return;
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setShowMenu(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [showMenu]);

    const exportAs = async (format) => {
        setShowMenu(false);
        try {
            const res = await authFetch(`${API_BASE}/api/sheetsExport/${selected.id}/export/${format}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheets: sheetsContent, title: selected.name }),
            });
            if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                const ext = format === 'xlsx' ? 'xlsx' : format === 'csv' ? 'csv' : 'pdf';
                a.download = `${selected.name || 'spreadsheet'}.${ext}`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Export failed:', err);
        }
    };

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={() => setShowMenu(!showMenu)}
                style={{
                    display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px',
                    borderRadius: '6px', border: '1px solid var(--border-default)',
                    background: 'var(--bg-primary)', cursor: 'pointer',
                    color: 'var(--text-primary)', fontSize: '12px', fontWeight: 500,
                }}
            >
                <Download style={{ width: '14px', height: '14px' }} />
                Export
                <ChevronDown style={{ width: '12px', height: '12px' }} />
            </button>
            {showMenu && (
                <div style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: '4px',
                    width: '140px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', zIndex: 10,
                    padding: '4px',
                }}>
                    {[
                        { label: 'Excel (.xlsx)', format: 'xlsx' },
                        { label: 'CSV (.csv)', format: 'csv' },
                        { label: 'PDF (.pdf)', format: 'pdf' },
                    ].map(({ label, format }) => (
                        <button
                            key={format}
                            onClick={() => exportAs(format)}
                            style={{
                                width: '100%', padding: '6px 10px', border: 'none',
                                background: 'transparent', cursor: 'pointer', fontSize: '12px',
                                color: 'var(--text-primary)', textAlign: 'left', borderRadius: '4px',
                                transition: 'background 0.1s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function SheetStudio({
    messages, isLoading, onSend, onStop, onRetry, onEdit,
    modelTiers, selectedTier, onTierChange,
    submittedFormIds, setSubmittedFormIds,
}) {
    const endRef = useRef(null);
    const [copied, setCopied] = useState(false);
    const [chatInput, setChatInput] = useState('');

    // Auto-scroll
    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleCopy = (content) => {
        navigator.clipboard.writeText(content).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div style={{
                padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: '8px',
            }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>💬 AI Chat</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Ask questions about your data
                </span>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
                {messages.length === 0 ? (
                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', height: '100%', textAlign: 'center', padding: '20px',
                    }}>
                        <div style={{
                            width: '40px', height: '40px', borderRadius: '12px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: '12px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                        }}>
                            <span style={{ fontSize: '18px' }}>📊</span>
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                            AI Spreadsheet Assistant
                        </div>
                        <div style={{ fontSize: '10px', lineHeight: '1.5', maxWidth: '240px', color: 'var(--text-muted)' }}>
                            Ask me to fill data, create formulas, analyze information, or build tables from your sources.
                        </div>
                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                            {[
                                'Create a budget spreadsheet',
                                'Fill column A with months',
                                'Add SUM formula for totals',
                            ].map((suggestion, i) => (
                                <button
                                    key={i}
                                    onClick={() => { setChatInput(suggestion); }}
                                    style={{
                                        padding: '8px 12px', borderRadius: '8px', fontSize: '11px',
                                        border: '1px solid var(--border-default)', background: 'var(--bg-secondary)',
                                        cursor: 'pointer', color: 'var(--text-secondary)',
                                        textAlign: 'left', transition: 'all 0.15s',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.background = 'var(--bg-secondary)'; }}
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={msg.id || idx} style={{ position: 'relative', marginBottom: '8px' }}>
                            <MessageItem
                                msg={msg}
                                idx={idx}
                                isUser={msg.role === 'user'}
                                onCopy={handleCopy}
                                allMessages={messages}
                                modelTiers={modelTiers || {}}
                                onRetry={onRetry}
                                onEditMessage={onEdit}
                            />
                        </div>
                    ))
                )}
                <div ref={endRef} />
            </div>

            {/* Input */}
            <div style={{ flexShrink: 0, padding: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                <InputArea
                    input={chatInput}
                    setInput={setChatInput}
                    onSendMessage={(text, attachments) => {
                        onSend(text, attachments);
                        setChatInput('');
                    }}
                    isLoading={isLoading}
                    onStopGenerating={onStop}
                    directMode={true}
                    modelTiers={modelTiers}
                    selectedTier={selectedTier}
                    onTierChange={onTierChange}
                    placeholder="Ask about your spreadsheet..."
                    compact={true}
                />
            </div>
        </div>
    );
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
