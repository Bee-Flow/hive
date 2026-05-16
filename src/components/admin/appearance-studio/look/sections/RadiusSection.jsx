import React from 'react';
import Slider from '../../../../shared/Slider';
import RadiusChip from '../../shared/RadiusChip';
import { SECTION_IDS } from '../useLookForm';

export default function RadiusSection({ form, setForm, saving }) {
    return (
        <section
            id={SECTION_IDS.radius}
            aria-labelledby={`${SECTION_IDS.radius}-heading`}
        >
            <h3
                id={`${SECTION_IDS.radius}-heading`}
                className="text-base font-semibold mb-1"
                style={{ color: 'var(--text-primary)' }}
            >
                Corner roundness
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                A multiplier applied to every rounded corner in the app.
            </p>
            <Slider
                value={form.radiusScale}
                onChange={(v) => setForm((f) => ({ ...f, radiusScale: v }))}
                min={0.5}
                max={1.5}
                step={0.05}
                valueFormatter={(v) => `${v.toFixed(2)}×`}
                disabled={saving}
                trailing={
                    <div className="flex items-center gap-1.5" aria-hidden="true">
                        <RadiusChip scale={form.radiusScale} base={6} size={22} />
                        <RadiusChip scale={form.radiusScale} base={10} size={26} />
                        <RadiusChip scale={form.radiusScale} base={14} size={30} />
                    </div>
                }
            />
        </section>
    );
}
