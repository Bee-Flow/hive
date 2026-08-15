import {
    DndContext, DragOverlay, KeyboardSensor, PointerSensor,
    pointerWithin, rectIntersection,
    useDraggable, useDroppable, useSensor, useSensors,
} from '@dnd-kit/core';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { resolveBinding, walkPath } from '../resolveBinding';
import { useRuntime } from '../RuntimeContext';
import { HEIGHT_PX, isFill, ROLE_COLORS } from '../styleResolver';
import { EmptyText, ErrorText, SkeletonLines, displayValue, useStickyBinding } from '../uiBits';

/**
 * App Studio runtime — 'kanban'. Spec: server/appStudio/componentSpecs.js.
 *
 * Rows group into columns by groupByField. props.columns pins order/labels/
 * colors; when empty, columns derive from the distinct groupByField values in
 * source order. Dragging a card onto another column (run mode, allowDrag,
 * onCardMove wired) fires:
 *
 *   runAction(node.onCardMove, { formValues: { item: <moved row>, value: <target column value> } })
 *
 * so an update_record sequence step reads `form.item.id` (recordId) and
 * `form.value` (the new column value). Clicking a card fires onRowClick with
 * the row as form values (the table/data_grid contract).
 *
 * badgeToneMap (list's shape: [{ value, label, tone }]) turns the badge into a
 * coloured DOT when the value maps — a traffic light, not a word — with the
 * mapped label as its tooltip/sr text. Unmapped values keep the text pill so
 * data never silently vanishes.
 */

const COL_PREFIX = 'appkanban-col:';
const CARD_PREFIX = 'appkanban-card:';

/**
 * The lane under the POINTER wins — a card is bigger than the gap between
 * lanes, so rect intersection alone picks whichever lane the card's rectangle
 * overlaps most, which is not where the person is aiming. Keyboard drags have
 * no pointer coordinates (pointerWithin returns nothing for them), so rect
 * intersection stays as the fallback.
 */
function laneCollision(args) {
    const hits = pointerWithin(args);
    return hits.length ? hits : rectIntersection(args);
}

/**
 * Distinct column descriptors: the configured list pins order/labels/colours,
 * then every group value it does NOT cover gets its own trailing column. An
 * unconfigured value is normal (a legacy status, a value added after the board
 * was set up) and its cards must not silently vanish from the board.
 */
export function kanbanColumns(configured, rows, groupByField) {
    const out = (Array.isArray(configured) ? configured : [])
        .filter((c) => c && c.value !== undefined && c.value !== null)
        .map((c) => ({ value: String(c.value), label: c.label || String(c.value), color: c.color || null }));
    const seen = new Set(out.map((c) => c.value));
    for (const row of rows) {
        const v = walkPath(row, groupByField);
        const key = v == null || v === '' ? '' : String(v);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ value: key, label: key === '' ? '(none)' : key, color: null });
    }
    return out;
}

/** Card content, shared by the in-lane card and the drag overlay's copy. */
function CardBody({ row, titleKey, subtitleKey, badgeKey, badgeToneMap }) {
    const subtitle = subtitleKey ? walkPath(row, subtitleKey) : null;
    const badge = badgeKey ? walkPath(row, badgeKey) : null;
    const toneHit = badge != null && badge !== ''
        ? (Array.isArray(badgeToneMap) ? badgeToneMap : []).find((m) => m && String(m.value) === String(badge))
        : null;
    const dot = toneHit ? (ROLE_COLORS[toneHit.tone] || ROLE_COLORS.neutral) : null;

    return (
        <>
            <div className="flex items-start gap-1.5">
                <div className="text-sm font-medium break-words min-w-0 flex-1" style={{ color: 'var(--text-primary)' }}>
                    {displayValue(walkPath(row, titleKey))}
                </div>
                {dot ? (
                    <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 mt-1"
                        style={{ background: dot }}
                        title={toneHit.label || String(badge)}
                        data-app-kanban-dot={toneHit.tone || 'neutral'}
                    >
                        <span className="sr-only">{toneHit.label || String(badge)}</span>
                    </span>
                ) : null}
            </div>
            {subtitle != null && subtitle !== '' ? (
                <div className="text-xs mt-0.5 break-words" style={{ color: 'var(--text-secondary)' }}>
                    {displayValue(subtitle)}
                </div>
            ) : null}
            {badge != null && badge !== '' && !toneHit ? (
                <span
                    className="inline-flex items-center rounded-full px-1.5 py-0.5 mt-1.5 text-[11px] font-medium"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    {displayValue(badge)}
                </span>
            ) : null}
        </>
    );
}

