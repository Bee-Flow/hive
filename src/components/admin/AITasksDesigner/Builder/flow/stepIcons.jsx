/**
 * Curated Lucide icon set + picker for labelling steps.
 *
 * Two consumers share this:
 *   - per-node icons in the flow builder (a custom symbol on any step card,
 *     stored as `step.icon`), and
 *   - the reusable Step entity's own symbol (stored on the row, shown in the
 *     Steps list / palette / call_block node).
 *
 * Icons are referenced by their Lucide PascalCase name (a plain string), so
 * the value round-trips through JSON/Postgres untouched. We import a curated
 * subset by name — importing lucide's full 1600-icon map would defeat Vite's
 * tree-shaking and bloat the bundle. Names are listed explicitly (not derived
 * from `Component.name`, which a production build minifies away).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { inputClass } from './settings/formStyles';
import AnchoredMenu from '../../../../shared/AnchoredMenu';
import {
    Mail, MessageSquare, MessagesSquare, Send, Bell, Phone, AtSign,
    FileText, File, Files, Folder, FolderOpen, Paperclip, Clipboard, ClipboardList,
    Book, BookOpen, Newspaper, Image, Mic, Video, Camera,
    Database, Table, Server, HardDrive, Box, Boxes, Package, Archive,
    Zap, Play, Repeat, RefreshCw, GitBranch, Filter, Workflow, Shuffle, ArrowRightLeft,
    Clock, Calendar, CalendarClock, Timer, AlarmClock,
    User, Users, UserPlus, Contact, Building2, Briefcase,
    Globe, Cloud, Link, Rss, Webhook, Wifi,
    Bot, Sparkles, Brain, Cpu, Wand2,
    Check, CheckCircle, Flag, Star, Heart, Bookmark, Tag, Tags, ShieldCheck, Lock, Key,
    AlertTriangle, Info, Eye, Search, Settings, Wrench, Code, Terminal, Hash,
    ListChecks, Pencil, Download, Upload, Target, Rocket, Lightbulb, Gift,
    DollarSign, CreditCard, ShoppingCart, Receipt, TrendingUp, BarChart3, PieChart,
    MapPin, Map, Home, Truck, Coffee, Printer, Calculator, Activity,
    Smile,
} from 'lucide-react';

// [name, component] pairs — order here = order in the picker grid.
const ICON_DEFS = [
    ['Mail', Mail], ['MessageSquare', MessageSquare], ['MessagesSquare', MessagesSquare], ['Send', Send], ['Bell', Bell], ['Phone', Phone], ['AtSign', AtSign],
    ['FileText', FileText], ['File', File], ['Files', Files], ['Folder', Folder], ['FolderOpen', FolderOpen], ['Paperclip', Paperclip], ['Clipboard', Clipboard], ['ClipboardList', ClipboardList],
    ['Book', Book], ['BookOpen', BookOpen], ['Newspaper', Newspaper], ['Image', Image], ['Mic', Mic], ['Video', Video], ['Camera', Camera],
    ['Database', Database], ['Table', Table], ['Server', Server], ['HardDrive', HardDrive], ['Box', Box], ['Boxes', Boxes], ['Package', Package], ['Archive', Archive],
    ['Zap', Zap], ['Play', Play], ['Repeat', Repeat], ['RefreshCw', RefreshCw], ['GitBranch', GitBranch], ['Filter', Filter], ['Workflow', Workflow], ['Shuffle', Shuffle], ['ArrowRightLeft', ArrowRightLeft],
    ['Clock', Clock], ['Calendar', Calendar], ['CalendarClock', CalendarClock], ['Timer', Timer], ['AlarmClock', AlarmClock],
    ['User', User], ['Users', Users], ['UserPlus', UserPlus], ['Contact', Contact], ['Building2', Building2], ['Briefcase', Briefcase],
    ['Globe', Globe], ['Cloud', Cloud], ['Link', Link], ['Rss', Rss], ['Webhook', Webhook], ['Wifi', Wifi],
    ['Bot', Bot], ['Sparkles', Sparkles], ['Brain', Brain], ['Cpu', Cpu], ['Wand2', Wand2],
    ['Check', Check], ['CheckCircle', CheckCircle], ['Flag', Flag], ['Star', Star], ['Heart', Heart], ['Bookmark', Bookmark], ['Tag', Tag], ['Tags', Tags], ['ShieldCheck', ShieldCheck], ['Lock', Lock], ['Key', Key],
    ['AlertTriangle', AlertTriangle], ['Info', Info], ['Eye', Eye], ['Search', Search], ['Settings', Settings], ['Wrench', Wrench], ['Code', Code], ['Terminal', Terminal], ['Hash', Hash],
    ['ListChecks', ListChecks], ['Pencil', Pencil], ['Download', Download], ['Upload', Upload], ['Target', Target], ['Rocket', Rocket], ['Lightbulb', Lightbulb], ['Gift', Gift],
    ['DollarSign', DollarSign], ['CreditCard', CreditCard], ['ShoppingCart', ShoppingCart], ['Receipt', Receipt], ['TrendingUp', TrendingUp], ['BarChart3', BarChart3], ['PieChart', PieChart],
    ['MapPin', MapPin], ['Map', Map], ['Home', Home], ['Truck', Truck], ['Coffee', Coffee], ['Printer', Printer], ['Calculator', Calculator], ['Activity', Activity],
];

// name → component, and the ordered list for the grid.
export const STEP_ICON_MAP = Object.fromEntries(ICON_DEFS);
export const STEP_ICON_NAMES = ICON_DEFS.map(([name]) => name);

/** Render a Lucide icon by its name. Returns `fallback` for empty/unknown. */
export function StepIcon({ name, size = 16, className = '', fallback = null }) {
    const Cmp = name ? STEP_ICON_MAP[name] : null;
    if (!Cmp) return fallback;
    return <Cmp size={size} className={className} />;
}

