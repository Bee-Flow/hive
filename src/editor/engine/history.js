/**
 * history.js — snapshot undo/redo with typing coalescing.
 *
 * Because transforms use structural sharing, a "snapshot" is just a reference to
 * the previous { doc, selection } — cheap. Consecutive `type` transactions within
 * a short window coalesce so undo removes a run, not one character.
 */
export function createHistory() {
  return { done: [], undone: [], lastKind: null, lastTime: 0 };
}

const COALESCE_MS = 400;
const CAP = 250;

/** Record `prevState` before a transaction of `kind` applied at `time` (ms). */
export function record(history, prevState, kind, time) {
  const coalesce = kind === 'type' && history.lastKind === 'type' && time - history.lastTime < COALESCE_MS;
  if (!coalesce) {
    history.done.push(prevState);
    if (history.done.length > CAP) history.done.shift();
  }
  history.undone = [];
  history.lastKind = kind;
  history.lastTime = time;
}

export function canUndo(history) { return history.done.length > 0; }
export function canRedo(history) { return history.undone.length > 0; }

export function undo(history, current) {
  if (!history.done.length) return null;
  const prev = history.done.pop();
  history.undone.push(current);
  history.lastKind = null;
  return prev;
}

export function redo(history, current) {
  if (!history.undone.length) return null;
  const next = history.undone.pop();
  history.done.push(current);
  history.lastKind = null;
  return next;
}
