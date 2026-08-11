import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import Modal from '../../../../../shared/Modal';
import { useRuntime } from '../RuntimeContext';
import { spaceSteps } from '../styleResolver';

/**
 * App Studio runtime — 'modal' (container). Spec: server/appStudio/componentSpecs.js.
 *
 * Run mode  — a portaled overlay (shared <Modal>) opened either by the modal's
 *             built-in trigger button (triggerLabel) or by an `open_modal`
 *             action targeting this modal's id. Since the action runner drives
 *             opening out-of-band, this component registers an opener in a tiny
 *             module-level bus keyed by node id; openAppModal(id) flips it open.
 * Edit mode — an inline, labelled panel so the modal's content is visible and
 *             its children stay selectable/editable on the canvas.
 */

// Module-level open bus: modalId → Set<setOpen>. Lets an open_modal action (or a
// test) open a modal without threading state through RuntimeContext.
const openers = new Map();
// Ids opened while NO instance was mounted (a modal living in an inactive tab,
// or on a screen still rendering). The next instance to mount consumes the latch
// and opens, so the action is deferred instead of silently dropped.
const pendingOpen = new Set();

function subscribe(id, setOpen) {
    if (!id) return () => {};
    let set = openers.get(id);
    if (!set) { set = new Set(); openers.set(id, set); }
    set.add(setOpen);
    if (set.size === 1 && pendingOpen.delete(id)) setOpen(true);
    return () => {
        set.delete(setOpen);
        if (set.size === 0) openers.delete(id);
    };
}

/** Open the modal with this id (called by the open_modal action wiring / tests). */
export function openAppModal(id) {
    // A repeater mounts one instance PER ROW under the same node id; opening
    // them all stacks identical overlays, so only the first-mounted one opens.
    const first = openers.get(id)?.values().next().value;
    if (first) first(true);
    else pendingOpen.add(id);
}
/** Close the modal with this id. */
export function closeAppModal(id) {
    pendingOpen.delete(id);
    (openers.get(id) || []).forEach((setOpen) => setOpen(false));
}

const MODAL_SIZE = { sm: 'sm', md: 'md', lg: 'lg' };

export default function AppModal({ node, children }) {
    const { mode } = useRuntime();
    const { title = null, size = 'md', triggerLabel = null } = node.props || {};
    const [open, setOpen] = useState(false);

    useEffect(() => subscribe(node.id, setOpen), [node.id]);

    const gap = Number.isFinite(node.style?.gap) ? node.style.gap : 3;
    const grid = (
        <div
            className="app-grid"
            style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: spaceSteps(gap) }}
        >
            {children}
        </div>
    );

    // Edit mode — an inline labelled panel (never a portal) so the canvas can
    // show and edit the modal's contents in place.
    if (mode === 'edit') {
        return (
            <div
                className="w-full border"
                style={{ borderColor: 'var(--border-default)', borderRadius: 'var(--app-radius)', background: 'var(--bg-card)' }}
                data-app-modal="edit"
            >
                <div
                    className="flex items-center gap-2 px-3 py-2 border-b"
                    style={{ borderColor: 'var(--border-default)' }}
                >
                    <span
                        className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ background: 'var(--app-primary-soft)', color: 'var(--app-primary)' }}
                    >
                        Modal
                    </span>
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {title || 'Untitled dialog'}
                    </span>
                </div>
                <div className="p-3">{grid}</div>
            </div>
        );
    }

    // Run mode — a trigger (when configured) plus the portaled dialog.
    return (
        <>
            {triggerLabel ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium"
                    style={{ background: 'var(--app-primary)', color: 'var(--app-primary-contrast)', borderRadius: 'var(--app-radius)' }}
                    data-app-modal-trigger={node.id}
                >
                    {triggerLabel}
                </button>
            ) : null}
            {/* shared/Modal only draws a close control when it is handed one,
                and none was — so the dialog had no visible way out at all and
                the viewer had to discover Escape or a backdrop click. The
                header only renders when there is something in it, hence the
                fallback title: a dialog with a close button and no heading
                would be a bare X floating over the content. */}
            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title={title || 'Dialog'}
                size={MODAL_SIZE[size] || 'md'}
                headerActions={(
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="Close dialog"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-[var(--bg-tertiary)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--text-secondary)]"
                        style={{ color: 'var(--text-secondary)' }}
                        data-app-modal-close={node.id}
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                )}
            >
                {grid}
            </Modal>
        </>
    );
}
