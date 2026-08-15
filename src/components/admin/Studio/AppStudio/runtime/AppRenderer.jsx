import { tryEvaluate } from '@shared/expr/engine.mjs';
import { EyeOff, FileQuestion, TriangleAlert } from 'lucide-react';
import React, { useMemo } from 'react';
import './runtime.css';
import './app-tokens.css';
import { appDesignProps } from './appDesign';
import { APP_COMPONENT_TYPES } from './componentRegistry';
import { FieldDisabledContext } from './formContext';
import { resolveBinding } from './resolveBinding';
import { RuntimeProvider, ScopeProvider, DEFAULT_RUNTIME, buildScope, rowKey, useRuntime } from './RuntimeContext';
import { resolveNodeStyle, resolveSectionStyle } from './styleResolver';
import { themeVars } from './themeVars';

/**
 * App Studio runtime — the renderer shared by the editor canvas and the
 * end-user run view (NO editor imports in runtime/ — the editor customizes
 * behaviour exclusively through props: NodeWrapper, onSelectNode, runAction…).
 *
 * v2 adds formula-driven behaviour, all evaluated against the shared
 * expression scope (buildScope) and always tolerant of half-configured state:
 *   - visibility — node.visible OR node.visibleWhen, each a boolean or a
 *     {kind:'formula',expr} (the only shapes canonicalize.js keeps).
 *   - enablement — node.enabledWhen / node.readOnly, same two shapes, disable
 *     the node
 *     via an inert wrapper (no per-component wiring; works for any node).
 *   - computed   — node.computed[propKey] (formula string or binding) overrides
 *     props[propKey] at render.
 *   - repetition — node.repeat / node.forEach (a binding → array) renders the
 *     node's children once per item with a per-row scope carrying item/index.
 *
 * Guarantees (unchanged):
 *   - every node renders inside NodeWrapper AND a per-node error boundary;
 *   - unknown types render a neutral placeholder naming the type;
 *   - visible:false nodes are skipped in run mode but stay findable in edit
 *     mode (40% opacity + an EyeOff badge). A formula that errors shows a
 *     subtle "formula error" badge in edit mode only — never a crash.
 *
 * NodeWrapper contract: ({ node, className, style, children }) — it renders
 * the node's GRID CELL, so a custom wrapper must spread className/style onto
 * its outermost element to keep the 12-column placement.
 */

const MAX_WIDTHS = { narrow: '640px', medium: '960px', wide: '1280px', full: 'none' };

const noop = () => {};

/**
 * PRESENTATIONAL role gate — is a screen/node visible to the active preview
 * role? A missing/empty visibleToRoles means "everyone"; a null role or the
 * owner sentinel disables gating entirely (full view). This drives the editor's
 * "view as role" preview ONLY — real row-level security is server-enforced by
 * the RLS gateway, so this is never a security control.
 */
function roleAllows(nodeOrScreen, previewRole) {
    if (!previewRole || previewRole === 'owner') return true;
    const gate = nodeOrScreen && nodeOrScreen.visibleToRoles;
    if (!Array.isArray(gate) || gate.length === 0) return true;
    return gate.includes(previewRole);
}

export function DefaultNodeWrapper({ node, className, style, children }) {
    return (
        <div data-node-id={node.id} data-app-type={node.type} className={className} style={style}>
            {children}
        </div>
    );
}

class NodeErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { failed: false, signature: props.signature };
    }

    static getDerivedStateFromError() {
        return { failed: true };
    }

    static getDerivedStateFromProps(props, state) {
        // The wrapped node's content changed (e.g. the inspector corrected a
        // bad prop) — clear a prior failure so it re-renders instead of showing
        // the failure card forever. A node that is still broken throws again on
        // the next render and getDerivedStateFromError contains it once more.
        if (props.signature !== state.signature) {
            return { failed: false, signature: props.signature };
        }
        return null;
    }

    componentDidCatch(error) {
        console.error(`[AppStudio] component '${this.props.type}' crashed:`, error);
    }

    render() {
        if (this.state.failed) {
            return (
                <div
                    className="flex items-center gap-2 border border-dashed px-3 py-2 text-sm"
                    style={{
                        borderColor: 'var(--border-default)',
                        color: 'var(--text-muted)',
                        borderRadius: 'var(--app-radius)',
                    }}
                >
                    <TriangleAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>This component failed</span>
                </div>
            );
        }
        return this.props.children;
    }
}

