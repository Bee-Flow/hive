// Shared "create knowledge base" form — replaces the near-identical inline
// create-KB blocks that were copy-pasted into KnowledgePanel, ProjectDetailPage
// and KnowledgeBasesSection (name input + description input + Cancel/Create
// buttons). Wire it to the useKnowledgeBases hook's create state:
//
//   const kb = useKnowledgeBases(...);
//   {kb.showCreateKB && (
//       <CreateKBModal
//           name={kb.newKBName} onNameChange={kb.setNewKBName}
//           description={kb.newKBDesc} onDescChange={kb.setNewKBDesc}
//           creating={kb.creatingKB} onCreate={kb.createKB} onCancel={kb.cancelCreateKB}
//       />
//   )}
//
// It is a presentational inline panel (the callers render it inside their own
// expand/collapse region); the container look can be tuned per consumer via
// `className`, `title`, and the placeholder props while keeping the shared
// input/button markup.

import React from 'react';

export default function CreateKBModal({
    name,
    onNameChange,
    description,
    onDescChange,
    onCreate,
    onCancel,
    creating = false,
    title,
    namePlaceholder = 'Knowledge base name',
    descPlaceholder = 'Description (optional)',
    className = 'p-4 rounded-xl border bg-[var(--bg-tertiary)] border-[var(--border-default)] space-y-3',
}) {
    const fieldStyle = { background: 'var(--bg-secondary)', borderColor: 'var(--border-default)', color: 'var(--text-primary)' };
    return (
        <div className={className}>
            {title && (
                <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</h4>
            )}
            <input value={name} onChange={e => onNameChange(e.target.value)}
                placeholder={namePlaceholder} autoFocus
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={fieldStyle} />
            <input value={description} onChange={e => onDescChange(e.target.value)}
                placeholder={descPlaceholder}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={fieldStyle} />
            <div className="flex gap-2 justify-end">
                <button onClick={onCancel}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                    style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                    Cancel
                </button>
                <button onClick={onCreate} disabled={creating || !name.trim()}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: 'var(--accent-primary)' }}>
                    {creating ? 'Creating...' : 'Create'}
                </button>
            </div>
        </div>
    );
}
