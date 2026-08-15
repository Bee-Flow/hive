/**
 * Whether the Chat ⇄ Cowork switch is shown at all — the rule, without a
 * layout opinion.
 *
 * It used to be `CoworkModeTopBar`: a centred band of its own between the
 * header and the thread. That put a third horizontal rule on a page that
 * already had two, and floated the one control that changes what the composer
 * *does* far away from the header where every other mode control lives. It now
 * renders inline, next to Notebook and Webpage, and the caller places it.
 *
 * It disappears once the thread has a message in it. Chat and Cowork produce
 * different things — a conversation vs. a scheduled run — and there is no
 * sensible way to convert one into the other halfway through, so the first
 * message settles it. Starting a new chat is how you pick again.
 */
import React from 'react';
import CoworkModeSwitch from './CoworkModeSwitch';

export default function CoworkModeToggle({
    enabled = false,
    value = 'chat',
    onChange,
    locked = false,
}) {
    if (!enabled || locked) return null;
    // Always compact: the header's own buttons are px-3/py-1.5/text-xs, and the
    // roomier 'md' size made the switch the tallest thing in the row.
    return <CoworkModeSwitch value={value} onChange={onChange} size="sm" />;
}