function UnknownType({ type }) {
    return (
        <div
            className="flex items-center gap-2 border border-dashed px-3 py-2 text-sm"
            style={{
                borderColor: 'var(--border-default)',
                color: 'var(--text-muted)',
                borderRadius: 'var(--app-radius)',
            }}
        >
            <FileQuestion className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Unknown component: {String(type)}</span>
        </div>
    );
}

/**
 * Cheap content signature for the error boundary: a node whose props/style
 * change gets a fresh signature so a boundary that previously caught a crash
 * resets and re-renders the corrected node. Children have their own boundaries,
 * so they don't need to factor in here. Uses the SOURCE node (not the
 * computed-props one) so the reset semantics match the authored definition.
 */
function nodeSignature(node) {
    try {
        return `${node.type} ${JSON.stringify(node.props)} ${JSON.stringify(node.style)}`;
    } catch {
        return String(node.id);
    }
}

// ── Formula evaluation (never throws — tryEvaluate degrades) ────────────────

/**
 * Resolve a boolean-or-formula flag against the live scope.
 * → { set:false } when the flag is absent, else { set:true, value, error }.
 *
 * ── WHY THIS TAKES THREE SHAPES ─────────────────────────────────────
 * These flags reach the renderer as `{kind:'formula', expr}`. That is the ONLY
 * expression shape that survives a save: canonicalize.cleanBoolOrFormula keeps
 * a boolean or a formula OBJECT and drops a bare string, and builderTools
 * .normalizeLogicValue wraps the AI's string into the same object before it is
 * ever stored. So both authoring paths — the Logic inspector and the AI builder
 * — persist the object.
 *
 * This function used to accept only the bare STRING, which meant every "Only
 * show when" and "Enabled when" rule in every saved app did nothing at all: the
 * component stayed visible and enabled for everybody, including the rules
 * written to hide things from people who should not see them. Every test
 * covering these used the string form, so the gap was invisible from both
 * sides. The string is still accepted — a definition held in memory before its
 * first save can carry one — but the object is the shape that matters.
 */
function evalBoolFlag(raw, scope) {
    if (raw === undefined || raw === null) return { set: false };
    if (typeof raw === 'boolean') return { set: true, value: raw, error: null };
    const expr = (raw && typeof raw === 'object') ? (raw.expr ?? raw.value) : raw;
    if (typeof expr === 'string' && expr.trim()) {
        const r = tryEvaluate(expr, scope);
        return { set: true, value: !!r.value, error: r.error };
    }
    return { set: false };
}

/** { hidden, error }. visibleWhen wins; else boolean/formula `visible`. */
function evalVisibility(node, scope) {
    const when = evalBoolFlag(node.visibleWhen, scope);
    if (when.set) return { hidden: !when.value, error: when.error };
    const v = evalBoolFlag(node.visible, scope);
    if (v.set) return { hidden: !v.value, error: v.error };
    return { hidden: false, error: null };
}

/** { disabled, error }. enabledWhen falsy / readOnly / disabled → disabled. */
function evalEnabled(node, scope) {
    let disabled = node.disabled === true;
    let error = null;

    // readOnly is a boolean-or-formula flag too (canonicalize cleans all three
    // together), so a computed "read-only while the order is locked" has to be
    // evaluated rather than compared against `true`.
    const ro = evalBoolFlag(node.readOnly, scope);
    if (ro.set) {
        if (ro.error) error = ro.error;
        if (ro.value) disabled = true;
    }

    const when = evalBoolFlag(node.enabledWhen, scope);
    if (when.set) {
        if (when.error) error = error || when.error;
        if (!when.value) disabled = true;
    }
    return { disabled, error };
}

/**
 * { props, error }. Evaluate node.computed[key] (formula string or binding).
 * A formula that ERRORED overrides nothing — the authored prop stays visible
 * (with the edit-mode badge), because a typo must not blank the component.
 */
function evalComputed(node, scope, bag) {
    const computed = node.computed;
    if (!computed || typeof computed !== 'object') return { props: null, error: null };
    const overrides = {};
    let count = 0;
    let error = null;
    for (const [key, entry] of Object.entries(computed)) {
        let r;
        if (typeof entry === 'string') r = tryEvaluate(entry, scope);
        else if (entry && typeof entry === 'object') r = resolveBinding(entry, { ...bag, scope });
        else continue;
        if (r.error) {
            if (!error) error = r.error;
            continue;
        }
        overrides[key] = r.value;
        count += 1;
    }
    return { props: count ? overrides : null, error };
}

