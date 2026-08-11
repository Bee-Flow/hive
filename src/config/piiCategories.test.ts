/**
 * The Privacy Shield / consumer picker reads this single canonical list, so a
 * drift here silently hides or invents category toggles. BFSF-269 touched the
 * detector coverage; these tests pin the list the UI advertises.
 */
import { describe, it, expect } from 'vitest';
import { PII_CATEGORIES, piiCategoriesLocalized } from './piiCategories';

describe('PII_CATEGORIES', () => {
    it('exposes exactly 21 categories', () => {
        // Kept in lock-step with guard-service GLINER_LABELS_TO_CATEGORY +
        // the regex tier. Update both sides together if this changes.
        expect(PII_CATEGORIES).toHaveLength(21);
    });

    it('has unique ids and complete structure for every entry', () => {
        const ids = PII_CATEGORIES.map(c => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const c of PII_CATEGORIES) {
            expect(c.id).toBeTruthy();
            expect(c.group).toBeTruthy();
            expect(c.icon).toBeTruthy();
            expect(c.i18nKey).toBeTruthy();
        }
    });

    it('gives every category a renderable lucide icon', () => {
        // A missing `Icon` renders as a hole in every picker (the grid falls
        // back to the emoji, so it fails quietly rather than loudly).
        // Deliberately NOT `typeof === 'function'`: lucide icons are forwardRef
        // objects, so that assertion would fail for the wrong reason.
        for (const c of PII_CATEGORIES) {
            expect(c.Icon, `${c.id} has no Icon`).toBeTruthy();
        }
    });

    it('gives each category a distinct icon', () => {
        // The emoji set had real collisions — 🆔 stood for both the US SSN and
        // the national ID, 🌐 for both IBAN and IP address — so two different
        // categories were visually identical in a 21-row grid.
        const icons = PII_CATEGORIES.map(c => c.Icon);
        expect(new Set(icons).size).toBe(icons.length);
    });

    it('includes the core BFSF-269 categories', () => {
        const ids = new Set(PII_CATEGORIES.map(c => c.id));
        for (const id of ['Person', 'DateOfBirth', 'Address', 'Organization']) {
            expect(ids.has(id)).toBe(true);
        }
    });
});

describe('piiCategoriesLocalized', () => {
    it('resolves labels via the i18n function, falling back when missing', () => {
        const t = (key: string, fallback?: string) => fallback ?? key;
        const localized = piiCategoriesLocalized(t);
        expect(localized).toHaveLength(21);
        for (const c of localized) {
            expect(typeof c.label).toBe('string');
            expect(c.label.length).toBeGreaterThan(0);
        }
    });
});