function KanbanCard({ row, index, titleKey, subtitleKey, badgeKey, badgeToneMap, dragEnabled, clickable, onClick }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `${CARD_PREFIX}${index}`,
        data: { row },
        disabled: !dragEnabled,
    });

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            data-app-kanban-card={index}
            onClick={clickable ? onClick : undefined}
            // dnd-kit's attributes already announce this as a button with a tab
            // stop, so a keyboard user lands here and nothing happens: Enter
            // neither opens the card nor starts a drag. Opening it is the one
            // that matters, and it is one handler.
            onKeyDown={clickable ? (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                onClick?.();
            } : undefined}
            className={`border px-2.5 py-2 select-none app-focusable ${clickable ? 'cursor-pointer' : dragEnabled ? 'cursor-grab' : ''}`}
            // The card does NOT follow the pointer itself: it lives inside the
            // column's overflow-y-auto, so a transform beyond the lane edge is
            // clipped and the drag looks dead. The DragOverlay carries the
            // moving copy; the original stays put, dimmed to show its slot.
            style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                borderRadius: 'var(--app-radius)',
                opacity: isDragging ? 0.4 : 1,
                touchAction: 'none',
            }}
        >
            <CardBody row={row} titleKey={titleKey} subtitleKey={subtitleKey} badgeKey={badgeKey} badgeToneMap={badgeToneMap} />
        </div>
    );
}

function KanbanColumn({ column, children, count, maxHeight, fill }) {
    const { setNodeRef, isOver } = useDroppable({ id: `${COL_PREFIX}${column.value}` });
    const dot = column.color ? ROLE_COLORS[column.color] : null;
    return (
        <div
            ref={setNodeRef}
            data-app-kanban-column={column.value}
            className={`flex flex-col gap-2 min-w-[220px] flex-1 border p-2${fill ? ' h-full min-h-0' : ''}`}
            style={{
                background: isOver ? 'var(--app-primary-soft)' : 'var(--bg-tertiary)',
                borderColor: isOver ? 'var(--app-primary)' : 'var(--border-subtle, var(--border-default))',
                borderRadius: 'var(--app-radius)',
            }}
        >
            <div className={`flex items-center gap-1.5 px-0.5${fill ? ' shrink-0' : ''}`}>
                {dot ? <span className="h-2 w-2 rounded-full shrink-0" style={{ background: dot }} aria-hidden="true" /> : null}
                <span className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{column.label}</span>
                <span className="text-[11px] ml-auto tabular-nums" style={{ color: 'var(--text-muted)' }}>{count}</span>
            </div>
            {/* Scroll lives per COLUMN, not on the board: a board-level scrollbar
                would move every column at once and hide the headers. */}
            <div
                className={`flex flex-col gap-1.5 overflow-y-auto${fill ? ' flex-1 min-h-0' : ''}`}
                style={!fill && maxHeight ? { maxHeight } : undefined}
            >
                {children}
            </div>
        </div>
    );
}

