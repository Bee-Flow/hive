import React from 'react';
import BindingField from './BindingField';
import { FieldKeyField, TextField, IconField, usePatch } from './kit';
import { SpecListField } from './SpecPanel';
import ExpressionInput from '../logic/ExpressionInput';
import { registerInspector } from '../registry';
import FormField from '../../../../../shared/FormField';

/**
 * Content panel for `list`.
 *
 * Six props the runtime renders had no control here at all — metaKey,
 * timestampKey, badgeKey, badgeToneMap, unreadKey and selectedWhen. They were
 * AI-builder-only knobs: an author could see the AI produce a list with unread
 * dots and coloured badges and had no way to make, change or even find them.
 */
export default function ListInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);

    const fieldKey = (key, label, placeholder, hint) => (
        <FieldKeyField
            label={label}
            value={props[key]}
            onChange={(v) => patch({ [key]: v || null })}
            source={props.source}
            placeholder={placeholder}
            hint={hint}
            ariaLabel={label}
            disabled={disabled}
        />
    );

    return (
        <div className="flex flex-col gap-4">
            <BindingField
                label="Source"
                value={props.source}
                onChange={(v) => patch({ source: v })}
                definition={definition}
                node={node}
                hint="An array of objects to render as cards."
                placeholder='[{"title":"…"}]'
                disabled={disabled}
            />

            <FieldKeyField
                label="Title field"
                value={props.titleKey}
                onChange={(v) => patch({ titleKey: v })}
                source={props.source}
                placeholder="title"
                ariaLabel="Title field"
                disabled={disabled}
            />
            {fieldKey('subtitleKey', 'Subtitle field', 'Optional, e.g. subtitle')}
            {fieldKey('metaKey', 'Meta field', 'Optional', 'A third line, under the subtitle.')}
            {fieldKey('timestampKey', 'Time field', 'Optional', 'Shown on the right, as “2 h” or a date.')}
            {fieldKey('badgeKey', 'Badge field', 'Optional', 'Its value becomes the badge on each card.')}

            <FormField label="Badge colours" hint="Which value gets which colour. A value not listed here shows as neutral.">
                <SpecListField
                    label="Badge colours"
                    itemShape={{
                        value: { type: 'string', required: true },
                        label: { type: 'string' },
                        tone: { type: 'enum', values: ['primary', 'neutral', 'success', 'warning', 'danger', 'info'], default: 'neutral' },
                    }}
                    items={props.badgeToneMap}
                    onChange={(items) => patch({ badgeToneMap: items })}
                    disabled={disabled}
                />
            </FormField>

            {fieldKey('unreadKey', 'Unread field', 'Optional', 'A truthy value marks the card as unread.')}

            <FormField label="Highlighted when" hint="A formula. The matching card is shown as selected — e.g. item.id == vars.openId.">
                <ExpressionInput
                    variant="inline"
                    value={props.selectedWhen || ''}
                    onChange={(v) => patch({ selectedWhen: v || null })}
                    definition={definition}
                    node={node}
                    ariaLabel="Highlighted when"
                    placeholder="e.g. item.id == vars.openId"
                    disabled={disabled}
                />
            </FormField>

            <IconField label="Icon" value={props.icon} onChange={(v) => patch({ icon: v })} disabled={disabled} />
            <TextField
                label="Empty text"
                value={props.emptyText}
                onChange={(v) => patch({ emptyText: v })}
                disabled={disabled}
            />
        </div>
    );
}

registerInspector('list', ListInspector);
