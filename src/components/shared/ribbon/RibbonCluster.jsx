/**
 * One Office-ribbon group: a bordered, rounded panel whose commands sit in a
 * compact 2-row grid (filling top-to-bottom, then wrapping into the next
 * column) with a small caption beneath — the classic Word/Excel ribbon group.
 * The border makes each category visually distinct. `single` centres a lone
 * headline command (e.g. AI step) over the full height instead of gridding it.
 *
 * Shared by the automations "Add step" ribbon (AddStepRibbon) and the App
 * Studio component ribbon (ComponentRibbon).
 */
export default function RibbonCluster({ caption, children, single = false }) {
    return (
        <div className="flex flex-col shrink-0 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]/60 px-1.5 pt-1 pb-0.5">
            {single ? (
                <div className="flex flex-1 items-center justify-center">{children}</div>
            ) : (
                <div className="grid grid-rows-2 grid-flow-col auto-cols-max content-start gap-x-0.5 gap-y-0.5 flex-1">
                    {children}
                </div>
            )}
            <div className="mt-0.5 text-center text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] select-none">
                {caption}
            </div>
        </div>
    );
}
