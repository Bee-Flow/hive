/**
 * EditorToolbar — the persistent hybrid menu on top of the editor: a compact
 * icon toolbar (undo/redo + marks) plus labelled dropdowns (Turn into, Align,
 * Colour, Insert, Table, AI), with word-count + save state on the right.
 *
 * It is the PRIMARY editing surface; the floating FormatBubble and `/` slash menu
 * remain as shortcuts. Every action goes through the shared editor facade
 * (`editor.chain().focus()…run()`) — no engine coupling — so it works unchanged
 * for any engine. Below desktop width the marks + Align + Colour collapse into a
 * single "Format" dropdown; the row also scrolls horizontally as a last resort.
 */
import React, { useState } from 'react';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Highlighter,
  Link as LinkIcon, Undo, Redo, Plus, ChevronDown, FileUp, AlignLeft, Palette,
  Wand2, RefreshCw, Scissors, Expand, Table2, Pilcrow, Loader2,
  Rows3, Columns3, Trash2, Heading, Sigma,
} from 'lucide-react';
import { useViewport } from '../../hooks/useViewport';
import {
  Btn, Dropdown, Item, MenuDivider, MenuLabel, mkTt,
  TurnIntoItems, AlignItems, ColorFontPanel,
} from './toolbarPrimitives.jsx';

/* Inline marks row — reused inline (desktop) and inside the Format menu (compact). */
function MarkButtons({ editor, t }) {
  const tt = mkTt(t);
  const chain = () => editor.chain().focus();
  return (
    <>
      <Btn onClick={() => chain().toggleBold().run()} active={editor.isActive('bold')} icon={Bold} title={tt('notebooks.bold', 'Bold')} />
      <Btn onClick={() => chain().toggleItalic().run()} active={editor.isActive('italic')} icon={Italic} title={tt('notebooks.italic', 'Italic')} />
      <Btn onClick={() => chain().toggleUnderline().run()} active={editor.isActive('underline')} icon={UnderlineIcon} title={tt('notebooks.underline', 'Underline')} />
      <Btn onClick={() => chain().toggleStrike().run()} active={editor.isActive('strike')} icon={Strikethrough} title={tt('notebooks.strikethrough', 'Strikethrough')} />
      <Btn onClick={() => chain().toggleCode().run()} active={editor.isActive('code')} icon={Code} title={tt('notebooks.inline_code', 'Inline code')} />
      <Btn onClick={() => chain().toggleHighlight().run()} active={editor.isActive('highlight')} icon={Highlighter} title={tt('notebooks.highlight', 'Highlight')} />
      <Btn onClick={() => { const url = window.prompt(tt('notebooks.url', 'URL')); if (url) chain().setLink({ href: url }).run(); }} active={editor.isActive('link')} icon={LinkIcon} title={tt('notebooks.insert_link', 'Insert link')} />
    </>
  );
}

/* Drag/hover grid to choose table dimensions before inserting. */
function TableSizePicker({ tt, onPick }) {
  const MAX_R = 8;
  const MAX_C = 10;
  const [hover, setHover] = useState({ r: 0, c: 0 });
  return (
    <div className="p-2" onMouseLeave={() => setHover({ r: 0, c: 0 })}>
      <div className="text-[10px] mb-1.5 text-center" style={{ color: 'var(--text-secondary)' }}>
        {hover.r > 0 ? `${hover.r} × ${hover.c}` : tt('notebooks.pick_table_size', 'Pick a size')}
      </div>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${MAX_C}, 14px)` }}>
        {Array.from({ length: MAX_R * MAX_C }).map((_, i) => {
          const r = Math.floor(i / MAX_C) + 1;
          const c = (i % MAX_C) + 1;
          const on = r <= hover.r && c <= hover.c;
          return (
            <button
              key={i}
              onMouseEnter={() => setHover({ r, c })}
              onMouseDown={(e) => { e.preventDefault(); onPick(r, c); }}
              className="w-3.5 h-3.5 rounded-[3px] border transition-colors"
              style={{ background: on ? 'var(--accent-primary)' : 'var(--bg-tertiary)', borderColor: on ? 'var(--accent-primary)' : 'var(--border-subtle)' }}
              aria-label={`${r} × ${c}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function TurnIntoTrigger({ editor, t }) {
  const tt = mkTt(t);
  const label = editor.isActive('heading', { level: 1 }) ? 'H1'
    : editor.isActive('heading', { level: 2 }) ? 'H2'
    : editor.isActive('heading', { level: 3 }) ? 'H3'
    : editor.isActive('bulletList') ? '•'
    : editor.isActive('orderedList') ? '1.'
    : editor.isActive('taskList') ? '☑'
    : editor.isActive('blockquote') ? '❝'
    : tt('notebooks.paragraph', 'Text');
  return (
    <Dropdown trigger={(open, setOpen) => (
      <button onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]" title={tt('notebooks.turn_into', 'Turn into')}>
        <Pilcrow className="w-3.5 h-3.5" /> <span className="min-w-[14px] text-center">{label}</span><ChevronDown className="w-3 h-3 opacity-50" />
      </button>
    )}>
      {(setOpen) => <TurnIntoItems editor={editor} t={t} onDone={() => setOpen(false)} />}
    </Dropdown>
  );
}

