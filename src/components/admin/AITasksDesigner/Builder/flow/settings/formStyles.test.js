import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
    sectionHeaderClass, fieldLabelClass, subLabelClass, disclosureClass,
    bandClass, railClass, cardClass, controlSurfaceClass, denseInputClass,
    rowInputClass, inputClass, textareaClass, requiredMarkClass,
    FOCUS_RING, FOCUS_RING_INSET,
} from './formStyles';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILDER = path.resolve(HERE, '../..');

/**
 * Guards the settings-panel visual vocabulary. Two of these encode the actual
 * defects that made the node editor unreadable, so they must not silently
 * regress:
 *   1. the section header and the field label were byte-identical strings;
 *   2. form controls painted --bg-primary on a --bg-card panel — a 1.01:1
 *      step in the paper theme, i.e. an invisible input.
 */
describe('form style vocabulary', () => {
    it('a section header and a field label are visibly different things', () => {
        expect(sectionHeaderClass()).not.toBe(fieldLabelClass());
        // Case is the primary cue: only the section heading shouts.
        expect(sectionHeaderClass()).toContain('uppercase');
        expect(fieldLabelClass()).not.toContain('uppercase');
        expect(subLabelClass()).not.toContain('uppercase');
    });

    it('the disclosure is shaped like a control, not like a heading', () => {
        expect(disclosureClass()).not.toContain('uppercase');
        expect(disclosureClass()).toContain('border');
        // --accent defaults to a neutral grey and is admin-configurable, so it
        // must never be the only thing carrying this control.
        expect(disclosureClass()).not.toContain('text-[var(--accent)]');
    });

    it('every control shares one fill, and it is not the panel colour', () => {
        for (const cls of [inputClass(), textareaClass(), denseInputClass(), rowInputClass(), controlSurfaceClass()]) {
            expect(cls).toContain('bg-[var(--bg-secondary)]');
            expect(cls).not.toContain('bg-[var(--bg-primary)]');
            expect(cls).toContain(FOCUS_RING);
        }
    });

    it('the invalid variant replaces the border colour instead of racing it', () => {
        const bad = rowInputClass('w-full', { invalid: true });
        expect(bad).toContain('border-[var(--error)]');
        expect(bad).not.toContain('border-[var(--border-default)]');
        // The default border is now the STRONG edge (color-mix on
        // --text-secondary) — the hairline token measured ~1.4:1 on the dark
        // themes, under WCAG 2.2 SC 1.4.11's 3:1 for control boundaries.
        expect(rowInputClass('w-full')).toContain('color-mix');
    });

    it('extras are appended so callers own width and size', () => {
        expect(denseInputClass('w-full font-mono')).toContain('w-full font-mono');
        // No width baked into the base — two width utilities in one class list
        // resolve by stylesheet order, not by the order they are written.
        expect(denseInputClass()).not.toContain('w-full');
        expect(inputClass()).toContain('w-full');
    });

    it('the focus ring clears the 3:1 floor by using the stronger accent step', () => {
        expect(FOCUS_RING).toContain('focus-visible:ring-2');
        expect(FOCUS_RING).toContain('var(--accent-primary-hover)');
        expect(FOCUS_RING_INSET).toContain('ring-inset');
    });

    it('sub-editor cards are outlined, never filled', () => {
        // A filled card cannot host a filled input: the best step between two
        // adjacent surface tokens is ~1.1:1, so one of the two disappears.
        expect(cardClass()).not.toContain('bg-');
        expect(cardClass()).toContain('border');
    });

    it('the band and rail use tokens nothing else in the panel claims', () => {
        expect(bandClass()).toContain('bg-[var(--bg-tertiary)]');
        expect(railClass()).toContain('border-l');
    });

    it('required markers follow the theme error token, not a raw Tailwind red', () => {
        expect(requiredMarkClass()).toContain('var(--error)');
    });
});

/**
 * The vocabulary above only helps if call sites actually use it. Fifteen
 * hand-rolled copies of the control string had already drifted into four
 * different input materials before this module existed.
 */
describe('no hand-rolled control styles in the builder', () => {
    const walk = (dir, out = []) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(p, out);
            else if (/\.jsx?$/.test(p) && !/\.test\./.test(p)) out.push(p);
        }
        return out;
    };

    it('nothing re-implements the legacy focus ring', () => {
        const offenders = walk(BUILDER)
            .filter(p => !p.endsWith('formStyles.js'))
            .filter(p => fs.readFileSync(p, 'utf8').includes('focus:ring-1 focus:ring-[var(--accent)]'))
            .map(p => path.relative(BUILDER, p));
        expect(offenders, `Use the helpers in flow/settings/formStyles.js instead:\n${offenders.join('\n')}`).toEqual([]);
    });

    it('no input-class helper spells the control out by hand', () => {
        // How the drift happened: BindingField, PathField, ConditionBuilder,
        // ScheduleBuilder and SettingsTab each grew a private copy of the
        // string, and they stopped agreeing about the fill. Aliasing the shared
        // helper (`const inputClass = denseInputClass('w-full')`) is fine — this
        // only catches a raw class list. --bg-primary elsewhere is left alone:
        // it is the correct surface for popovers and floating panels.
        const DECL = /(?:const|function)\s+\w*(?:[iI]nputClass|[tT]extareaClass)\w*\s*[=(]/;
        const offenders = [];
        for (const p of walk(BUILDER).filter(f => !f.endsWith('formStyles.js'))) {
            const lines = fs.readFileSync(p, 'utf8').split('\n');
            lines.forEach((line, i) => {
                if (!DECL.test(line)) return;
                const body = lines.slice(i, i + 3).join(' ');
                if (body.includes('border-[var(--border-default)]')) {
                    offenders.push(`${path.relative(BUILDER, p)}:${i + 1}`);
                }
            });
        }
        expect(offenders, `Import the helpers from flow/settings/formStyles.js instead:\n${offenders.join('\n')}`).toEqual([]);
    });
});
