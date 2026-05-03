import React, { useState, useMemo } from 'react';
import { ChevronDown, Code, Palette, Cpu, FileText, Folder, FolderOpen, Image as ImageIcon, FileType, Braces, Database } from 'lucide-react';

/**
 * File explorer tree view for the Webpages IDE.
 *
 * Renders three primary slots (index.html / style.css / script.js) plus
 * any extra files in a real folder tree built from their paths. Clicking
 * a file fires `onFileSelect(file)` where `file` is either:
 *   - 'html' | 'css' | 'js'  (primary slot — opens the Monaco editor)
 *   - { path: 'components/header.html', isText, mimeType, size }  (extra)
 *
 * Folders default to collapsed; the root `src` group is collapsed too so
 * the surface stays minimal until the user wants to dig in.
 */

const PRIMARIES = [
    { id: 'html', label: 'index.html', Icon: Code },
    { id: 'css',  label: 'style.css',  Icon: Palette },
    { id: 'js',   label: 'script.js',  Icon: Cpu },
];

function pickIconForPath(path) {
    const ext = (path.split('.').pop() || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) return ImageIcon;
    if (['html', 'htm'].includes(ext)) return Code;
    if (['css'].includes(ext)) return Palette;
    if (['js', 'mjs', 'json'].includes(ext)) return ext === 'json' ? Braces : Cpu;
    if (['ttf', 'woff', 'woff2', 'otf'].includes(ext)) return FileType;
    return FileText;
}

/**
 * Build a nested folder tree from a flat list of {path, ...meta} entries.
 * Folders sort first, then files; everything alphabetical within a level.
 * Returns nodes shaped as:
 *   { type: 'folder', name, path, children: [...] }
 *   { type: 'file',   name, path, meta }
 */
