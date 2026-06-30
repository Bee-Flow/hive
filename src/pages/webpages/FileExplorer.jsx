import React, { useState, useMemo, useRef } from 'react';
import {
    ChevronDown, Code, Palette, Cpu, FileText, Folder, FolderOpen, Image as ImageIcon, FileType, Braces,
    FilePlus, FolderPlus, Upload, Pencil, Trash2, Copy, Check,
} from 'lucide-react';

/**
 * File explorer tree view for the Webpages IDE.
 *
 * Renders three primary slots (index.html / style.css / script.js) plus any
 * extra files in a real folder tree built from their paths. Beyond navigation
 * it now supports manual file/folder management for the owner:
 *   - New file / New folder (header toolbar, or "here" on a folder row)
 *   - Rename / Delete (per extra file)
 *   - Upload image/asset (header button + drag-and-drop anywhere on the tree)
 *   - Copy path (per extra file) so the user can paste it into chat
 *
 * Folders are implicit (path prefixes). "New folder" creates a client-only
 * pending folder that materialises once a file is created inside it; empty
 * pending folders are not persisted.
 *
 * Clicking a file fires `onFileSelect(file)` where `file` is either:
 *   - 'html' | 'css' | 'js'  (primary slot — opens the Monaco editor)
 *   - { path, isText, mimeType, size }  (extra)
 */

const PRIMARIES = [
    { id: 'html', label: 'index.html', Icon: Code },
    { id: 'css',  label: 'style.css',  Icon: Palette },
    { id: 'js',   label: 'script.js',  Icon: Cpu },
];

const RESERVED = new Set(['index.html', 'style.css', 'script.js']);

function pickIconForPath(path) {
    const ext = (path.split('.').pop() || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) return ImageIcon;
    if (['html', 'htm'].includes(ext)) return Code;
    if (['css', 'scss', 'less'].includes(ext)) return Palette;
    if (['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx'].includes(ext)) return Cpu;
    if (['json'].includes(ext)) return Braces;
    if (['ttf', 'woff', 'woff2', 'otf'].includes(ext)) return FileType;
    return FileText;
}

/**
 * Client-side mirror of the server's validateExtraPath so bad names fail fast
 * with a clear inline message instead of a round-trip error.
 */
function validatePath(path) {
    if (!path || !path.trim()) return 'Name is required';
    if (path.length > 240) return 'Path is too long';
    if (path.startsWith('/') || path.startsWith('\\')) return 'No leading slash';
    if (path.includes('..')) return 'No ".." segments';
    const segs = path.split('/').filter(Boolean);
    if (segs.length === 0) return 'Name is required';
    for (const s of segs) {
        if (s === '.' || s === '..') return `Invalid segment "${s}"`;
        if (!/^[A-Za-z0-9_.\- @]+$/.test(s)) return `Unsupported characters in "${s}"`;
    }
    if (RESERVED.has(path)) return `"${path}" is a primary slot`;
    return null;
}

/**
 * Build a nested folder tree from a flat list of {path, ...meta} entries plus
 * any client-only pending (empty) folder paths. Folders sort first, then files.
 */
function buildTree(entries, pendingFolders) {
    const root = { type: 'folder', name: '', path: '', children: [] };
    const folderIndex = new Map();
    folderIndex.set('', root);

    const ensureFolder = (acc, name, parent) => {
        let folder = folderIndex.get(acc);
        if (!folder) {
            folder = { type: 'folder', name, path: acc, children: [] };
            parent.children.push(folder);
            folderIndex.set(acc, folder);
        }
        return folder;
    };

    for (const entry of entries) {
        const segs = entry.path.split('/').filter(Boolean);
        let parent = root;
        let acc = '';
        for (let i = 0; i < segs.length - 1; i++) {
            acc = acc ? `${acc}/${segs[i]}` : segs[i];
            parent = ensureFolder(acc, segs[i], parent);
        }
        parent.children.push({ type: 'file', name: segs[segs.length - 1], path: entry.path, meta: entry });
    }

    // Materialise pending (empty) folders so the user can target them.
    for (const fp of pendingFolders) {
        const segs = fp.split('/').filter(Boolean);
        let parent = root;
        let acc = '';
        for (let i = 0; i < segs.length; i++) {
            acc = acc ? `${acc}/${segs[i]}` : segs[i];
            parent = ensureFolder(acc, segs[i], parent);
        }
    }

    const sortChildren = (node) => {
        node.children.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        for (const c of node.children) if (c.type === 'folder') sortChildren(c);
    };
    sortChildren(root);
    return root.children;
}

