import { Package, Building2, KeyRound, ShieldCheck, Tag, CreditCard, ScrollText } from 'lucide-react';

export const SECTIONS = [
    { id: 'plans',         label: 'Plans',  icon: Package,     accent: 'blue' },
    { id: 'organizations', label: 'Orgs',   icon: Building2,   accent: 'sky' },
    { id: 'grants',        label: 'Grants', icon: KeyRound,    accent: 'cyan' },
    { id: 'access',        label: 'Access', icon: ShieldCheck, accent: 'amber' },
    { id: 'promos',        label: 'Promos', icon: Tag,         accent: 'emerald' },
    { id: 'settings',      label: 'Stripe', icon: CreditCard,  accent: 'blue' },
    { id: 'audit',         label: 'Audit',  icon: ScrollText,  accent: 'rose' },
];

export const FEATURE_OPTIONS = [
    { id: 'chat',           label: 'Chat' },
    { id: 'agents',         label: 'Agents' },
    { id: 'knowledge_base', label: 'Knowledge Base' },
    { id: 'embed_chat',     label: 'Embed Chat' },
    { id: 'direct_chat',    label: 'Direct Chat' },
    { id: 'workspace',      label: 'Workspace' },
    { id: 'notebooks',      label: 'Notebooks' },
    { id: 'encryption',     label: 'Encryption (PIN)' },
];

export const LIMIT_FIELDS = [
    { key: 'max_cost_per_month',      label: 'Cost cap / month (€)',  type: 'currency' },
    { key: 'max_users',               label: 'Max users',             type: 'number' },
    { key: 'max_agents',              label: 'Max agents',            type: 'number' },
    { key: 'max_knowledge_sources',   label: 'Max knowledge sources', type: 'number' },
];

export const TIER_PRESETS = ['community', 'enterprise', 'full'];
export const EXPIRY_PRESETS = [
    { label: '30 days', days: 30 },
    { label: '90 days', days: 90 },
    { label: '1 year',  days: 365 },
    { label: '2 years', days: 730 },
];

export const CURRENCY_SYMBOL = { EUR: '€', USD: '$', GBP: '£' };
