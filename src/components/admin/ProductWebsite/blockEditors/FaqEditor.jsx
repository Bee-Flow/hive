import React from 'react';
import { TextField, RepeatableList } from '../fields';
import { InlineHint, BackgroundCard } from '../primitives';
import { set, SectionHeaderFields } from './shared';

// ── FAQ ───────────────────────────────────────────────────────────────
//
// Controlled accordion (one open at a time; the first item starts open in
// the preview so editors always see an answer). Single layout, no variants.

export function FaqEditor({ data = {}, onChange }) {
    return (
        <>
            <InlineHint>Questions and answers are editable in the preview — open a row to edit its answer inline.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} persistScope="faq" />
            <RepeatableList
                label="Questions"
                items={data.items || []}
                onChange={v => onChange(set(data, 'items', v))}
                makeNew={() => ({ question: 'New question?', answer: '' })}
                itemLabel={(item) => item.question || '(no question)'}
                renderItem={(item, update) => (
                    <>
                        <TextField
                            label="Question"
                            value={item.question || ''}
                            onChange={v => update({ ...item, question: v })}
                            placeholder="What do visitors ask?"
                        />
                        <TextField
                            label="Answer"
                            value={item.answer || ''}
                            onChange={v => update({ ...item, answer: v })}
                            placeholder="Answer it in two or three plain sentences."
                        />
                    </>
                )}
                addLabel="Add question"
            />
            <BackgroundCard data={data} onChange={onChange} persistKey="blk.faq.background" />
        </>
    );
}
