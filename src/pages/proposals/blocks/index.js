/**
 * Block registry — maps block type strings to React components.
 * Import this to render any block by type.
 */
export { default as CoverBlock } from './CoverBlock';
export { default as SpecsBlock } from './SpecsBlock';
export { default as TextSection } from './TextSection';
export { default as PricingTable } from './PricingTable';
export { default as SignatureBlock } from './SignatureBlock';
export { default as IconSection } from './IconSection';
export { default as TimelineBlock } from './TimelineBlock';

/**
 * All available block types with metadata for the "Add Block" menu.
 */
export const BLOCK_TYPES = [
    { type: 'cover', label: 'Cover', icon: '🎨', desc: 'Donkere cover pagina' },
    { type: 'specs', label: 'Specificaties', icon: '📋', desc: 'Key-value project info' },
    { type: 'text', label: 'Tekst Sectie', icon: '📝', desc: 'Heading + paragraaf' },
    { type: 'pricing', label: 'Prijstabel', icon: '💰', desc: 'Interactieve prijstabel' },
    { type: 'icon-section', label: 'Icoon Sectie', icon: '🔧', desc: '2-koloms met icoon' },
    { type: 'timeline', label: 'Tijdlijn', icon: '📅', desc: 'Faseplan / implementatie' },
    { type: 'signature', label: 'Ondertekening', icon: '✍️', desc: 'Twee-koloms handtekening' },
];

/**
 * Creates a new empty block with defaults based on type.
 */
export function createBlock(type) {
    const id = crypto.randomUUID();
    const base = { id, type };

    switch (type) {
        case 'cover':
            return { ...base, label: 'Offerte:', title: 'Projecttitel', subtitle: 'Korte beschrijving van het project of de aanbieding.' };
        case 'specs':
            return {
                ...base, heading: 'Project specificaties',
                specs: [
                    { key: 'Opdrachtgever', value: '' },
                    { key: 'Opdrachtnemer', value: '' },
                    { key: 'Datum offerte', value: new Date().toLocaleDateString('nl-NL') },
                    { key: 'Projectduur', value: '' },
                    { key: 'Totale investering', value: '' },
                ],
            };
        case 'text':
            return { ...base, heading: 'Sectie titel', body: '', accent: false };
        case 'pricing':
            return {
                ...base, heading: 'Investering', vatRate: 21, currency: 'EUR',
                items: [{ description: '', amount: 0 }],
            };
        case 'icon-section':
            return { ...base, heading: 'Sectie titel', body: '', icon: '📋', accent: false };
        case 'signature':
            return {
                ...base, heading: 'Ondertekening',
                left: { label: '', name: '', place: '', date: '' },
                right: { label: '', name: '', place: '', date: '' },
            };
        case 'timeline':
            return {
                ...base, data: {
                    heading: 'Implementatie programma',
                    phases: [
                        {
                            icon: '📋', title: 'Fase 1 — Voorbereiding',
                            items: [{ title: 'Kick-off meeting', description: 'Afstemming doelen, scope en planning' }],
                        },
                        {
                            icon: '🔧', title: 'Fase 2 — Uitvoering',
                            items: [{ title: 'Ontwikkeling', description: 'Implementatie van de oplossing' }],
                        },
                        {
                            icon: '🚀', title: 'Fase 3 — Oplevering',
                            items: [{ title: 'Testen & overdracht', description: 'Eindtest, documentatie en go-live' }],
                        },
                    ],
                },
            };
        default:
            return { ...base, heading: 'Onbekend blok' };
    }
}
