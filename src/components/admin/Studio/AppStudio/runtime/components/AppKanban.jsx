import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';
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
 */

const COL_PREFIX = 'appkanban-col:';
const CARD_PREFIX = 'appkanban-card:';

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

function KanbanCard({ row, index, titleKey, subtitleKey, badgeKey, dragEnabled, clickable, onClick }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `${CARD_PREFIX}${index}`,
        data: { row },
        disabled: !dragEnabled,
    });
    const subtitle = subtitleKey ? walkPath(row, subtitleKey) : null;
    const badge = badgeKey ? walkPath(row, badgeKey) : null;

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
            style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-default)',
                borderRadius: 'var(--app-radius)',
                opacity: isDragging ? 0.4 : 1,
                transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
                touchAction: 'none',
            }}
        >
            <div className="text-sm font-medium break-words" style={{ color: 'var(--text-primary)' }}>
                {displayValue(walkPath(row, titleKey))}
            </div>
            {subtitle != null && subtitle !== '' ? (
                <div className="text-xs mt-0.5 break-words" style={{ color: 'var(--text-secondary)' }}>
                    {displayValue(subtitle)}
                </div>
            ) : null}
            {badge != null && badge !== '' ? (
                <span
                    className="inline-flex items-center rounded-full px-1.5 py-0.5 mt-1.5 text-[11px] font-medium"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                >
                    {displayValue(badge)}
                </span>
            ) : null}
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
        subtitleKey = null, badgeKey = null, allowDrag = true,
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

    const onDragEnd = (event) => {
        const { active, over } = event || {};
        if (!over || typeof over.id !== 'string' || !over.id.startsWith(COL_PREFIX)) return;
        const value = over.id.slice(COL_PREFIX.length);
        const row = active?.data?.current?.row;
        if (!row || groupOf(row) === value) return; // dropped on its own column
        runAction(node.onCardMove, { formValues: { item: row, value } });
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
                                dragEnabled={dragEnabled}
                                clickable={clickable}
                                onClick={() => runAction(node.onRowClick, { formValues: row })}
                            />
                        ))}
                    </KanbanColumn>
                );
            })}
        </div>
    );

    return (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            {board}
        </DndContext>
    );
}
