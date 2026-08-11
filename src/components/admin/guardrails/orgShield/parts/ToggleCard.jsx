import React, { useId } from 'react';

import Toggle from '../../../../shared/Toggle';

/**
 * One setting row: icon, title, description, switch — plus optional extra
 * controls revealed underneath (the DLP mode picker, for instance).
 *
 * Replaces seven hand-rolled copies of the same markup. Each of those wrapped
 * a `<label>` around ONLY the switch track, with the title and description as
 * siblings — so the checkbox had no accessible name at all (a screen reader
 * announced seven anonymous checkboxes, one of them the master enable) and
 * clicking the title did nothing.
 *
 * `shared/Toggle` in row mode owns the card chrome and the label association.
 * The icon goes INSIDE the label node, with `ariaLabel` given explicitly:
 * Toggle only derives an accessible name from a `label` that is a plain
 * string, and a decorated one is not.
 */
export function ToggleCard({ Icon, title, description, checked, onChange, disabled = false, children }) {
    const id = useId();
    return (
        <div>
            <Toggle
                id={id}
                checked={checked}
                onChange={onChange}
                disabled={disabled}
                ariaLabel={typeof title === 'string' ? title : undefined}
                label={
                    <span className="flex items-center gap-2">
                        {Icon && (
                            <Icon
                                className="w-4 h-4 shrink-0"
                                aria-hidden="true"
                                style={{ color: 'var(--text-muted)' }}
                            />
                        )}
                        <span>{title}</span>
                    </span>
                }
                description={description}
                className={children ? 'rounded-b-none' : ''}
            />
            {children && (
                <div
                    className="px-4 pb-4 pt-3 rounded-b-xl bg-white/5"
                    style={{ borderTop: '1px solid var(--border-subtle)' }}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

export default ToggleCard;
