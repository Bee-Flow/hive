import React from 'react';
import { TextField, IconField, RepeatableList } from '../fields';
import { InlineHint, BackgroundCard } from '../primitives';
import VariantPicker from './VariantPicker';
import { set, SectionHeaderFields, CardActionFields } from './shared';

// ── Security ──────────────────────────────────────────────────────────

export function SecurityEditor({ data = {}, onChange }) {
    const isLedger = data.variant === 'ledger';
    return (
        <>
            <VariantPicker
                type="security"
                value={data.variant}
                onChange={v => onChange(set(data, 'variant', v))}
            />
            <InlineHint>Click any card's title, summary, or detail bullet to edit.</InlineHint>
            <SectionHeaderFields data={data} onChange={onChange} persistScope="security" />
            <RepeatableList
                label="Security cards"
                items={data.cards || []}
                onChange={v => onChange(set(data, 'cards', v))}
                makeNew={() => ({ icon: 'ShieldCheck', title: 'New card', summary: '', details: [], link: { label: '', href: '' }, cardAction: 'none', cardUrl: '', popupEmbed: '' })}
                itemLabel={(item) => item.title || '(no title)'}
                renderItem={(item, update) => (
                    <>
                        <IconField label="Icon" value={item.icon} onChange={v => update({ ...item, icon: v })} />
                        <TextField
                            label="Title"
                            value={item.title || ''}
                            onChange={v => update({ ...item, title: v })}
                            placeholder="Card title"
                            align={item.titleAlign || 'left'}
                            onAlignChange={v => update({ ...item, titleAlign: v })}
                        />
                        <TextField
                            label="Summary"
                            value={item.summary || ''}
                            onChange={v => update({ ...item, summary: v })}
                            placeholder="Short summary"
                            align={item.summaryAlign || 'left'}
                            onAlignChange={v => update({ ...item, summaryAlign: v })}
                        />
                        <RepeatableList
                            label="Detail bullets"
                            items={item.details || []}
                            onChange={v => update({ ...item, details: v })}
                            makeNew={() => 'New detail'}
                            renderItem={(detail, updateDetail) => (
                                // Detail bullets are bare strings in the
                                // array — update(newString) replaces the
                                // string in place at this index.
                                <TextField
                                    label="Text"
                                    value={detail || ''}
                                    onChange={updateDetail}
                                    placeholder="Bullet text"
                                />
                            )}
                            addLabel="Add detail"
                        />
                        {/* Verifiable link — rendered as "→ label" on the
                            ledger row (Ledger layout only; the classic card
                            grid ignores it). */}
                        {isLedger ? (
                            <>
                                <TextField
                                    label="Link label"
                                    value={item.link?.label || ''}
                                    onChange={v => update({ ...item, link: { ...(item.link || {}), label: v } })}
                                    placeholder="e.g. Read the security whitepaper"
                                />
                                <TextField
                                    label="Link URL"
                                    value={item.link?.href || ''}
                                    onChange={v => update({ ...item, link: { ...(item.link || {}), href: v } })}
                                    placeholder="https://…"
                                />
                            </>
                        ) : null}
                        {/* Card action — same toggle as the Features block.
                            none/link/popup drives the renderer's per-card
                            behaviour: link wraps in an <a>; popup opens a
                            sandboxed iframe modal; none leaves the card
                            static. */}
                        <CardActionFields item={item} update={update} />
                    </>
                )}
                addLabel="Add card"
            />
            <BackgroundCard data={data} onChange={onChange} persistKey="blk.security.background" />
        </>
    );
}
