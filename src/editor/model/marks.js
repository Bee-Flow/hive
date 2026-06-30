/**
 * marks.js — mark helpers: canonical ordering, equality, set algebra.
 *
 * Marks are stored on text nodes as `marks: Mark[]`. A `normalize()` pass keeps
 * them in canonical order so equality and adjacent-run merging are deterministic.
 */
import { MARK_SCHEMA, markOrder, markDefaults } from './schema.js';

/** Create a mark with defaults filled in. */
export function mark(type, attrs) {
  const d = markDefaults(type);
  const a = { ...d, ...(attrs || {}) };
  // Drop attrs that equal their default to keep marks compact & comparable.
  for (const k of Object.keys(a)) {
    if (a[k] === d[k]) delete a[k];
  }
  return Object.keys(a).length ? { type, attrs: a } : { type };
}

/** Deep-ish equality for a single mark (type + attrs). */
export function markEq(a, b) {
  if (a.type !== b.type) return false;
  const aa = a.attrs || {}, ba = b.attrs || {};
  const keys = new Set([...Object.keys(aa), ...Object.keys(ba)]);
  for (const k of keys) {
    if (aa[k] !== ba[k]) return false;
  }
  return true;
}

/** Equality for a whole mark set (order-independent). */
export function sameMarkSet(a = [], b = []) {
  if (a.length !== b.length) return false;
  return a.every((m) => b.some((n) => markEq(m, n)));
}

/** Sort marks into canonical (outermost-first) serialization order. */
export function sortMarks(marks = []) {
  return [...marks].sort((a, b) => markOrder(a.type) - markOrder(b.type));
}

/** Add a mark to a set, replacing any existing mark of the same type, honoring excludes. */
export function addMark(marks = [], m) {
  const excl = new Set(MARK_SCHEMA[m.type]?.excludes || []);
  const kept = marks.filter((x) => x.type !== m.type && !excl.has(x.type));
  // If we're adding an excluded-by mark (e.g. code), drop the others we exclude.
  const filtered = kept.filter((x) => !(MARK_SCHEMA[x.type]?.excludes || []).includes(m.type));
  return sortMarks([...filtered, m]);
}

/** Remove all marks of a given type from a set. */
export function removeMark(marks = [], type) {
  return marks.filter((x) => x.type !== type);
}

/** Does the set contain a mark of this type? */
export function hasMark(marks = [], type) {
  return marks.some((x) => x.type === type);
}

/** Read the (first) mark of a type from a set, or null. */
export function getMark(marks = [], type) {
  return marks.find((x) => x.type === type) || null;
}
