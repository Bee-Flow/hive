// Confirm/discard logic for the in-chat integration draft cards
// (CalendarDraftCard, ContactsDraftCard, KeepDraftCard). Replaces the
// handleConfirm/handleDiscard pair that was copy-pasted per card:
// `confirm(draft, index)` POSTs the draft to the integration's execute
// endpoint and tracks 'executing' → 'done' / 'failed: …' per draft index;
// `discard(index)` marks that index 'discarded'. The per-index status
// state stays lifted in the caller (MessageItem/index.jsx) so it survives
// card re-mounts, and is passed in as the statuses/setStatuses pair.
// Usage:
//
//   const { confirm, discard, getStatus } = useDraftAction({
//       endpoint: '/api/integrations/calendar/execute',
//       statuses: calendarDraftStatuses,
//       setStatuses: setCalendarDraftStatuses,
//   });
//   const status = getStatus(draft, i);   // statuses[i] || draft.status || 'pending'

import { useCallback } from 'react';
import { API_BASE, authFetch } from '../utils/helpers';

export default function useDraftAction({ endpoint, statuses, setStatuses }) {
    const confirm = useCallback(async (draft, index) => {
        setStatuses(prev => ({ ...prev, [index]: 'executing' }));
        try {
            const res = await authFetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(draft),
            });
            if (res.ok) {
                setStatuses(prev => ({ ...prev, [index]: 'done' }));
            } else {
                const err = await res.json();
                setStatuses(prev => ({ ...prev, [index]: `failed: ${err.error}` }));
            }
        } catch (err) {
            setStatuses(prev => ({ ...prev, [index]: `failed: ${err.message}` }));
        }
    }, [endpoint, setStatuses]);

    const discard = useCallback((index) => {
        setStatuses(prev => ({ ...prev, [index]: 'discarded' }));
    }, [setStatuses]);

    const getStatus = useCallback((draft, index) => {
        return statuses[index] || draft.status || 'pending';
    }, [statuses]);

    return { confirm, discard, getStatus };
}