/** True when `name` resolves to a known icon. */
export function isStepIcon(name) {
    return !!(name && STEP_ICON_MAP[name]);
}

/**
 * Compact icon picker: a trigger button showing the current symbol, and a
 * popover grid (with search + a "Default" reset). Controlled via value/onChange
 * where value is an icon name (or '' for none). Self-manages open state and
 * click-outside.
 */
export function IconPicker({
    value = '',
    onChange,
    size = 16,
    title = 'Choose a symbol',
    placeholder = null,        // node shown on the trigger when no icon is set
    buttonClassName = '',
    align = 'left',            // 'left' | 'right'
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef(null);
    const close = useCallback(() => setOpen(false), []);

    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return STEP_ICON_NAMES;
        return STEP_ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
    }, [query]);

    const pick = (name) => { onChange?.(name); setOpen(false); setQuery(''); };

    return (
        <div className="relative inline-flex" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                title={title}
                className={buttonClassName || 'w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-tertiary)] transition'}
            >
                {value ? <StepIcon name={value} size={size} /> : (placeholder || <Smile size={size} className="opacity-50" />)}
            </button>
            <AnchoredMenu
                open={open}
                onClose={close}
                anchorRef={ref}
                align={align}
                width={256}
                role="dialog"
                className="rounded-xl !bg-[var(--bg-card,var(--bg-secondary))] shadow-xl"
            >
                <div className="p-2 border-b border-[var(--border-default)] sticky top-0 bg-[var(--bg-card,var(--bg-secondary))] z-10">
                    <input
                        autoFocus
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search symbols…"
                        className={inputClass()}
                    />
                </div>
                <div className="p-2 grid grid-cols-7 gap-1">
                    {results.map((name) => (
                        <button
                            key={name}
                            type="button"
                            onClick={() => pick(name)}
                            title={name}
                            className={`h-8 w-8 rounded-lg flex items-center justify-center transition ${
                                value === name
                                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-[var(--accent)]/40'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                            }`}
                        >
                            <StepIcon name={name} size={16} />
                        </button>
                    ))}
                    {results.length === 0 && (
                        <div className="col-span-7 text-center text-xs text-[var(--text-tertiary)] py-4">No matches</div>
                    )}
                </div>
                <div className="p-2 border-t border-[var(--border-default)]">
                    <button
                        type="button"
                        onClick={() => pick('')}
                        disabled={!value}
                        className="w-full px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40 transition"
                    >
                        Default (no symbol)
                    </button>
                </div>
            </AnchoredMenu>
        </div>
    );
}
