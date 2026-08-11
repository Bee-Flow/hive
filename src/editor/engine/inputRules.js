/**
 * inputRules.js — markdown shortcuts + typography applied as you type.
 *
 * Runs right after an insertText transform; returns a follow-up state or null.
 * Block rules ("# ", "- ", "1. ", "> ", "```") fire at the start of a plain
 * paragraph; typography rules ("--", "...", smart quotes) fire anywhere.
 */
import { getNode, updateAt, parentPath } from './doc.js';
import { inlineToTokens, tokensToInline } from './inline.js';
import { textSelection, pos, isText, isCollapsed } from './selection.js';
import { isTextblock, isCode } from '../model/schema.js';
import * as T from './transforms.js';
import * as Tbl from './tables.js';

export function runInputRules(state, typed) {
  const sel = state.selection;
  if (!isText(sel) || !isCollapsed(sel)) return null;
  const { path, offset } = sel.anchor;
  const block = getNode(state.doc, path);
  if (!isTextblock(block.type)) return null;
  // Code blocks ARE textblocks, so only the block rules were excluded (they
  // check for `paragraph`). Smart quotes turned every string literal typed into
  // a code block into ‘…’, `--` became an en dash in CLI flags, and `:rocket:`
  // became an emoji — silently, and persisted.
  if (isCode(block.type)) return null;
  const toks = inlineToTokens(block.content);
  const prefix = toks.slice(0, offset).map((t) => (t.node ? '￼' : t.ch)).join('');

  // Table cells are kept to a single paragraph on purpose (see the Enter
  // handler in view.js); a block rule turning one into a list or a code block
  // went around that.
  const cellNode = getNode(state.doc, parentPath(path));
  const inCell = cellNode?.type === 'tableCell';

  // "=" as the first character of an OTHERWISE EMPTY table cell starts a
  // formula, the way it does in a spreadsheet. The typed '=' must be the sole
  // content of the cell (nothing after the caret, no other blocks): firing at
  // the start of a non-empty cell handed the cell to setCellFormula, which
  // used to wipe the existing content (S4).
  if (inCell && typed === '=' && prefix === '=' && toks.length === 1
    && block.type === 'paragraph' && (cellNode.content || []).length === 1) {
    return Tbl.setCellFormula(clearPrefix(state, path, offset), '=');
  }

  if (block.type === 'paragraph' && !inCell) {
    if (typed === ' ') {
      const rule = BLOCK_RULES.find(([re]) => re.test(prefix));
      if (rule) { const cleared = clearPrefix(state, path, offset); return rule[1](cleared); }
    }
    if (typed === '`' && prefix === '```') {
      return T.setBlockType(clearPrefix(state, path, offset), 'codeBlock');
    }
  }

  if (typed === ':') {
    const m = prefix.match(/:([a-z0-9_+-]+):$/i);
    const e = m && emojiFor(m[1].toLowerCase());
    if (e) return replaceRange(state, path, offset - m[0].length, offset, e);
  }

  if (typed === '-' || typed === '.' || typed === '"' || typed === "'") {
    return typography(state, path, offset, toks, typed);
  }
  return null;
}

// Common :shortcode: emoji (GitHub-style). Extend as needed.
const EMOJI = {
  rocket: '🚀', fire: '🔥', check: '✅', white_check_mark: '✅', heavy_check_mark: '✔️',
  warning: '⚠️', star: '⭐', brain: '🧠', book: '📖', bulb: '💡', tada: '🎉',
  thumbsup: '👍', '+1': '👍', thumbsdown: '👎', '-1': '👎', eyes: '👀', heart: '❤️',
  smile: '🙂', joy: '😂', bug: '🐛', sparkles: '✨', zap: '⚡', point_right: '👉',
  memo: '📝', pencil: '✏️', calendar: '📅', email: '📧', phone: '📞', moneybag: '💰',
  chart: '📈', chart_with_upwards_trend: '📈', lock: '🔒', key: '🔑', gear: '⚙️',
  wrench: '🔧', hammer: '🔨', package: '📦', clipboard: '📋', mag: '🔍', link: '🔗',
  pushpin: '📌', flag: '🚩', x: '❌', question: '❓', exclamation: '❗', '100': '💯',
  ok: '🆗', rocket_ship: '🚀', clap: '👏', wave: '👋', pray: '🙏', muscle: '💪',
};