export default function AppKanban({ node }) {
    const { mode, runAction, actionState, dataState, scope } = useRuntime();
    const {
        groupByField = 'status', columns = [], titleKey = 'title',
        subtitleKey = null, badgeKey = null, badgeToneMap = [], allowDrag = true,
    } = node.props || {};
    const { value: source, isLoading, error, errorCode } = useStickyBinding(
        resolveBinding(node.props?.source, { actionState, dataState, scope }),
    );

    // KeyboardSensor as well as Pointer: the cards advertise themselves as
    // draggable to a screen reader, so they have to actually be draggable
    // from the keyboard.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor),
    );

    // The row riding in the DragOverlay while a drag is live.
    const [activeRow, setActiveRow] = useState(null);
    // A drag's pointerup also dispatches a CLICK on whatever the browser deems
    // the common ancestor — without this guard, dropping a card near its own
    // slot immediately opened the workspace. A plain click never starts a drag
    // (4px activation distance), so it never sets the flag.
    const suppressClick = useRef(false);

    if (error) return <ErrorText error={error} errorCode={errorCode} />;

    if (isLoading) return <SkeletonLines lines={4} />;

    const rows = (Array.isArray(source) ? source : []).filter((r) => r && typeof r === 'object');
    const cols = kanbanColumns(columns, rows, groupByField);
    if (cols.length === 0) return <EmptyText text="Nothing to show yet." />;

    const isRun = mode === 'run';
    const dragEnabled = isRun && allowDrag !== false && !!node.onCardMove;
    const clickable = isRun && !!node.onRowClick;
    const fill = isFill(node);
    const maxHeight = fill ? null : (HEIGHT_PX[node.style?.height] || null);

    const groupOf = (row) => {
        const v = walkPath(row, groupByField);
        return v == null || v === '' ? '' : String(v);
    };

    const onDragStart = (event) => {
        suppressClick.current = true;
        setActiveRow(event?.active?.data?.current?.row || null);
    };

    // The synthetic click fires synchronously after pointerup — a macrotask
    // later is after it, and before any next intentional click can happen.
    const releaseClickSoon = () => { setTimeout(() => { suppressClick.current = false; }, 0); };

    const onDragCancel = () => {
        setActiveRow(null);
        releaseClickSoon();
    };

    const onDragEnd = (event) => {
        setActiveRow(null);
        releaseClickSoon();
        const { active, over } = event || {};
        if (!over || typeof over.id !== 'string' || !over.id.startsWith(COL_PREFIX)) return;
        const value = over.id.slice(COL_PREFIX.length);
        const row = active?.data?.current?.row;
        if (!row || groupOf(row) === value) return; // dropped on its own column
        runAction(node.onCardMove, { formValues: { item: row, value }, item: row, value });
    };

    const board = (
        <div
            className={`flex gap-3 overflow-x-auto${fill ? ' app-fill h-full min-h-0 items-stretch' : ' items-start'}`}
            data-app-kanban="true"
        >
            {cols.map((column) => {
                const colRows = rows
                    .map((row, index) => ({ row, index }))
                    .filter(({ row }) => groupOf(row) === column.value);
                return (
                    <KanbanColumn key={column.value} column={column} count={colRows.length} maxHeight={maxHeight} fill={fill}>
                        {colRows.map(({ row, index }) => (
                            <KanbanCard
                                key={index}
                                row={row}
                                index={index}
                                titleKey={titleKey}
                                subtitleKey={subtitleKey}
                                badgeKey={badgeKey}
                                badgeToneMap={badgeToneMap}
                                dragEnabled={dragEnabled}
                                clickable={clickable}
                                onClick={() => {
                                    if (suppressClick.current) return;
                                    runAction(node.onRowClick, { formValues: row, item: row });
                                }}
                            />
                        ))}
                    </KanbanColumn>
                );
            })}
        </div>
    );

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={laneCollision}
            onDragStart={onDragStart}
            onDragCancel={onDragCancel}
            onDragEnd={onDragEnd}
        >
            {board}
            {/* The moving copy lives OUTSIDE the lanes' scroll containers, so it
                stays visible across the whole board instead of being clipped at
                the first overflow edge — which read as "drag doesn't work".
                PORTALED to <body>: the overlay positions itself with fixed
                coordinates, and any transformed ancestor (the builder's canvas
                chrome) becomes its containing block — the copy then floats a
                constant offset away from the cursor. On <body> the viewport is
                the containing block everywhere the board can be embedded. */}
            {createPortal(
                <DragOverlay dropAnimation={null}>
                    {activeRow ? (
                        <div
                            data-app-kanban-overlay="true"
                            className="border px-2.5 py-2 select-none cursor-grabbing"
                            style={{
                                background: 'var(--bg-card)',
                                borderColor: 'var(--app-primary)',
                                borderRadius: 'var(--app-radius)',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
                            }}
                        >
                            <CardBody
                                row={activeRow}
                                titleKey={titleKey}
                                subtitleKey={subtitleKey}
                                badgeKey={badgeKey}
                                badgeToneMap={badgeToneMap}
                            />
                        </div>
                    ) : null}
                </DragOverlay>,
                document.body,
            )}
        </DndContext>
    );
}
