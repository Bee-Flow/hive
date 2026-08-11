import React from 'react';

/**
 * Tiny schematic previews for the Add-block picker — one abstract SVG
 * mockup per block type (the LiveComponent LayoutPicker technique: inline
 * SVG, no screenshots, no external assets). Muted strokes with one accent
 * element so the tiles read at a glance in both themes.
 */

const MUTED = 'var(--text-muted)';
const ACCENT = 'var(--accent-primary)';
const W = 120;
const H = 64;

function Frame({ children }) {
    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" aria-hidden="true">
            <rect x="1" y="1" width={W - 2} height={H - 2} rx="4" fill="none" stroke={MUTED} strokeOpacity="0.35" />
            {children}
        </svg>
    );
}

const Line = ({ x, y, w, h = 3, o = 0.5, fill = MUTED, rx = 1.5 }) => (
    <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} fillOpacity={o} />
);
const Btn = ({ x, y, w = 24, h = 8 }) => (
    <rect x={x} y={y} width={w} height={h} rx="4" fill={ACCENT} fillOpacity="0.9" />
);
const Card = ({ x, y, w, h }) => (
    <rect x={x} y={y} width={w} height={h} rx="3" fill={MUTED} fillOpacity="0.12" stroke={MUTED} strokeOpacity="0.35" />
);