function HiddenBadge() {
    return (
        <span
            className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide mb-1"
            style={{ color: 'var(--text-muted)' }}
            data-app-hidden-badge="true"
        >
            <EyeOff className="w-3 h-3" aria-hidden="true" />
            Hidden
        </span>
    );
}

function FormulaErrorBadge({ message }) {
    return (
        <span
            className="inline-flex items-center gap-1 text-[10px] font-medium mb-1 text-amber-600 dark:text-amber-400"
            data-app-formula-error="true"
            title={message || 'This formula could not be evaluated.'}
        >
            <TriangleAlert className="w-3 h-3" aria-hidden="true" />
            Formula error
        </span>
    );
}

/**
 * Inert wrapper for a disabled node — blocks pointer + keyboard interaction.
 *
 * It also tells the inputs below it that they are switched off. Without that a
 * required field behind `enabledWhen:false` still registered as required, so
 * submit failed on a field nobody could focus or type into and the form could
 * never be sent.
 */
function DisabledWrap({ children }) {
    return (
        <FieldDisabledContext.Provider value={true}>
            <div
                data-app-disabled="true"
                aria-disabled="true"
                inert={true}
                style={{ opacity: 0.6, pointerEvents: 'none' }}
            >
                {children}
            </div>
        </FieldDisabledContext.Provider>
    );
}

/**
 * Render a node's children, threading a per-row item scope when it repeats.
 * Inside a `form` container the child scope's `form` root is that form's live
 * values (forms[name] — published by AppForm via registerFormValue), so
 * visibleWhen/computed formulas like "form.email != ''" react to typing. Same
 * mechanism as the repeater's per-item scope.
 */
function renderChildren(node, scope, { actionState, dataState, NodeWrapper, mode }) {
    const children = Array.isArray(node.children) ? node.children : null;
    if (!children) return undefined;

    let childBase = scope;
    if (node.type === 'form') {
        // Keep the name fallback in lockstep with AppForm's registerFormValue.
        const formName = node.props?.name || node.id;
        childBase = { ...scope, form: (scope.forms && scope.forms[formName]) || {} };
    }

    // A `repeater`'s array lives in its schema-documented prop (props.source);
    // node.repeat/forEach are the generic escape hatch and win when present.
    // Reading props.source here means persisted/published repeaters (which only
    // carry props.source, not a normalized forEach) repeat correctly too.
    const repeatBinding = node.repeat || node.forEach
        || (node.type === 'repeater' ? node.props?.source : null);
    if (repeatBinding) {
        const { value } = resolveBinding(repeatBinding, { actionState, dataState, scope });
        const items = Array.isArray(value) ? value : [];
        return items.flatMap((item, index) => {
            const childScope = { ...childBase, item, index, value: item };
            const row = rowKey(item, index);
            return children.map((child) => (
                <RenderNode
                    key={`${child.id}::${row}`}
                    node={child}
                    scope={childScope}
                    NodeWrapper={NodeWrapper}
                    mode={mode}
                />
            ));
        });
    }

    return children.map((child) => (
        <RenderNode key={child.id} node={child} scope={childBase} NodeWrapper={NodeWrapper} mode={mode} />
    ));
}