/** Inline text input used for new-file / new-folder / rename. */
function InlineInput({ depth, initial = '', placeholder, onCommit, onCancel }) {
    const [value, setValue] = useState(initial);
    const error = value.trim() ? validatePath(value.trim()) : null;
    const submit = () => {
        const v = value.trim();
        if (!v || error) return;
        onCommit(v);
    };
    return (
        <div className="flex items-center gap-1 py-0.5" style={{ paddingLeft: 4 + depth * 10 }}>
            <span style={{ width: 12 }} />
            <input
                autoFocus
                value={value}
                placeholder={placeholder}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                    else if (e.key === 'Escape') onCancel();
                }}
                onBlur={() => { if (value.trim() && !error) submit(); else onCancel(); }}
                className="flex-1 text-[12px] px-1 py-0.5 rounded outline-none"
                style={{ background: 'var(--vsc-editor-bg)', color: 'var(--vsc-fg)', border: `1px solid ${error ? '#dc2626' : 'var(--vsc-accent)'}` }}
            />
            {error && <span className="text-[10px] pr-1" style={{ color: '#dc2626' }} title={error}>!</span>}
        </div>
    );
}

function ActionIcon({ Icon, title, onClick }) {
    return (
        <button
            type="button"
            title={title}
            onClick={(e) => { e.stopPropagation(); onClick(e); }}
            className="p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ color: 'var(--vsc-fg-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--vsc-fg)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--vsc-fg-muted)')}
        >
            <Icon size={12} />
        </button>
    );
}

function FolderNode({ node, depth, expanded, toggle, activePath, onFileSelect, actions, creating, renderCreate }) {
    const isOpen = expanded.has(node.path);
    const Icon = isOpen ? FolderOpen : Folder;
    return (
        <>
            <div
                role="button"
                onClick={() => toggle(node.path)}
                className="group flex items-center gap-1 py-0.5 w-full text-left text-[12px] hover:bg-[var(--vsc-hover-bg)] transition-colors cursor-pointer"
                style={{ paddingLeft: 4 + depth * 10, color: 'var(--vsc-fg)' }}
            >
                <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                <Icon size={12} style={{ color: 'var(--vsc-fg-muted)' }} />
                <span className="flex-1 truncate">{node.name}</span>
                {actions && (
                    <span className="flex items-center pr-1">
                        <ActionIcon Icon={FilePlus} title="New file here" onClick={() => actions.onNewFile(node.path)} />
                        <ActionIcon Icon={Upload} title="Upload here" onClick={() => actions.onUpload(node.path)} />
                    </span>
                )}
            </div>
            {isOpen && creating && creating.parent === node.path && renderCreate(depth + 1)}
            {isOpen && node.children.map(child => (
                child.type === 'folder' ? (
                    <FolderNode key={child.path} node={child} depth={depth + 1} expanded={expanded} toggle={toggle}
                        activePath={activePath} onFileSelect={onFileSelect} actions={actions} creating={creating} renderCreate={renderCreate} />
                ) : (
                    <FileNode key={child.path} node={child} depth={depth + 1} activePath={activePath} onFileSelect={onFileSelect} actions={actions} />
                )
            ))}
        </>
    );
}

function FileNode({ node, depth, activePath, onFileSelect, actions }) {
    const Icon = pickIconForPath(node.path);
    const isActive = activePath === `extra:${node.path}`;
    return (
        <div
            role="button"
            onClick={() => onFileSelect({ ...node.meta, path: node.path })}
            className="group flex items-center gap-1.5 py-0.5 w-full text-left text-[12px] transition-colors cursor-pointer"
            style={{
                paddingLeft: 4 + depth * 10,
                background: isActive ? 'var(--vsc-file-active-bg)' : 'transparent',
                color: isActive ? 'var(--vsc-fg)' : 'var(--vsc-fg-muted)',
            }}
        >
            <span style={{ width: 12 }} />
            <Icon size={12} />
            <span className="flex-1 truncate">{node.name}</span>
            {actions && (
                <span className="flex items-center pr-1">
                    <ActionIcon Icon={Copy} title="Copy path" onClick={() => actions.onCopyPath(node.path)} />
                    <ActionIcon Icon={Pencil} title="Rename" onClick={() => actions.onRename(node.path)} />
                    <ActionIcon Icon={Trash2} title="Delete" onClick={() => actions.onDelete(node.path)} />
                </span>
            )}
        </div>
    );
}

