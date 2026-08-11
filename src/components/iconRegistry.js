/**
 * The icons this product actually uses, as named imports.
 *
 * WHY THIS FILE EXISTS: AppIcon used to do `import * as LucideIcons` with a
 * dynamic property lookup, which defeats tree-shaking — the entire Lucide set
 * (~170 KB gzipped, most of vendor-misc) shipped on every pageview including
 * the marketing site, to render a few dozen icons. Named imports through this
 * registry let Rollup keep only the icons listed here (~15 KB), and AppIcon
 * lazy-loads the full set ONLY when it meets a name outside the registry.
 *
 * WHAT BELONGS HERE: every icon name that must render without a network
 * round trip —
 *   - the CMS seed content (server/scripts/content/beeflowSite.js `icon:`)
 *     and block defaults (server/i18n/defaults/cmsDefaults.js): these render
 *     on the public marketing site, where a pop-in is a visible defect;
 *   - literal `<AppIcon name="X">` usages across src/: app chrome that
 *     should not flash a placeholder on first paint.
 *
 * A name that is NOT here still renders — AppIcon falls back to one dynamic
 * `import('lucide-react')` shared across all instances, showing a
 * layout-reserving blank until it lands. That is the escape hatch for icon
 * names typed freely into CMS content, not a licence to let this list rot:
 * the registry guard test (AppIcon.registry.test.jsx) fails when seed or
 * literal usages reference an unlisted icon.
 *
 * Regenerate the seed/default portion with:
 *   node -e "const s=require('fs').readFileSync('server/scripts/content/beeflowSite.js','utf8');
 *     console.log([...new Set([...s.matchAll(/icon:\s*['\"]([A-Za-z0-9]+)['\"]/g)].map(m=>m[1]))].sort().join(', '))"
 */
import {
    AppWindow, ArrowRight, AudioLines, Ban, BarChart3, Bell, Blocks,
    BookOpen, Bot, Boxes, Brain, Bug, Building2, Calendar, CalendarClock,
    Check, CheckSquare, ChevronDown, ChevronRight, ClipboardCheck, Clock,
    Cloud, Code, Coins, Cookie, Copy, Cpu, CreditCard, Crosshair, Database,
    Download, ExternalLink, EyeOff, FileAudio, FileCheck, FileDown,
    FileJson, FileSearch, FileText, FileWarning, Flag, FlaskConical,
    Folder, FolderOpen, FolderSync, Gauge, Gavel, Gift, GitBranch, GitCompare, Github, Globe, Globe2,
    GripVertical, HardDrive, HelpCircle, Home, Image, Import, Kanban,
    KeyRound, Landmark, Languages, Layers, LayoutGrid, LayoutPanelLeft,
    LayoutTemplate, Library, LifeBuoy, Linkedin, ListChecks, ListOrdered,
    Lock, Mail, Map, MapPin, Megaphone, MessageCircleQuestion,
    MessageSquare, MessageSquareQuote, MessagesSquare, Mic, Milestone,
    Monitor, MonitorPlay, MoreHorizontal, MoreVertical, MousePointerClick,
    Newspaper, NotebookPen, Palette, PenLine, PenTool, Plug, Plus,
    Presentation, Puzzle, Quote, RefreshCw, Repeat, Rocket, RotateCcw,
    RotateCw, Scale, ScrollText, Search, Send, Server, ServerCog, Settings,
    Settings2, Share2, Shield, ShieldAlert, ShieldCheck, Sparkles, Square,
    Star, Stethoscope, Store, Table, Target, TerminalSquare, TestTube, Ticket, Trash2,
    Type, Upload, UserCheck, Users, Video, Wand2, WifiOff, Workflow, Wrench, X, Zap
} from 'lucide-react';

export const ICON_REGISTRY = {
    AppWindow, ArrowRight, AudioLines, Ban, BarChart3, Bell, Blocks,
    BookOpen, Bot, Boxes, Brain, Bug, Building2, Calendar, CalendarClock,
    Check, CheckSquare, ChevronDown, ChevronRight, ClipboardCheck, Clock,
    Cloud, Code, Coins, Cookie, Copy, Cpu, CreditCard, Crosshair, Database,
    Download, ExternalLink, EyeOff, FileAudio, FileCheck, FileDown,
    FileJson, FileSearch, FileText, FileWarning, Flag, FlaskConical,
    Folder, FolderOpen, FolderSync, Gauge, Gavel, Gift, GitBranch, GitCompare, Github, Globe, Globe2,
    GripVertical, HardDrive, HelpCircle, Home, Image, Import, Kanban,
    KeyRound, Landmark, Languages, Layers, LayoutGrid, LayoutPanelLeft,
    LayoutTemplate, Library, LifeBuoy, Linkedin, ListChecks, ListOrdered,
    Lock, Mail, Map, MapPin, Megaphone, MessageCircleQuestion,
    MessageSquare, MessageSquareQuote, MessagesSquare, Mic, Milestone,
    Monitor, MonitorPlay, MoreHorizontal, MoreVertical, MousePointerClick,
    Newspaper, NotebookPen, Palette, PenLine, PenTool, Plug, Plus,
    Presentation, Puzzle, Quote, RefreshCw, Repeat, Rocket, RotateCcw,
    RotateCw, Scale, ScrollText, Search, Send, Server, ServerCog, Settings,
    Settings2, Share2, Shield, ShieldAlert, ShieldCheck, Sparkles, Square,
    Star, Stethoscope, Store, Table, Target, TerminalSquare, TestTube, Ticket, Trash2,
    Type, Upload, UserCheck, Users, Video, Wand2, WifiOff, Workflow, Wrench, X, Zap,
};

// AppIcon's last resort when even the lazy full set has no such export.
export const FALLBACK_ICON = HelpCircle;