function RenderNode({ node, scope, NodeWrapper, mode }) {
    const runtime = useRuntime();
    if (!node || typeof node !== 'object') return null;

    // View-as-role preview (editor only): a node gated away from the active
    // role is removed from the simulated view entirely — you are looking at
    // what that role would see. No previewRole → today's behaviour exactly.
    if (!roleAllows(node, runtime.previewRole)) return null;

    const nodeScope = scope || runtime.scope || DEFAULT_RUNTIME.scope;

    const vis = evalVisibility(node, nodeScope);
    const hidden = vis.hidden;
    if (hidden && mode !== 'edit') return null;

    const enabled = evalEnabled(node, nodeScope);
    const computedRes = evalComputed(node, nodeScope, {
        actionState: runtime.actionState,
        dataState: runtime.dataState,
    });
    const formulaError = vis.error || enabled.error || computedRes.error || null;

    const effProps = computedRes.props
        ? { ...(node.props || {}), ...computedRes.props }
        : node.props;
    const effectiveNode = effProps === node.props ? node : { ...node, props: effProps };

    const entry = APP_COMPONENT_TYPES[node.type];
    let content;
    if (!entry) {
        content = <UnknownType type={node.type} />;
    } else {
        const Component = entry.Component;
        const children = renderChildren(effectiveNode, nodeScope, {
            actionState: runtime.actionState,
            dataState: runtime.dataState,
            NodeWrapper,
            mode,
        });
        content = <Component node={effectiveNode}>{children}</Component>;
    }

    // A modal renders no inline box in run mode — closed it is null, open its
    // dialog portals to the body. Emitting the usual grid cell for it painted
    // an EMPTY padded span-12 row (plus the section's row gap) into every
    // section hosting one: on the merged work screens that was a visible dead
    // band between the header and the content. Edit mode keeps the cell so the
    // canvas still has a box to select.
    if (node.type === 'modal' && mode !== 'edit') {
        const bare = (
            <NodeErrorBoundary type={node.type} signature={nodeSignature(node)}>
                {content}
            </NodeErrorBoundary>
        );
        return nodeScope === runtime.scope ? bare : <ScopeProvider scope={nodeScope}>{bare}</ScopeProvider>;
    }

    const { className, style } = resolveNodeStyle(node);
    const cellStyle = hidden ? { ...style, opacity: 0.4 } : style;

    const cell = (
        <NodeWrapper node={node} className={className} style={cellStyle}>
            <NodeErrorBoundary type={node.type} signature={nodeSignature(node)}>
                {hidden ? <HiddenBadge /> : null}
                {mode === 'edit' && formulaError ? <FormulaErrorBadge message={formulaError} /> : null}
                {enabled.disabled ? <DisabledWrap>{content}</DisabledWrap> : content}
            </NodeErrorBoundary>
        </NodeWrapper>
    );

    // A per-row / per-form scope has to reach the COMPONENT and everything
    // below it, not just the formulas evaluated here — components resolve
    // their own bindings against useRuntime().scope. ScopeProvider renders no
    // DOM, so the grid cell stays a direct child of the section.
    if (nodeScope === runtime.scope) return cell;
    return <ScopeProvider scope={nodeScope}>{cell}</ScopeProvider>;
}

