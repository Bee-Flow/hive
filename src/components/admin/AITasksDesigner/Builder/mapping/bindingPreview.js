import { tryEvaluate } from '@shared/expr/engine.mjs';
import { walkPath, previewValue } from '../../../../../utils/bindingHelpers';

/**
 * Resolve the "example" line for a binding against a sample root tree
 * (design-time samples merged with real-run/pinned data by the inspector):
 *
 *   - literal   — the value itself, formatted
 *   - ref       — the sample found at that path
 *   - template  — the text with every `{{path}}` substituted
 *   - expr      — the expression EVALUATED by the shared deterministic engine
 *                 (@shared/expr: pure, whitelisted functions, no JS sandbox),
 *                 so `lower(item.email)` and `parseJson(item.body, "total")`
 *                 show a real value instead of jargon.
 *
 * Returns null when there is nothing worth showing. `raw` decides what to do
 * when an expression can't be evaluated: BindingField (whose user is already
 * looking at the expression source) falls back to `expr: <source>`; the visual
 * ValueBuilder passes `raw: false` and shows nothing rather than leaking a
 * path with an internal step id in it.
 */
export default function previewBinding(binding, sampleRoot, { raw = true } = {}) {
    if (!binding) return null;
    if (binding.kind === 'literal') {
        if (binding.value == null || binding.value === '') return null;
        return previewValue(binding.value, 60);
    }
    if (binding.kind === 'ref') {
        if (!binding.path) return null;
        if (!sampleRoot) return raw ? binding.path : null;
        const v = walkPath(binding.path, sampleRoot);
        if (v === undefined) return raw ? `(no sample for ${binding.path})` : null;
        return previewValue(v, 60);
    }
    if (binding.kind === 'template') {
        if (!binding.value) return null;
        if (!sampleRoot) return raw ? binding.value : null;
        let resolvedAny = false;
        const filled = String(binding.value).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (full, expr) => {
            const v = walkPath(expr.trim(), sampleRoot);
            if (v === undefined) return raw ? full : '…';
            resolvedAny = true;
            return previewValue(v, 24);
        });
        if (!raw && !resolvedAny) return null;
        return previewValue(filled, 60);
    }
    if (binding.kind === 'expr') {
        if (!binding.value) return null;
        if (sampleRoot) {
            const { value, error } = tryEvaluate(binding.value, sampleRoot);
            if (!error && value !== undefined) return previewValue(value, 60);
        }
        return raw ? `expr: ${binding.value}` : null;
    }
    return null;
}