function buildTree(entries) {
    const root = { type: 'folder', name: '', path: '', children: [] };
    const folderIndex = new Map(); // full-folder-path → folder node
    folderIndex.set('', root);

    for (const entry of entries) {
        const segs = entry.path.split('/').filter(Boolean);
        let parent = root;
        let acc = '';
        for (let i = 0; i < segs.length - 1; i++) {
            acc = acc ? `${acc}/${segs[i]}` : segs[i];
            let folder = folderIndex.get(acc);
            if (!folder) {
                folder = { type: 'folder', name: segs[i], path: acc, children: [] };
                parent.children.push(folder);
                folderIndex.set(acc, folder);
            }
            parent = folder;
        }
        parent.children.push({
            type: 'file',
            name: segs[segs.length - 1],
            path: entry.path,
            meta: entry,
        });
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

function FolderNode({ node, depth, expanded, toggle, activePath, onFileSelect }) {
    const isOpen = expanded.has(node.path);
    const Icon = isOpen ? FolderOpen : Folder;
    return (
        <>
            <button
                onClick={() => toggle(node.path)}
                className="flex items-center gap-1 py-0.5 w-full text-left text-[12px] hover:bg-[var(--vsc-hover-bg)] transition-colors"
                style={{ paddingLeft: 4 + depth * 10, color: 'var(--vsc-fg)' }}
            >
                <ChevronDown
                    size={12}
                    style={{ transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
                />
                <Icon size={12} style={{ color: 'var(--vsc-fg-muted)' }} />
                <span className="truncate">{node.name}</span>
            </button>
            {isOpen && node.children.map(child => (
                child.type === 'folder' ? (
                    <FolderNode
                        key={child.path}
                        node={child}
                        depth={depth + 1}
                        expanded={expanded}
                        toggle={toggle}
                        activePath={activePath}
                        onFileSelect={onFileSelect}
                    />
                ) : (
                    <FileNode
                        key={child.path}
                        node={child}
                        depth={depth + 1}
                        activePath={activePath}
                        onFileSelect={onFileSelect}
                    />
                )
            ))}
        </>
    );
}

function FileNode({ node, depth, activePath, onFileSelect }) {
    const Icon = pickIconForPath(node.path);
    const isActive = activePath === `extra:${node.path}`;
    return (
        <button
            onClick={() => onFileSelect({ ...node.meta, path: node.path })}
            className="flex items-center gap-1.5 py-0.5 w-full text-left text-[12px] transition-colors"
            style={{
                paddingLeft: 4 + depth * 10,
                background: isActive ? 'var(--vsc-file-active-bg)' : 'transparent',
                color: isActive ? 'var(--vsc-fg)' : 'var(--vsc-fg-muted)',
            }}
        >
            <span style={{ width: 12 }} />
            <Icon size={12} />
            <span className="flex-1 truncate">{node.name}</span>
        </button>
    );
}

function formatBytes(n) {
    if (!n || n < 1024) return `${n || 0} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileExplorer({
    activeFile,         // 'html' | 'css' | 'js' | { path, ... } | null
    onFileSelect,
    dirtyFiles = {},
    extraFiles = [],
    dbSize = 0,         // bytes; render data.db row only when > 0
}) {
    // Track expanded folders by their path. The pseudo-root "src" lives at
    // path = '__src__' since the primary slots aren't really nested in a
    // folder; the extras get rendered under their actual paths.
    const [expanded, setExpanded] = useState(() => new Set());

    const toggle = (path) => {
        setExpanded(prev => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path); else next.add(path);
            return next;
        });
    };

    const tree = useMemo(() => buildTree(extraFiles), [extraFiles]);

    const srcOpen = expanded.has('__src__');
    const activePath = activeFile && typeof activeFile === 'object' && activeFile.path
        ? `extra:${activeFile.path}`
        : (typeof activeFile === 'string' ? activeFile : null);

    return (
        <div className="flex flex-col h-full select-none overflow-y-auto" style={{ background: 'var(--vsc-sidebar-bg)', color: 'var(--vsc-fg)' }}>
            {/* Explorer header */}
            <div
                className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase"
                style={{ color: 'var(--vsc-fg-muted)', letterSpacing: '0.1em' }}
            >
                Explorer
            </div>

            {/* src — collapsible group containing the primary slots */}
            <button
                onClick={() => toggle('__src__')}
                className="flex items-center gap-1 px-2 py-0.5 text-[12px] w-full text-left hover:bg-[var(--vsc-hover-bg)] transition-colors"
                style={{ color: 'var(--vsc-fg)' }}
            >
                <ChevronDown
                    size={12}
                    style={{ transform: srcOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
                />
                {srcOpen ? <FolderOpen size={12} style={{ color: 'var(--vsc-fg-muted)' }} /> : <Folder size={12} style={{ color: 'var(--vsc-fg-muted)' }} />}
                <span className="font-medium">src</span>
            </button>

            {srcOpen && PRIMARIES.map(({ id, label, Icon }) => {
                const isActive = id === activePath;
                const isDirty = !!dirtyFiles[id];
                return (
                    <button
                        key={id}
                        onClick={() => onFileSelect(id)}
                        className="flex items-center gap-1.5 py-0.5 w-full text-left text-[12px] transition-colors"
                        style={{
                            paddingLeft: 24,
                            background: isActive ? 'var(--vsc-file-active-bg)' : 'transparent',
                            color: isActive ? 'var(--vsc-fg)' : 'var(--vsc-fg-muted)',
                        }}
                    >
                        <Icon size={13} />
                        <span className="flex-1 truncate">{label}</span>
                        {isDirty && (
                            <span
                                title="Unsaved changes"
                                className="w-2 h-2 rounded-full shrink-0 mr-1"
                                style={{ background: 'var(--vsc-fg-muted)' }}
                            />
                        )}
                    </button>
                );
            })}

            {srcOpen && dbSize > 0 && (
                <div
                    title={`SQLite database — managed via the AI chat or window.beeflowDB inside the page (${formatBytes(dbSize)})`}
                    className="flex items-center gap-1.5 py-0.5 w-full text-left text-[12px] cursor-default"
                    style={{ paddingLeft: 24, color: 'var(--vsc-fg-muted)', opacity: 0.85 }}
                >
                    <Database size={13} />
                    <span className="flex-1 truncate">data.db</span>
                    <span className="text-[10px] mr-2 shrink-0" style={{ opacity: 0.7 }}>
                        {formatBytes(dbSize)}
                    </span>
                </div>
            )}

            {/* Extra files: folder tree */}
            {tree.length > 0 && (
                <div className="mt-1">
                    {tree.map(node => (
                        node.type === 'folder' ? (
                            <FolderNode
                                key={node.path}
                                node={node}
                                depth={0}
                                expanded={expanded}
                                toggle={toggle}
                                activePath={activePath}
                                onFileSelect={onFileSelect}
                            />
                        ) : (
                            <FileNode
                                key={node.path}
                                node={node}
                                depth={0}
                                activePath={activePath}
                                onFileSelect={onFileSelect}
                            />
                        )
                    ))}
                </div>
            )}
        </div>
    );
}
