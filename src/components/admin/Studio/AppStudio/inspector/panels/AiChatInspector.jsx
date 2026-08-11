import React, { useState } from 'react';
import FormField from '../../../../../shared/FormField';
import SegmentedControl from '../../../../../shared/SegmentedControl';
import { KbMultiSelect, ModelTierRow } from '../AiActionEditors';
import { registerInspector } from '../registry';
import { INPUT_CLS, TextAreaField, TextField, usePatch } from './kit';

/**
 * Content panel for the `ai_chat` component. The generic SpecPanel can't render
 * a model-tier picker or a knowledge-base multiselect, so this panel reuses the
 * same controls the AI actions use (AiActionEditors) — one tier/KB UX across
 * every AI surface in App Studio.
 */

const MODES = [
    { value: 'chat', label: 'Conversation' },
    { value: 'assistant', label: 'Single question' },
];

const MAX_STARTERS = 6;

export default function AiChatInspector({ node, definition, onCommit, disabled = false }) {
    const props = node.props || {};
    const patch = usePatch(node, definition, onCommit);
    const starters = Array.isArray(props.starters) ? props.starters : [];
    // The textarea keeps its own text: the prop drops blank lines, so joining
    // it back would eat the newline the moment Enter starts a second starter.
    const [startersText, setStartersText] = useState(() => starters.join('\n'));
    const [textFor, setTextFor] = useState(node.id);
    if (textFor !== node.id) {
        setTextFor(node.id);
        setStartersText(starters.join('\n'));
    }

    return (
        <div className="flex flex-col gap-4">
            <TextAreaField
                label="System prompt"
                value={props.systemPrompt}
                onChange={(v) => patch({ systemPrompt: v })}
                rows={4}
                placeholder="You are a support assistant for our returns policy…"
                disabled={disabled}
            />
            <ModelTierRow value={props.modelTier} onChange={(t) => patch({ modelTier: t })} disabled={disabled} />
            <KbMultiSelect value={props.knowledgeBaseIds} onChange={(ids) => patch({ knowledgeBaseIds: ids })} disabled={disabled} />
            <FormField label="Mode" hint="A conversation keeps history; a single question answers each one on its own.">
                <SegmentedControl
                    value={props.mode ?? 'chat'}
                    onChange={(v) => patch({ mode: v })}
                    options={MODES}
                    size="sm"
                    fullWidth
                    disabled={disabled}
                    ariaLabel="Chat mode"
                />
            </FormField>
            <TextField
                label="Greeting"
                value={props.greeting}
                onChange={(v) => patch({ greeting: v })}
                placeholder="Ask me anything."
                disabled={disabled}
            />
            <TextField
                label="Input placeholder"
                value={props.placeholder}
                onChange={(v) => patch({ placeholder: v })}
                placeholder="Ask a question…"
                disabled={disabled}
            />
            <FormField label="Starter questions" hint="One per line — shown before the first message.">
                <textarea
                    className={`${INPUT_CLS} min-h-[64px]`}
                    value={startersText}
                    onChange={(e) => {
                        setStartersText(e.target.value);
                        patch({
                            starters: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, MAX_STARTERS),
                        });
                    }}
                    rows={3}
                    disabled={disabled}
                    aria-label="Starter questions"
                />
            </FormField>
        </div>
    );
}

registerInspector('ai_chat', AiChatInspector);