export default function FileExplorer({
    activeFile,
    onFileSelect,
    dirtyFiles = {},
    extraFiles = [],
    framework = 'vanilla',
    onCreateFile,     // (path) => Promise|void
    onRename,         // (oldPath, newPath) => Promise|void
    onDelete,         // (path) => Promise|void
    onUploadAsset,    // (file, folder) => Promise|void
    readOnly = false,
}) {
    // react-mui projects keep their app in real src/*.jsx files; the three
    // primary slots (index.html generated, style.css/script.js unused) are
    // hidden so they don't duplicate the real src/ folder in the tree.
    const isReact = framework === 'react-mui';
    const [expanded, setExpanded] = useState(() => new Set());
    const [pendingFolders, setPendingFolders] = useState(() => new Set());
    const [creating, setCreating] = useState(null); // { kind:'file'|'folder', parent }
    const [renaming, setRenaming] = useState(null);  // path being renamed
    const [toast, setToast] = useState(null);
    const fileInputRef = useRef(null);
    const uploadTargetRef = useRef('assets');
    const [isDragOver, setIsDragOver] = useState(false);

    const interactive = !readOnly && (onCreateFile || onUploadAsset);

    const toggle = (path) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path); else next.add(path);
            return next;
        });
    };

    const tree = useMemo(() => buildTree(extraFiles, pendingFolders), [extraFiles, pendingFolders]);
    const existingPaths = useMemo(() => new Set(extraFiles.map(f => f.path)), [extraFiles]);

    const activePath = activeFile && typeof activeFile === 'object'
        ? (activeFile.path ? `extra:${activeFile.path}` : null)
        : (typeof activeFile === 'string' ? activeFile : null);

    const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 1500); };

    const startCreate = (kind, parent = '') => {
        if (parent) setExpanded(prev => new Set(prev).add(parent));
        setRenaming(null);
        setCreating({ kind, parent });
    };

    const commitCreate = (name) => {
        const parent = creating.parent;
        const path = parent ? `${parent}/${name}` : name;
        if (creating.kind === 'folder') {
            setPendingFolders(prev => new Set(prev).add(path));
            setExpanded(prev => new Set(prev).add(path));
        } else {
            if (existingPaths.has(path)) { flash('That file already exists'); setCreating(null); return; }
            onCreateFile?.(path);
        }
        setCreating(null);
    };

    const commitRename = (oldPath, name) => {
        // The rename input edits only the final segment by default; keep the parent dir.
        const parent = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : '';
        const newPath = name.includes('/') ? name : (parent ? `${parent}/${name}` : name);
        setRenaming(null);
        if (newPath === oldPath) return;
        if (existingPaths.has(newPath)) { flash('A file with that name already exists'); return; }
        onRename?.(oldPath, newPath);
    };

    const copyPath = async (path) => {
        try { await navigator.clipboard.writeText(path); flash(`Copied ${path}`); }
        catch { flash('Copy failed'); }
    };

    const triggerUpload = (folder = 'assets') => {
        uploadTargetRef.current = folder;
        fileInputRef.current?.click();
    };

    const onFilePicked = (e) => {
        const files = Array.from(e.target.files || []);
        const folder = uploadTargetRef.current || 'assets';
        files.forEach(f => onUploadAsset?.(f, folder));
        e.target.value = '';
    };

    const onDrop = (e) => {
        if (!interactive || !onUploadAsset) return;
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer?.files || []);
        files.forEach(f => onUploadAsset(f, 'assets'));
    };

    const actions = interactive ? {
        onNewFile: (parent) => startCreate('file', parent),
        onUpload: (folder) => triggerUpload(folder),
        onRename: (path) => { setCreating(null); setRenaming(path); },
        onDelete: (path) => { if (window.confirm(`Delete ${path}?`)) onDelete?.(path); },
        onCopyPath: copyPath,
    } : null;

    const renderCreate = (depth) => (
        <InlineInput
            depth={depth}
            placeholder={creating.kind === 'folder' ? 'folder name' : 'file name (e.g. App.jsx)'}
            onCommit={commitCreate}
            onCancel={() => setCreating(null)}
        />
    );

    return (
        <div
            className="flex flex-col h-full select-none overflow-y-auto relative"
            style={{ background: 'var(--vsc-sidebar-bg)', color: 'var(--vsc-fg)' }}
            onDragOver={(e) => { if (interactive && onUploadAsset) { e.preventDefault(); setIsDragOver(true); } }}
            onDragLeave={(e) => { if (e.currentTarget === e.target) setIsDragOver(false); }}
            onDrop={onDrop}
        >
            <input ref={fileInputRef} type="file" multiple accept="image/*,.svg,.woff,.woff2,.ttf,.otf,.ico,.mp3,.mp4,.webm" style={{ display: 'none' }} onChange={onFilePicked} />

            {/* Explorer header + toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--vsc-fg-muted)', letterSpacing: '0.1em' }}>Explorer</span>
                {interactive && (
                    <span className="flex items-center gap-0.5">
                        <ActionIconStatic Icon={FilePlus} title="New file" onClick={() => startCreate('file', '')} />
                        <ActionIconStatic Icon={FolderPlus} title="New folder" onClick={() => startCreate('folder', '')} />
                        <ActionIconStatic Icon={Upload} title="Upload image / asset" onClick={() => triggerUpload('assets')} />
                    </span>
                )}
            </div>

            {/* Primary slots — shown as top-level entries for VANILLA projects
                (they are the project). Hidden for react-mui, where the app lives
                in real src/*.jsx files (avoids the confusing duplicate "src"). */}
            {!isReact && PRIMARIES.map(({ id, label, Icon }) => {
                const isActive = id === activePath;
                const isDirty = !!dirtyFiles[id];
                return (
                    <div
                        key={id}
                        role="button"
                        onClick={() => onFileSelect(id)}
                        className="flex items-center gap-1.5 py-0.5 w-full text-left text-[12px] transition-colors cursor-pointer"
                        style={{
                            paddingLeft: 8,
                            background: isActive ? 'var(--vsc-file-active-bg)' : 'transparent',
                            color: isActive ? 'var(--vsc-fg)' : 'var(--vsc-fg-muted)',
                        }}
                    >
                        <Icon size={13} />
                        <span className="flex-1 truncate">{label}</span>
                        {isDirty && <span title="Unsaved changes" className="w-2 h-2 rounded-full shrink-0 mr-1" style={{ background: 'var(--vsc-fg-muted)' }} />}
                    </div>
                );
            })}

            {/* Root-level new file/folder input */}
            {creating && creating.parent === '' && renderCreate(0)}

            {/* Extra files: folder tree */}
            <div className="mt-1">
                {tree.map(node => (
                    node.type === 'folder' ? (
                        <FolderNode key={node.path} node={node} depth={0} expanded={expanded} toggle={toggle}
                            activePath={activePath} onFileSelect={onFileSelect} actions={actions} creating={creating} renderCreate={renderCreate} />
                    ) : (
                        renaming === node.path ? (
                            <InlineInput key={node.path} depth={0} initial={node.name}
                                onCommit={(name) => commitRename(node.path, name)} onCancel={() => setRenaming(null)} />
                        ) : (
                            <FileNode key={node.path} node={node} depth={0} activePath={activePath} onFileSelect={onFileSelect} actions={actions} />
                        )
                    )
                ))}
            </div>

            {tree.length === 0 && !creating && interactive && (
                <div className="px-3 py-3 text-[11px]" style={{ color: 'var(--vsc-fg-muted)', opacity: 0.7 }}>
                    No extra files yet. Use the buttons above to add a file, folder, or image — or just ask the AI.
                </div>
            )}

            {/* Drag-over overlay */}
            {isDragOver && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
                     style={{ background: 'color-mix(in srgb, var(--vsc-accent) 12%, transparent)', border: '2px dashed var(--vsc-accent)' }}>
                    <span className="text-[12px] font-medium" style={{ color: 'var(--vsc-accent)' }}>Drop images to upload</span>
                </div>
            )}

            {/* Copy/rename toast */}
            {toast && (
                <div className="absolute bottom-2 left-2 right-2 px-2 py-1 rounded text-[11px] flex items-center gap-1"
                     style={{ background: 'var(--vsc-editor-bg)', color: 'var(--vsc-fg)', border: '1px solid var(--vsc-border)' }}>
                    <Check size={11} style={{ color: 'var(--vsc-accent)' }} /> {toast}
                </div>
            )}
        </div>
    );
}

/** Header toolbar icon button (always visible, unlike the hover ActionIcon). */
function ActionIconStatic({ Icon, title, onClick }) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--vsc-fg-muted)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--vsc-fg)'; e.currentTarget.style.background = 'var(--vsc-hover-bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--vsc-fg-muted)'; e.currentTarget.style.background = 'transparent'; }}
        >
            <Icon size={13} />
        </button>
    );
}
