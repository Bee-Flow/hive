import React from 'react';
import { TextField, TextArea, FieldRow } from '../fields';
import { CollapsibleCard, InlineHint, FieldSelect, SegmentedControl } from '../primitives';
import { DEMO_FEATURES, DEMO_FEATURE_IDS } from '../../../../demo/registry';

/**
 * Editor for the Live feature demo block.
 *
 * The feature is a SELECT over the demo registry, never a URL field. That is
 * the whole security posture of this block in one control: an editor can
 * choose which of our demos to show, and cannot point the frame anywhere
 * else. Adding an option means registering a demo in code.
 */
export function FeatureDemoEditor({ data, onChange }) {
    const set = (key, value) => onChange({ ...data, [key]: value });
    const feature = DEMO_FEATURES[data.feature];
    const height = Number.isFinite(data.height) ? data.height : 720;

    return (
        <div className="space-y-4">
            <CollapsibleCard title="Which demo" persistKey="blk.featureDemo.which" defaultOpen>
                <InlineHint>
                    The frame runs the real product interface on sample data. It cannot reach the
                    network, so nothing a visitor types is sent anywhere or stored.
                </InlineHint>
                <FieldSelect
                    label="Feature"
                    value={data.feature || ''}
                    onChange={v => set('feature', v)}
                    options={[
                        { value: '', label: '— pick a feature —' },
                        ...DEMO_FEATURE_IDS.map(id => ({ value: id, label: DEMO_FEATURES[id].label })),
                    ]}
                    hint={feature ? feature.blurb : 'The block renders a placeholder until a feature is picked.'}
                />
            </CollapsibleCard>

            <CollapsibleCard title="Heading" persistKey="blk.featureDemo.head" defaultOpen>
                <TextField label="Eyebrow" value={data.eyebrow || ''} onChange={v => set('eyebrow', v)} placeholder="Live demo" />
                <TextField label="Title" value={data.title || ''} onChange={v => set('title', v)} placeholder="Try it right here" />
                <TextArea label="Lead" value={data.lead || ''} onChange={v => set('lead', v)} rows={2} />
            </CollapsibleCard>

            <CollapsibleCard title="Frame" persistKey="blk.featureDemo.frame">
                <FieldRow label="Height" hint="320–1200px. Tall enough that the app is not squeezed into a letterbox.">
                    <input
                        type="number"
                        min={320}
                        max={1200}
                        step={20}
                        value={height}
                        onChange={(e) => {
                            const n = parseInt(e.target.value, 10);
                            set('height', Number.isFinite(n) ? Math.min(Math.max(n, 320), 1200) : 720);
                        }}
                        className="w-full px-2 py-1.5 text-sm rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                </FieldRow>
                <FieldRow label="Demo theme" hint="Matches the frame to the band it sits on.">
                    <SegmentedControl
                        value={data.theme === 'dark' ? 'dark' : 'light'}
                        onChange={v => set('theme', v)}
                        options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
                    />
                </FieldRow>
                <TextArea
                    label="Note under the frame"
                    value={data.note || ''}
                    onChange={v => set('note', v)}
                    rows={2}
                    hint="Keep this honest about the demo being sample data — a visitor should never wonder whether what they typed was saved."
                />
            </CollapsibleCard>
        </div>
    );
}

export default FeatureDemoEditor;