const THUMBS = {
    hero: (
        <Frame>
            <Line x={30} y={16} w={60} h={6} o={0.7} />
            <Line x={40} y={27} w={40} h={3} />
            <Line x={35} y={33} w={50} h={3} />
            <Btn x={48} y={43} />
        </Frame>
    ),
    socialProof: (
        <Frame>
            <Line x={35} y={14} w={50} h={4} o={0.6} />
            {[18, 40, 62, 84].map(x => (
                <rect key={x} x={x} y={32} width="18" height="10" rx="2" fill={MUTED} fillOpacity="0.3" />
            ))}
        </Frame>
    ),
    content: (
        <Frame>
            <Line x={12} y={12} w={44} h={4} o={0.7} />
            <Line x={12} y={22} w={40} h={3} />
            <Line x={12} y={28} w={44} h={3} />
            <Line x={12} y={34} w={36} h={3} />
            <Line x={64} y={12} w={44} h={4} o={0.7} />
            <Line x={64} y={22} w={40} h={3} />
            <Line x={64} y={28} w={44} h={3} />
            <Line x={64} y={34} w={36} h={3} />
        </Frame>
    ),
    'media-text': (
        <Frame>
            <rect x="10" y="12" width="44" height="40" rx="3" fill={MUTED} fillOpacity="0.25" />
            <circle cx="22" cy="24" r="4" fill={MUTED} fillOpacity="0.5" />
            <path d="M12 46 L28 32 L40 42 L52 30 L52 50 L12 50 Z" fill={MUTED} fillOpacity="0.35" />
            <Line x={62} y={16} w={44} h={5} o={0.7} />
            <Line x={62} y={27} w={40} h={3} />
            <Line x={62} y={33} w={44} h={3} />
            <Btn x={62} y={42} w={20} h={7} />
        </Frame>
    ),
    features: (
        <Frame>
            {[[10, 10], [63, 10], [10, 34], [63, 34]].map(([x, y]) => (
                <g key={`${x}-${y}`}>
                    <Card x={x} y={y} w={47} h={20} />
                    <circle cx={x + 8} cy={y + 10} r="3.5" fill={ACCENT} fillOpacity="0.8" />
                    <Line x={x + 15} y={y + 6} w={24} h={3} o={0.6} />
                    <Line x={x + 15} y={y + 12} w={28} h={2.5} o={0.4} />
                </g>
            ))}
        </Frame>
    ),
    steps: (
        <Frame>
            <line x1="24" y1="26" x2="96" y2="26" stroke={MUTED} strokeOpacity="0.35" strokeDasharray="3 3" />
            {[24, 60, 96].map((x, i) => (
                <g key={x}>
                    <circle cx={x} cy={26} r="8" fill={i === 0 ? ACCENT : 'none'} fillOpacity={i === 0 ? 0.9 : 1} stroke={i === 0 ? 'none' : MUTED} strokeOpacity="0.5" />
                    <Line x={x - 12} y={40} w={24} h={3} o={0.5} />
                    <Line x={x - 10} y={46} w={20} h={2.5} o={0.35} />
                </g>
            ))}
        </Frame>
    ),
    security: (
        <Frame>
            <path d="M60 8 L72 13 L72 24 C72 32 66 37 60 39 C54 37 48 32 48 24 L48 13 Z" fill={ACCENT} fillOpacity="0.75" />
            <path d="M55 24 L59 28 L66 19" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {[14, 48, 82].map(x => <Card key={x} x={x} y={44} w={26} h={12} />)}
        </Frame>
    ),
    integrations: (
        <Frame>
            {[[16, 12], [38, 12], [60, 12], [82, 12], [16, 30], [38, 30], [60, 30], [82, 30]].map(([x, y], i) => (
                <rect key={`${x}-${y}`} x={x} y={y} width="16" height="14" rx="3"
                    fill={i === 2 ? ACCENT : MUTED} fillOpacity={i === 2 ? 0.85 : 0.25} />
            ))}
            <Line x={30} y={52} w={60} h={3} o={0.4} />
        </Frame>
    ),
    architecture: (
        <Frame>
            <Card x={20} y={10} w={80} h={12} />
            <Card x={20} y={26} w={80} h={12} />
            <rect x="20" y="42" width="80" height="12" rx="3" fill={ACCENT} fillOpacity="0.6" />
            <Line x={28} y={14} w={20} h={3} o={0.55} />
            <Line x={28} y={30} w={26} h={3} o={0.55} />
        </Frame>
    ),
    techStats: (
        <Frame>
            {[24, 60, 96].map(x => (
                <g key={x}>
                    <text x={x} y="32" textAnchor="middle" fontSize="16" fontWeight="700" fill={ACCENT} fillOpacity="0.85">42</text>
                    <Line x={x - 12} y={40} w={24} h={3} o={0.45} />
                </g>
            ))}
        </Frame>
    ),
    cta: (
        <Frame>
            <Line x={26} y={18} w={68} h={6} o={0.7} />
            <Line x={36} y={29} w={48} h={3} />
            <Btn x={48} y={40} />
        </Frame>
    ),
    'cta-banner': (
        <Frame>
            <rect x="6" y="20" width="108" height="24" rx="4" fill={ACCENT} fillOpacity="0.25" />
            <Line x={14} y={28} w={48} h={5} o={0.75} />
            <Btn x={80} y={27} w={26} h={10} />
        </Frame>
    ),
    'live-component': (
        <Frame>
            <rect x="14" y="10" width="92" height="44" rx="4" fill={MUTED} fillOpacity="0.12" stroke={MUTED} strokeOpacity="0.4" />
            <circle cx="21" cy="16" r="1.8" fill={MUTED} fillOpacity="0.6" />
            <circle cx="27" cy="16" r="1.8" fill={MUTED} fillOpacity="0.6" />
            <circle cx="33" cy="16" r="1.8" fill={MUTED} fillOpacity="0.6" />
            <text x="60" y="42" textAnchor="middle" fontSize="16" fontFamily="monospace" fill={ACCENT} fillOpacity="0.85">{'</>'}</text>
        </Frame>
    ),
    pricing: (
        <Frame>
            <Card x={10} y={14} w={30} h={42} />
            <rect x="45" y="8" width="30" height="48" rx="3" fill={ACCENT} fillOpacity="0.2" stroke={ACCENT} strokeOpacity="0.7" />
            <Card x={80} y={14} w={30} h={42} />
            {[13, 48, 83].map((x, i) => (
                <g key={x}>
                    <Line x={x + 4} y={i === 1 ? 14 : 20} w={16} h={4} o={0.65} />
                    <Btn x={x + 4} y={i === 1 ? 44 : 46} w={18} h={6} />
                </g>
            ))}
        </Frame>
    ),
    'customer-support': (
        <Frame>
            <Card x={16} y={10} w={88} h={9} />
            <Card x={16} y={23} w={88} h={9} />
            <Card x={16} y={36} w={88} h={9} />
            <Btn x={80} y={49} w={24} h={8} />
        </Frame>
    ),
    testimonials: (
        <Frame>
            {[10, 45, 80].map((x, i) => (
                <g key={x}>
                    <Card x={x} y={12} w={30} h={40} />
                    <Line x={x + 5} y={18} w={20} h={2.5} o={0.5} />
                    <Line x={x + 5} y={23} w={16} h={2.5} o={0.4} />
                    <circle cx={x + 9} cy={42} r="3.5" fill={i === 0 ? ACCENT : MUTED} fillOpacity={i === 0 ? 0.85 : 0.5} />
                    <Line x={x + 15} y={40.5} w={11} h={2.5} o={0.45} />
                </g>
            ))}
        </Frame>
    ),
    faq: (
        <Frame>
            {[12, 26, 40].map((y, i) => (
                <g key={y}>
                    <line x1="14" y1={y - 4} x2="106" y2={y - 4} stroke={MUTED} strokeOpacity="0.3" />
                    <Line x={14} y={y} w={i === 0 ? 56 : 64} h={3.5} o={0.6} />
                    <path
                        d={`M100 ${y} l3 3.5 3-3.5`}
                        fill="none"
                        stroke={i === 0 ? ACCENT : MUTED}
                        strokeOpacity={i === 0 ? 0.9 : 0.5}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                    {i === 0 ? <Line x={14} y={y + 7} w={48} h={2.5} o={0.35} /> : null}
                </g>
            ))}
            <line x1="14" y1="50" x2="106" y2="50" stroke={MUTED} strokeOpacity="0.3" />
        </Frame>
    ),
    'trust-band': (
        <Frame>
            {[12, 48, 84].map((x, i) => (
                <g key={x}>
                    <rect x={x} y={26} width="24" height="12" rx="6" fill="none" stroke={MUTED} strokeOpacity="0.45" />
                    <circle cx={x + 6} cy={32} r="2.5" fill={i === 0 ? ACCENT : MUTED} fillOpacity={i === 0 ? 0.85 : 0.5} />
                    <Line x={x + 11} y={30.5} w={9} h={3} o={0.5} />
                </g>
            ))}
        </Frame>
    ),
    showcase: (
        <Frame>
            <rect x="20" y="10" width="80" height="44" rx="4" fill={MUTED} fillOpacity="0.12" stroke={MUTED} strokeOpacity="0.4" />
            <circle cx="27" cy="16" r="1.8" fill={MUTED} fillOpacity="0.6" />
            <circle cx="33" cy="16" r="1.8" fill={MUTED} fillOpacity="0.6" />
            <circle cx="39" cy="16" r="1.8" fill={MUTED} fillOpacity="0.6" />
            <line x1="20" y1="21" x2="100" y2="21" stroke={MUTED} strokeOpacity="0.35" />
            <rect x="27" y="27" width="66" height="21" rx="2" fill={ACCENT} fillOpacity="0.2" />
            <Line x={32} y={32} w={34} h={3} o={0.5} />
            <Line x={32} y={38} w={44} h={3} o={0.4} />
        </Frame>
    ),
    roadmap: (
        <Frame>
            <Line x={16} y={12} w={30} h={3} o={0.45} />
            <circle cx="19" cy="24" r="2.2" fill={ACCENT} fillOpacity="0.85" />
            <Line x={26} y={22} w={54} h={4} o={0.5} />
            <circle cx="19" cy="35" r="2.2" fill={ACCENT} fillOpacity="0.5" />
            <Line x={26} y={33} w={68} h={4} o={0.45} />
            <circle cx="19" cy="46" r="2.2" fill={MUTED} fillOpacity="0.5" />
            <Line x={26} y={44} w={46} h={4} o={0.35} />
        </Frame>
    ),
};

export default function BlockThumb({ type }) {
    return THUMBS[type] || (
        <Frame>
            <Line x={16} y={20} w={88} h={4} o={0.5} />
            <Line x={16} y={30} w={70} h={4} o={0.4} />
        </Frame>
    );
}