export default function EditorToolbar({
  editor, t, insertItems, onInsert, onImportClick, onAIFill, aiFilling,
  askAiEnabled, saving, wordCount, onAIAction, onAsk, hasSelection,
  // Table extras filled in by later phases (formula / chart / collapse).
  tableMenuExtras,
}) {
  const { isDesktop } = useViewport();
  const compact = !isDesktop;
  const tt = mkTt(t);
  const chain = () => editor.chain().focus();
  const align = (a) => editor.isActive({ align: a });
  const currentColor = editor.getAttributes('textStyle').color || null;
  const currentFont = editor.getAttributes('textStyle').fontFamily || null;
  const inTable = editor.isActive('table');

  return (
    <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 border-b overflow-x-auto custom-scrollbar"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
      role="toolbar" aria-label={tt('notebooks.toolbar', 'Editor toolbar')}>
      {/* undo / redo */}
      <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg shrink-0" style={{ background: 'var(--bg-tertiary)' }}>
        <Btn onClick={() => chain().undo().run()} disabled={!editor.can().undo()} icon={Undo} title={tt('notebooks.undo', 'Undo')} />
        <Btn onClick={() => chain().redo().run()} disabled={!editor.can().redo()} icon={Redo} title={tt('notebooks.redo', 'Redo')} />
      </div>

      {/* inline marks (desktop) */}
      {!compact && (
        <div className="flex items-center gap-0.5 shrink-0">
          <Divider />
          <MarkButtons editor={editor} t={t} />
        </div>
      )}

      <Divider />
      <div className="shrink-0"><TurnIntoTrigger editor={editor} t={t} /></div>

      {/* align + colour (desktop) */}
      {!compact && (
        <>
          <Dropdown trigger={(open, setOpen) => (
            <button onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }} className={`flex items-center gap-0.5 p-1.5 rounded-md shrink-0 ${align('center') || align('right') ? 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`} title={tt('notebooks.alignment', 'Alignment')}>
              <AlignLeft className="w-3.5 h-3.5" /><ChevronDown className="w-2.5 h-2.5 opacity-50" />
            </button>
          )}>
            {(setOpen) => <AlignItems editor={editor} t={t} onDone={() => setOpen(false)} />}
          </Dropdown>

          <Dropdown trigger={(open, setOpen) => (
            <button onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }} className={`flex items-center gap-1 p-1.5 rounded-md shrink-0 hover:bg-[var(--bg-tertiary)] ${currentColor || currentFont ? 'bg-[var(--accent-primary)]/10' : ''}`} title={tt('notebooks.text_style', 'Text style')}>
              <Palette className="w-3.5 h-3.5" style={{ color: currentColor || 'currentColor' }} /><ChevronDown className="w-2.5 h-2.5 opacity-50" />
            </button>
          )}>
            {(setOpen) => <ColorFontPanel editor={editor} t={t} onDone={() => setOpen(false)} />}
          </Dropdown>
        </>
      )}

      {/* compact: marks + align + colour collapse into one Format menu */}
      {compact && (
        <Dropdown trigger={(open, setOpen) => (
          <button onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] shrink-0" title={tt('notebooks.format', 'Format')}>
            <Palette className="w-3.5 h-3.5" /><ChevronDown className="w-3 h-3 opacity-50" />
          </button>
        )}>
          {(setOpen) => (
            <div className="min-w-[210px]">
              <div className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"><MarkButtons editor={editor} t={t} /></div>
              <MenuDivider />
              <MenuLabel>{tt('notebooks.alignment', 'Alignment')}</MenuLabel>
              <AlignItems editor={editor} t={t} onDone={() => setOpen(false)} />
              <MenuDivider />
              <ColorFontPanel editor={editor} t={t} onDone={() => setOpen(false)} />
            </div>
          )}
        </Dropdown>
      )}

      <Divider />

      {/* Insert */}
      <Dropdown trigger={(open, setOpen) => (
        <button onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] shrink-0" title={tt('notebooks.insert', 'Insert')}>
          <Plus className="w-3.5 h-3.5" /> {tt('notebooks.insert', 'Insert')} <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      )}>
        {(setOpen) => (
          <>
            {insertItems.map((it) => (
              <Item key={it.key} icon={it.icon} label={it.label} onClick={() => { onInsert(it); setOpen(false); }} />
            ))}
            {onImportClick && (
              <>
                <MenuDivider />
                <Item icon={FileUp} label={tt('notebooks.import_file', 'Import file')} onClick={() => { onImportClick(); setOpen(false); }} />
              </>
            )}
          </>
        )}
      </Dropdown>

      {/* Table */}
      <Dropdown trigger={(open, setOpen) => (
        <button onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }} className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium shrink-0 hover:bg-[var(--bg-tertiary)] ${inTable ? 'text-[var(--accent-primary)]' : 'text-[var(--text-secondary)]'}`} title={tt('notebooks.table', 'Table')}>
          <Table2 className="w-3.5 h-3.5" /> {tt('notebooks.table', 'Table')} <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      )}>
        {(setOpen) => (
          <div className="min-w-[180px]">
            <MenuLabel>{tt('notebooks.insert_table', 'Insert table')}</MenuLabel>
            <TableSizePicker tt={tt} onPick={(rows, cols) => { chain().insertTable({ rows, cols, withHeaderRow: true }).run(); setOpen(false); }} />
            <MenuDivider />
            <MenuLabel>{tt('notebooks.table_rows_cols', 'Rows & columns')}</MenuLabel>
            <Item icon={Rows3} label={tt('notebooks.row_above', 'Insert row above')} disabled={!inTable} onClick={() => { chain().addRowBefore().run(); setOpen(false); }} />
            <Item icon={Rows3} label={tt('notebooks.row_below', 'Insert row below')} disabled={!inTable} onClick={() => { chain().addRowAfter().run(); setOpen(false); }} />
            <Item icon={Columns3} label={tt('notebooks.col_left', 'Insert column left')} disabled={!inTable} onClick={() => { chain().addColumnBefore().run(); setOpen(false); }} />
            <Item icon={Columns3} label={tt('notebooks.col_right', 'Insert column right')} disabled={!inTable} onClick={() => { chain().addColumnAfter().run(); setOpen(false); }} />
            <Item icon={Trash2} label={tt('notebooks.delete_row', 'Delete row')} danger disabled={!inTable} onClick={() => { chain().deleteRow().run(); setOpen(false); }} />
            <Item icon={Trash2} label={tt('notebooks.delete_col', 'Delete column')} danger disabled={!inTable} onClick={() => { chain().deleteColumn().run(); setOpen(false); }} />
            <MenuDivider />
            <Item icon={Heading} label={tt('notebooks.toggle_header_row', 'Toggle header row')} disabled={!inTable} onClick={() => { chain().toggleHeaderRow().run(); setOpen(false); }} />
            <Item icon={Sigma} label={tt('notebooks.insert_formula', 'Insert formula')} disabled={!inTable} onClick={() => { chain().setCellFormula('=').run(); setOpen(false); }} />
            <MenuLabel>{tt('notebooks.cell_align', 'Cell alignment')}</MenuLabel>
            <AlignItems editor={editor} t={t} onDone={() => setOpen(false)} />
            {tableMenuExtras && tableMenuExtras({ inTable, setOpen })}
            <MenuDivider />
            <Item icon={Trash2} label={tt('notebooks.delete_table', 'Delete table')} danger disabled={!inTable} onClick={() => { chain().deleteTable().run(); setOpen(false); }} />
          </div>
        )}
      </Dropdown>

      {/* AI */}
      {askAiEnabled && (onAIFill || onAIAction) && (
        <Dropdown trigger={(open, setOpen) => (
          <button onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }} className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium shrink-0 hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--accent-primary)' }} title={tt('notebooks.ai', 'AI')}>
            <Wand2 className="w-3.5 h-3.5" /> {tt('notebooks.ai', 'AI')} <ChevronDown className="w-3 h-3 opacity-50" />
          </button>
        )}>
          {(setOpen) => (
            <>
              {onAIFill && <Item icon={aiFilling ? Loader2 : Wand2} spin={aiFilling} label={tt('notebooks.ai_fill', 'AI fill document')} disabled={aiFilling} onClick={() => { onAIFill(); setOpen(false); }} />}
              {onAIAction && (
                <>
                  <MenuDivider />
                  <MenuLabel>{tt('notebooks.ai_on_selection', 'On selection')}</MenuLabel>
                  <Item icon={RefreshCw} label={tt('notebooks.ai_action_rewrite', 'Rewrite')} disabled={!hasSelection} onClick={() => { onAIAction('rewrite'); setOpen(false); }} />
                  <Item icon={Scissors} label={tt('notebooks.ai_action_shorten', 'Shorten')} disabled={!hasSelection} onClick={() => { onAIAction('shorten'); setOpen(false); }} />
                  <Item icon={Expand} label={tt('notebooks.ai_action_expand', 'Expand')} disabled={!hasSelection} onClick={() => { onAIAction('expand'); setOpen(false); }} />
                  {onAsk && <Item icon={Wand2} label={tt('notebooks.ask_ai', 'Ask AI')} disabled={!hasSelection} onClick={() => { onAsk(); setOpen(false); }} />}
                </>
              )}
            </>
          )}
        </Dropdown>
      )}

      <div className="flex-1 min-w-[8px]" />
      <span className="hidden sm:inline text-[10px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>{wordCount} {tt('notebooks.words', 'words')}</span>
      {saving && <span className="text-[10px] animate-pulse ml-1 shrink-0" style={{ color: 'var(--accent-primary)' }}>{tt('notebooks.saving', 'Saving…')}</span>}
    </div>
  );
}

function Divider() {
  return <div className="w-px h-5 mx-0.5 shrink-0" style={{ background: 'var(--border-subtle)' }} />;
}