// Full shortcode set, from @emoji-mart/data. Loaded lazily on the first
// unrecognised :shortcode: so the emoji dataset never sits in the critical
// path — the curated EMOJI map above answers the common ones synchronously and
// always wins, so the usual cases never wait for this at all.
//
// Consequence worth knowing: the first *exotic* shortcode typed in a session
// resolves to nothing and the user types it again. That is the price of not
// shipping the dataset eagerly, and it beats the old arrangement, where this
// table was the last thing keeping a whole editor framework in the bundle.
let _emojiMap = null;
let _emojiLoading = false;

function loadFullEmojiSet() {
  if (_emojiMap || _emojiLoading) return;
  _emojiLoading = true;
  import('@emoji-mart/data')
    .then((mod) => {
      const data = (mod && mod.default) || mod || {};
      const map = {};
      const nativeOf = (e) => (e && e.skins && e.skins[0] && e.skins[0].native) || null;
      for (const [id, e] of Object.entries(data.emojis || {})) {
        const native = nativeOf(e);
        if (!native) continue;
        const key = id.toLowerCase();
        if (!(key in map)) map[key] = native;
        for (const alias of e.aliases || []) {
          const a = String(alias).toLowerCase();
          if (!(a in map)) map[a] = native;
        }
      }
      // Top-level alias table (alias -> emoji id).
      for (const [alias, id] of Object.entries(data.aliases || {})) {
        const native = nativeOf((data.emojis || {})[id]);
        const a = String(alias).toLowerCase();
        if (native && !(a in map)) map[a] = native;
      }
      _emojiMap = map;
    })
    .catch(() => { _emojiMap = {}; /* degrade to the curated set */ });
}

function emojiFor(name) {
  if (EMOJI[name]) return EMOJI[name];
  if (!_emojiMap) { loadFullEmojiSet(); return null; }
  return _emojiMap[name] || null;
}

const BLOCK_RULES = [
  [/^# $/, (s) => T.setBlockType(s, 'heading', { level: 1 })],
  [/^## $/, (s) => T.setBlockType(s, 'heading', { level: 2 })],
  [/^### $/, (s) => T.setBlockType(s, 'heading', { level: 3 })],
  [/^[-*+] $/, (s) => T.toggleList(s, 'bulletList')],
  [/^1[.)] $/, (s) => T.toggleList(s, 'orderedList')],
  [/^\[[ xX]?\] $/, (s) => T.toggleList(s, 'taskList')],
  [/^> $/, (s) => T.toggleBlockquote(s)],
];

function clearPrefix(state, path, offset) {
  const toks = inlineToTokens(getNode(state.doc, path).content);
  const doc2 = updateAt(state.doc, path, (b) => ({ ...b, content: tokensToInline(toks.slice(offset)) }));
  return { doc: doc2, selection: textSelection(pos(path, 0)), storedMarks: null };
}

function typography(state, path, offset, toks, typed) {
  const before = (n) => toks.slice(Math.max(0, offset - n), offset).map((t) => (t.node ? '' : t.ch)).join('');
  if (typed === '-' && before(2) === '--') return replaceRange(state, path, offset - 2, offset, '–');
  if (typed === '.' && before(3) === '...') return replaceRange(state, path, offset - 3, offset, '…');
  if (typed === '"' || typed === "'") {
    const prev = toks[offset - 2];
    const open = !prev || prev.node || /\s/.test(prev.ch || '');
    const ch = typed === '"' ? (open ? '“' : '”') : (open ? '‘' : '’');
    return replaceRange(state, path, offset - 1, offset, ch);
  }
  return null;
}

function replaceRange(state, path, from, to, str) {
  const toks = inlineToTokens(getNode(state.doc, path).content);
  const marks = toks[from] && !toks[from].node ? toks[from].marks || [] : [];
  const ins = [];
  for (let i = 0; i < str.length; i++) ins.push({ ch: str[i], marks });
  const newToks = [...toks.slice(0, from), ...ins, ...toks.slice(to)];
  const doc2 = updateAt(state.doc, path, (b) => ({ ...b, content: tokensToInline(newToks) }));
  return { doc: doc2, selection: textSelection(pos(path, from + ins.length)), storedMarks: null };
}