export default function AppRenderer({
    definition,
    screenId,
    mode = 'run',
    NodeWrapper = DefaultNodeWrapper,
    actionState,
    dataState,
    runAction,
    onSelectNode,
    selectedNodeId = null,
    selectedNodeIds = null,
    recentlyAddedIds,
    registerFormValue = null,
    currentUser = null,
    previewRole = null,
    vars,
    setVar = null,
    forms,
    screenParams,
}) {
    const screen = useMemo(() => {
        const screens = definition?.screens || [];
        return screens.find((s) => s.id === screenId)
            || screens.find((s) => s.id === definition?.homeScreenId)
            || screens[0]
            || null;
    }, [definition?.screens, screenId, definition?.homeScreenId]);

    // One timestamp for this renderer's lifetime — every buildScope call in a
    // render pass reads the same now/today so formulas are internally consistent.
    const nowStamp = useMemo(() => new Date().toISOString(), []);
    const todayStamp = nowStamp.slice(0, 10);

    // The design a component may need in JS rather than CSS (chart palette,
    // motion gating). `primary` rides along so a palette can be derived without
    // reaching for the definition. null = no design authored = today's look.
    const appDesignContext = useMemo(() => {
        const d = definition?.design;
        if (!d || typeof d !== 'object') return null;
        return { ...d, primary: definition?.theme?.primary || null };
    }, [definition?.design, definition?.theme?.primary]);

    const baseScope = useMemo(() => buildScope({
        actionState: actionState || {},
        dataState: dataState || {},
        currentUser: currentUser || null,
        vars: vars || {},
        forms: forms || {},
        screen: { id: screen?.id, name: screen?.name, params: screenParams || {} },
        now: nowStamp,
        today: todayStamp,
    }), [actionState, dataState, currentUser, vars, forms, screen?.id, screen?.name, screenParams, nowStamp, todayStamp]);

    const runtimeValue = useMemo(() => ({
        mode: mode === 'edit' ? 'edit' : 'run',
        selectedNodeId,
        // Multi-select: the whole set of selected node ids (editor only). A
        // single-select is a one-element set; run view / legacy callers pass
        // null and readers fall back to selectedNodeId.
        selectedNodeIds: selectedNodeIds instanceof Set ? selectedNodeIds : null,
        onSelectNode: onSelectNode || noop,
        recentlyAddedIds: recentlyAddedIds instanceof Set
            ? recentlyAddedIds
            : new Set(recentlyAddedIds || []),
        actionState: actionState || {},
        dataState: dataState || {},
        runAction: runAction || noop,
        registerFormValue,
        currentUser: currentUser || null,
        previewRole: previewRole || null,
        // setVar lets interactive components (filter_bar) publish into the
        // action-variable scope; falls back to DEFAULT_RUNTIME's noop.
        ...(typeof setVar === 'function' ? { setVar } : {}),
        // App Design v2 for the components that need more than a CSS variable
        // (charts pick a palette, motion-aware components gate animation).
        // Resolved ONCE here; null when the app has no design, so every
        // consumer's fallback is today's behaviour.
        appDesign: appDesignContext,
        scope: baseScope,
    }), [mode, selectedNodeId, selectedNodeIds, onSelectNode, recentlyAddedIds, actionState, dataState, runAction, registerFormValue, currentUser, previewRole, setVar, appDesignContext, baseScope]);

    if (!definition) return null;
    if (!screen) return null;

    // Screen-level role gate (editor preview only): if the whole screen is
    // hidden from the previewed role, show a neutral notice instead of its
    // contents. Row-level security is server-enforced — this is UX.
    const screenHidden = !roleAllows(screen, previewRole);

    // A full-height section only works if every wrapper above it also has a
    // definite height. Applied conditionally so a normal screen renders
    // byte-identically to before.
    const hasFillSection = (screen.sections || []).some((s) => s?.style?.height === 'fill');

    // `flex flex-col` is the fix, not decoration. The max-width wrapper below
    // already asked for `flex-1`, but this element was a plain block — there is
    // no CSS rule for .app-runtime anywhere in the repo — so that flex-basis was
    // inert and the wrapper collapsed to content height. A full-height screen
    // therefore rendered as a short band with dead space under it, which is
    // exactly what a large monitor made obvious.
    //
    // `flex-1` is for AppShell's flex-column <main>; in the editor's block-parent
    // canvas it is inert and `h-full` carries the height. One string, right in
    // both hosts.
    // Design layer (App Design v2): identity in, nothing out — an absent or
    // all-default definition.design adds no class and no style keys here.
    const design = appDesignProps(definition);
    // A screen change fades the new screen in. The animation reads
    // --app-motion-med, which is 0ms under design.motion 'none' AND under the
    // OS reduced-motion setting — so this is free for anyone who opted out.
    // Keyed on the screen id so React remounts the wrapper and the animation
    // actually re-runs instead of only playing on first paint.
    const runtimeClass = `app-runtime app-screen-enter w-full${hasFillSection ? ' h-full min-h-0 flex-1 flex flex-col' : ''}${design.className ? ` ${design.className}` : ''}`;

    return (
        <RuntimeProvider value={runtimeValue || DEFAULT_RUNTIME}>
            <div
                key={screen.id}
                className={runtimeClass}
                data-app-screen={screen.id}
                data-app-screen-kind={screen.kind || 'page'}
                data-app-appearance={definition.theme?.appearance || 'auto'}
                style={{ ...themeVars(definition.theme), ...design.style, color: 'var(--text-primary)' }}
            >
                <div
                    className={`w-full flex flex-col${hasFillSection ? ' flex-1 min-h-0' : ''}`}
                    style={{ maxWidth: MAX_WIDTHS[screen.maxWidth] || MAX_WIDTHS.medium, margin: '0 auto' }}
                >
                    {screenHidden ? (
                        <div
                            className="flex items-center gap-2 border border-dashed px-4 py-6 text-sm"
                            data-app-screen-role-hidden="true"
                            style={{
                                borderColor: 'var(--border-default)',
                                color: 'var(--text-muted)',
                                borderRadius: 'var(--app-radius)',
                            }}
                        >
                            <EyeOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                            {/* A real viewer reaches this too (a screen gated away
                                from their role), and to them nothing is being
                                "previewed" — say what it means for them instead. */}
                            <span>
                                {mode === 'edit'
                                    ? 'This screen isn’t visible to the previewed role.'
                                    : 'You don’t have access to this page. Ask whoever shared this app if you need it.'}
                            </span>
                        </div>
                    ) : null}
                    {!screenHidden && (screen.sections || []).map((section) => {
                        const sectionStyle = resolveSectionStyle(section);
                        return (
                        <section
                            key={section.id}
                            data-section-id={section.id}
                            className={sectionStyle.className}
                            style={sectionStyle.style}
                        >
                            {(section.children || []).map((node) => (
                                <RenderNode
                                    key={node.id}
                                    node={node}
                                    scope={baseScope}
                                    NodeWrapper={NodeWrapper}
                                    mode={mode}
                                />
                            ))}
                        </section>
                        );
                    })}
                </div>
            </div>
        </RuntimeProvider>
    );
}
