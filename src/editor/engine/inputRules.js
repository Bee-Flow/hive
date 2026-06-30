/**
 * inputRules.js — markdown shortcuts + typography applied as you type.
 *
 * Runs right after an insertText transform; returns a follow-up state or null.
 * Block rules ("# ", "- ", "1. ", "> ", "```") fire at the start of a plain
 * paragraph; typography rules ("--", "...", smart quotes) fire anywhere.
 */
import { gitHubEmojis } from '@tiptap/extension-emoji';
import { getNode, updateAt } from './doc.js';
import { inlineToTokens, tokensToInline } from './inline.js';
import { textSelection, pos, isText, isCollapsed } from './selection.js';
import { isTextblock } from '../model/schema.js';
import * as T from './transforms.js';

export function runInputRules(state, typed) {
  const sel = state.selection;
  if (!isText(sel) || !isCollapsed(sel)) return null;
  const { path, offset } = sel.anchor;
  const block = getNode(state.doc, path);
  if (!isTextblock(block.type)) return null;
  const toks = inlineToTokens(block.content);
  const prefix = toks.slice(0, offset).map((t) => (t.node ? '￼' : t.ch)).join('');

  if (block.type === 'paragraph') {
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

// Full GitHub shortcode set (same data the old editor used), built lazily and
// merged over the curated EMOJI map above (which wins for the common aliases).
let _emojiMap;
function emojiFor(name) {
  if (EMOJI[name]) return EMOJI[name];
  if (!_emojiMap) {
    _emojiMap = {};
    try {
      for (const it of gitHubEmojis || []) {
        if (!it || !it.emoji) continue;
        for (const sc of [it.name, ...(it.shortcodes || [])]) {
          if (sc) { const k = sc.toLowerCase(); if (!(k in _emojiMap)) _emojiMap[k] = it.emoji; }
        }
      }
    } catch (e) { /* degrade to the curated set */ }
  }
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
