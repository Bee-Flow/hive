import React, { useSyncExternalStore } from 'react';
import {
    Puzzle, Gauge, Activity, ShieldAlert, Bot, Sparkles, ListChecks, BookOpen,
    Globe, Bug, Mic, LifeBuoy, Target, LayoutGrid, Boxes, Wrench, Zap, BarChart3,
    Calendar, Mail, FileText, Users, Database, Lock, Bell, Search, Star, Clock,
    Cloud, Server, Terminal, Code, Layers, Package, MessageSquare, Workflow,
} from 'lucide-react';
import { API_BASE, authFetch } from '../utils/helpers';
import RemoteStudioApp from './RemoteStudioApp';

// Runtime Studio-app registry. After auth, `GET /api/modules/frontend` returns
// the installed remote modules that ship a frontend; each becomes a descriptor
// shaped like a static STUDIO_APPS entry so Studio/index.jsx can render the two
// lists side by side. The store is a plain module-level array behind
// useSyncExternalStore, refreshed on `beeflow:auth-changed` and broadcast on
// `beeflow:modules-changed` (App.jsx re-parses the deep-linked studio route on
// that event; studioRoutes.js consults the live map for segment ↔ section).

// Lucide name → component. ~30 common glyphs plus a Puzzle fallback so an
// unknown/absent icon never breaks the tab. Module authors pick from these.
const ICON_MAP = {
    puzzle: Puzzle, gauge: Gauge, activity: Activity, shield: ShieldAlert,
    bot: Bot, sparkles: Sparkles, list: ListChecks, book: BookOpen, globe: Globe,
    bug: Bug, mic: Mic, lifebuoy: LifeBuoy, target: Target, grid: LayoutGrid,
    boxes: Boxes, wrench: Wrench, zap: Zap, chart: BarChart3, calendar: Calendar,
    mail: Mail, file: FileText, users: Users, database: Database, lock: Lock,
    bell: Bell, search: Search, star: Star, clock: Clock, cloud: Cloud,
    server: Server, terminal: Terminal, code: Code, layers: Layers,
    package: Package, message: MessageSquare, workflow: Workflow,
};

function iconFor(name) {
    return ICON_MAP[String(name || '').toLowerCase()] || Puzzle;
}

function absoluteUrl(url) {
    if (!url) return url;
    return /^https?:\/\//.test(url) ? url : `${API_BASE}${url}`;
}

// ── Store ────────────────────────────────────────────────────────────────
let _descriptors = [];
const _subscribers = new Set();

function emit() {
    for (const fn of _subscribers) fn();
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('beeflow:modules-changed'));
    }
}

function setDescriptors(next) {
    _descriptors = next;
    emit();
}

// Build a Studio-app descriptor from one `/api/modules/frontend` entry.
export function toDescriptor(m) {
    if (!m || !m.id || !m.studioApp || !m.entryUrl) return null;
    const sa = m.studioApp;
    const labels = sa.labels && typeof sa.labels === 'object' ? sa.labels : {};
    const urlSegment = sa.urlSegment || m.id;
    const gateCapability = sa.gateCapability || null;
    const Icon = iconFor(sa.icon);
    const entryUrl = absoluteUrl(m.entryUrl);
    const cssUrls = Array.isArray(m.cssUrls) ? m.cssUrls.map(absoluteUrl) : [];

    return {
        id: m.id,
        urlSegment,
        version: m.version || null,
        runtime: true,
        gateCapability,
        labels,
        Icon,
        // Locale-aware label resolver (Studio calls this for runtime tabs).
        label: (_t, locale) => labels[locale] || labels.en || m.id,
        // Runtime tabs gate purely on the entitlement capability (server is
        // authoritative; this is display-only). No capability → always visible.
        gate: (ctx) => !gateCapability || !!(ctx && typeof ctx.can === 'function' && ctx.can(gateCapability)),
        // Rendered inside Studio's Suspense; RemoteStudioApp adds its own
        // boundary + Suspense so a load failure is contained to this pane.
        // createElement (not JSX) keeps this a plain .js module.
        Component: function RuntimeStudioApp(props) {
            return React.createElement(RemoteStudioApp, {
                moduleId: m.id,
                labels,
                entryUrl,
                cssUrls,
                componentProps: props,
            });
        },
        // Same prop contract as the simple static apps.
        getProps: ({ user, onNavigate, hasPermission }) => ({ user, onNavigate, hasPermission }),
    };
}

// Fetch + rebuild the runtime descriptors. Never throws.
export async function loadRemoteModules() {
    try {
        const res = await authFetch(`${API_BASE}/api/modules/frontend`);
        // Signed-out / forbidden → no modules for this session.
        if (res.status === 401 || res.status === 403) {
            if (_descriptors.length) setDescriptors([]);
            return;
        }
        // Transient failure (5xx/network) → keep the last-good set.
        if (!res.ok) return;
        const data = await res.json();
        const mods = Array.isArray(data?.modules) ? data.modules : [];
        setDescriptors(mods.map(toDescriptor).filter(Boolean));
    } catch {
        // Network blip — keep whatever we had rather than blanking the UI.
    }
}

// Alias used by ModulesPanel after an install/remove so a new/gone tab appears
// without a full page reload.
export const reloadRemoteModules = loadRemoteModules;

// ── React glue ───────────────────────────────────────────────────────────
export function getRuntimeStudioApps() {
    return _descriptors;
}

function subscribe(cb) {
    _subscribers.add(cb);
    return () => _subscribers.delete(cb);
}

export function useRuntimeStudioApps() {
    return useSyncExternalStore(subscribe, getRuntimeStudioApps, getRuntimeStudioApps);
}

// Wire the runtime to auth transitions. Called once from main.jsx (kept out of
// the React tree). Idempotent-ish: attaches a single listener per load.
let _started = false;
export function startRemoteModuleRuntime() {
    if (_started || typeof window === 'undefined') return;
    _started = true;
    window.addEventListener('beeflow:auth-changed', () => { loadRemoteModules(); });
    // Kick an initial load; pre-auth it 401s and settles to an empty set, then
    // the auth-changed fired on login/bootstrap refreshes it with the session.
    loadRemoteModules();
}

// Test-only reset so specs start from a clean store.
export function __resetRuntimeForTests() {
    _descriptors = [];
    _subscribers.clear();
    _started = false;
}

// Test-only setter to inject descriptors without a fetch (used by studioRoutes
// tests that need a runtime segment present).
export function __setRuntimeDescriptorsForTests(list) {
    setDescriptors(Array.isArray(list) ? list : []);
}
