/**
 * Self-hosted models must survive the model-visibility pipeline.
 *
 * VISIBLE_MODELS is a hand-curated allow-list of cloud model ids shipped with
 * the product, so it can NEVER contain a model a customer pulled onto their own
 * box — filterVisibleModels dropped every local model, which meant a connected
 * Ollama looked empty in the agent designer even though the tier picker (which
 * doesn't use that filter) listed the same models fine.
 *
 * Run: cd agent-hub && npx vitest run src/utils/modelMeta.local.test.js
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { filterVisibleModels, getModelDisplayName, getModelFamily } from './modelMeta';

const local = (id, extra = {}) => ({ id, name: id, local: true, cat: 'Reasoning', ...extra });

beforeEach(() => localStorage.clear());

describe('filterVisibleModels with self-hosted models', () => {
    it('keeps local models even though they are not in the curated allow-list', () => {
        const models = [local('qwen3:30b-a3b'), { id: 'gpt-4o', name: 'gpt-4o' }, { id: 'not-a-real-model' }];
        const visible = filterVisibleModels(models).map(m => m.id);
        expect(visible).toContain('qwen3:30b-a3b');
        expect(visible).toContain('gpt-4o');          // curated cloud model, unchanged
        expect(visible).not.toContain('not-a-real-model');
    });

    it('still honours the manual hide list for local models', () => {
        localStorage.setItem('hiddenModels', JSON.stringify({ 'qwen3:30b-a3b': true }));
        const visible = filterVisibleModels([local('qwen3:30b-a3b'), local('llama3.2:3b')]).map(m => m.id);
        expect(visible).toEqual(['llama3.2:3b']);
    });

    it('still honours per-agent-type restrictions for local models', () => {
        const models = [local('qwen3:8b'), local('llama3.2:3b')];
        const visible = filterVisibleModels(models, 'chat', { chat: ['qwen3:8b'] }).map(m => m.id);
        expect(visible).toEqual(['qwen3:8b']);
    });

    it('carries the server-derived label and category through', () => {
        const [model] = filterVisibleModels([local('qwen3:30b', { name: 'qwen3:30b (30.5B, Q4_K_M)' })]);
        expect(model.name).toBe('qwen3:30b (30.5B, Q4_K_M)');
        expect(model.cat).toBe('Reasoning');
        expect(model.desc).toBe('Self-hosted');
    });
});

describe('getModelDisplayName', () => {
    it('never title-cases a self-hosted tag — the tag is what the admin recognises', () => {
        // formatModelId would turn this into "Qwen3:30b A3b".
        expect(getModelDisplayName(local('qwen3:30b-a3b'))).toBe('qwen3:30b-a3b');
    });

    it('prefers the server label when the runtime reported a size', () => {
        expect(getModelDisplayName(local('qwen3:30b', { name: 'qwen3:30b (30.5B, Q4_K_M)' })))
            .toBe('qwen3:30b (30.5B, Q4_K_M)');
    });

    it('a user alias still wins over everything', () => {
        localStorage.setItem('modelAliases', JSON.stringify({ 'qwen3:8b': 'House model' }));
        expect(getModelDisplayName(local('qwen3:8b'))).toBe('House model');
    });

    it('leaves cloud model naming untouched', () => {
        expect(getModelDisplayName('claude-sonnet-5')).toBe('Claude Sonnet 5');
    });
});

describe('getModelFamily', () => {
    it('buckets open-weight families so the picker filter chips are useful', () => {
        // The same weights arrive under three id shapes depending on runtime.
        expect(getModelFamily('qwen3:30b-a3b')).toBe('Qwen');
        expect(getModelFamily('Qwen/Qwen3-30B-A3B')).toBe('Qwen');
        expect(getModelFamily('Qwen3-30B-A3B-Q4_K_M.gguf')).toBe('Qwen');
        expect(getModelFamily('deepseek-r1:32b')).toBe('DeepSeek');
        expect(getModelFamily('gpt-oss:120b')).toBe('gpt-oss');
        expect(getModelFamily('nomic-embed-text')).toBe('Embedding');
    });

    it('does not steal models the cloud buckets already claim', () => {
        expect(getModelFamily('gpt-5.2')).toBe('GPT-5');
        expect(getModelFamily('claude-opus-4-8')).toBe('Claude');
        expect(getModelFamily('mistral-large-latest')).toBe('Mistral Large');
    });
});
