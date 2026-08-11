// Shared workspace → notebook loader. Replaces three copy-pasted blocks in
// AgentHub.jsx that each did the same thing:
//   GET the conversation's /workspace, then sync the linked notebook id and
//   the editor content, and show/hide the notebook pane depending on whether
//   the workspace had any content.
//
// The three copies — agent-conversation select, direct-conversation select,
// and the URL-deeplink auto-load — had drifted. The deeplink copy was missing
// the else-branch that clears the editor and hides the pane for an EMPTY
// workspace, so deeplinking into a conversation without a notebook left a
// stale notebook from a previously-open conversation on screen. Centralising
// the apply logic here keeps all three identical.
//
// Usage:
//   await loadWorkspaceNotebook(
//       `${API_BASE}/agents/${agentId}/conversations/${convId}/workspace`,
//       { setNotebookLinkedId, setNotebookContent, setShowNotebook },
//       { logLabel: 'Failed to fetch notebook' },
//   );

import { authFetch } from './helpers';

/**
 * Applies a parsed /workspace response to the notebook UI state. Shows the
 * pane with its content when the workspace is non-empty; otherwise clears the
 * editor and hides the pane. Always syncs the linked notebook id.
 *
 * @param {{ content?: string, notebookId?: string|null }} wsData Parsed response body.
 * @param {object} setters
 * @param {(id: string|null) => void} setters.setNotebookLinkedId
 * @param {(content: string) => void} setters.setNotebookContent
 * @param {(show: boolean) => void} setters.setShowNotebook
 */
export function applyWorkspaceResponse(wsData, { setNotebookLinkedId, setNotebookContent, setShowNotebook }) {
    const convContent = wsData?.content || '';
    setNotebookLinkedId(wsData?.notebookId || null);
    if (convContent.trim().length > 0) {
        setNotebookContent(convContent);
        setShowNotebook(true);
    } else {
        // New / empty conversation has no notebook — hide and clear so a
        // previously-open notebook doesn't linger on screen.
        setNotebookContent('');
        setShowNotebook(false);
    }
}

/**
 * Fetches a conversation's /workspace and applies it via applyWorkspaceResponse.
 * Fetch/parse errors are logged (using `logLabel`) and swallowed so a failed
 * workspace load never breaks conversation loading; the existing notebook is
 * left untouched on error.
 *
 * @param {string} url Full /workspace endpoint URL.
 * @param {object} setters See applyWorkspaceResponse.
 * @param {{ logLabel?: string }} [options]
 * @returns {Promise<void>}
 */
export async function loadWorkspaceNotebook(url, setters, { logLabel = 'Failed to fetch notebook' } = {}) {
    try {
        const wsRes = await authFetch(url);
        if (!wsRes.ok) return;
        const wsData = await wsRes.json();
        applyWorkspaceResponse(wsData, setters);
    } catch (err) {
        console.error(logLabel, err);
    }
}
