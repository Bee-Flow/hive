/**
 * iconCatalogue.js — curated Lucide icon names for the CMS IconPicker.
 *
 * ~140 hand-picked names (PascalCase, exactly as exported by lucide-react)
 * grouped by category. This is a CURATED subset — the picker's footer keeps
 * a free-text input for any other Lucide name, so completeness is not a
 * goal; recognizability is. Every name here is verified to exist in the
 * installed lucide-react build.
 */

export const ICON_CATALOGUE = [
    {
        category: 'Arrows',
        icons: [
            'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowUpRight',
            'ChevronRight', 'ChevronDown', 'RefreshCw', 'TrendingUp',
            'TrendingDown', 'ExternalLink',
        ],
    },
    {
        category: 'Communication',
        icons: [
            'Mail', 'Send', 'MessageSquare', 'MessageCircle', 'MessagesSquare',
            'Phone', 'AtSign', 'Bell', 'Megaphone', 'Share2', 'Languages',
        ],
    },
    {
        category: 'Security',
        icons: [
            'Shield', 'ShieldCheck', 'ShieldAlert', 'Lock', 'Unlock', 'Key',
            'KeyRound', 'Fingerprint', 'Eye', 'EyeOff', 'ScanFace',
            'BadgeCheck', 'AlertTriangle', 'CheckCircle2', 'XCircle',
        ],
    },
    {
        category: 'Data & files',
        icons: [
            'File', 'FileText', 'FileCode', 'Folder', 'FolderOpen',
            'Archive', 'Database', 'HardDrive', 'Upload', 'Download',
            'ClipboardCheck', 'BarChart3', 'LineChart', 'PieChart',
            'Activity', 'Layers', 'Search',
        ],
    },
    {
        category: 'Commerce',
        icons: [
            'ShoppingCart', 'CreditCard', 'Wallet', 'Banknote', 'Coins',
            'Euro', 'DollarSign', 'Receipt', 'Tag', 'Percent', 'Gift',
            'Package', 'Store',
        ],
    },
    {
        category: 'People',
        icons: [
            'User', 'Users', 'UserPlus', 'UserCheck', 'Smile', 'Heart',
            'HeartHandshake', 'Handshake', 'ThumbsUp', 'Award', 'Trophy',
            'GraduationCap', 'Briefcase', 'Building2',
        ],
    },
    {
        category: 'Tech & code',
        icons: [
            'Code', 'Terminal', 'Cpu', 'Server', 'Cloud', 'Globe', 'Wifi',
            'Laptop', 'Monitor', 'Smartphone', 'Settings', 'Wrench', 'Plug',
            'Zap', 'Bot', 'Brain', 'BrainCircuit', 'Sparkles', 'Rocket',
            'Puzzle', 'GitBranch', 'Link', 'Workflow', 'Network', 'Blocks',
        ],
    },
    {
        category: 'Time',
        icons: [
            'Clock', 'Timer', 'AlarmClock', 'Calendar', 'CalendarCheck',
            'Hourglass', 'History',
        ],
    },
    {
        category: 'Nature',
        icons: [
            'Sun', 'Moon', 'Star', 'Snowflake', 'Leaf', 'Sprout', 'TreePine',
            'Mountain', 'Waves', 'Droplet', 'Flame', 'Wind', 'Hexagon',
        ],
    },
    {
        category: 'Misc',
        icons: [
            'Home', 'MapPin', 'Compass', 'Flag', 'Bookmark', 'BookOpen',
            'Lightbulb', 'Palette', 'Pencil', 'Camera', 'Image', 'Video',
            'Mic', 'Headphones', 'Play', 'Target', 'Coffee', 'Plane',
            'Infinity', 'Check', 'Info', 'HelpCircle', 'LayoutGrid',
            'LayoutDashboard', 'SlidersHorizontal', 'LifeBuoy',
        ],
    },
];

// Flat list — handy for validation and "does this name exist" checks.
export const ALL_CATALOGUE_ICONS = ICON_CATALOGUE.flatMap(g => g.icons);
