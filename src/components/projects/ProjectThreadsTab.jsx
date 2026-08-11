import { MessageSquare, Lock, Users, Loader2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Conversations shared into this project.
 *
 * This is the surface the whole feature exists for: before it, a project's
 * "chats" were a client-side filter over YOUR OWN conversations, so two people
 * in the same project each saw only their own and neither knew the other's
 * existed.
 *
 * A shared thread is readable by every member and postable-into by editors. It
 * is NOT the same as a chat merely filed under the project — filing is private
 * bookkeeping, sharing is an explicit act with an encryption consequence, and
 * conflating the two would publish people's chats without them asking.
 */
export default function ProjectThreadsTab({
    threads,
    loading,
    role,
    currentUserId,
    activeRuns = {},
    onOpenThread,
    onUnshare,
}) {
    const { t } = useTranslation();
    const canPost = role === 'owner' || role === 'editor';

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16" style={{ color: 'var(--text-tertiary)' }}>
                <Loader2 className="w-5 h-5 animate-spin" />
            </div>
        );
    }

    if (!threads || threads.length === 0) {
        return (
            <div className="text-center py-16 px-6">
                <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-40" style={{ color: 'var(--text-tertiary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('projects.no_shared_threads')}
                </p>
                {/* The constraint is technical as well as editorial, so say it
                    here rather than letting someone discover it as a failure. */}
                <p className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {t('projects.share_owner_only')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                {canPost
                    ? t('projects.shared_threads_editor_hint', 'Everyone in this project can read these. Editors can reply.')
                    : t('projects.viewer_readonly')}
            </p>

            {threads.map((thread) => {
                const isMine = thread.ownerId === currentUserId;
                const running = activeRuns[thread.id];
                return (
                    <div
                        key={thread.id}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group"
                        style={{ background: 'var(--bg-secondary)' }}
                    >
                        <button
                            onClick={() => onOpenThread?.(thread)}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                            <MessageSquare className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                            <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                {thread.title || t('sidebar.untitled_chat')}
                            </span>
                            {/* Who owns it matters here in a way it never did in
                                a single-owner list. */}
                            {!isMine && (
                                <span className="text-[10px] px-1.5 py-px rounded flex-shrink-0"
                                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
                                    <Users className="w-3 h-3 inline mr-0.5" />
                                    {thread.ownerName || t('projects.shared_by_colleague', 'shared')}
                                </span>
                            )}
                            {running && (
                                <span className="text-[10px] px-1.5 py-px rounded flex-shrink-0 flex items-center gap-1"
                                      style={{ background: 'var(--accent-primary)20', color: 'var(--accent-primary)' }}>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {t('projects.run_active', 'answering…')}
                                </span>
                            )}
                        </button>

                        {/* Unsharing re-encrypts back to the owner's key, so only
                            the owner can do it — the same reason only they can
                            share. Hidden rather than shown-and-403'd. */}
                        {isMine && (
                            <button
                                onClick={() => onUnshare?.(thread)}
                                className="opacity-0 group-hover:opacity-100 text-xs px-2 py-1 rounded transition-opacity flex items-center gap-1"
                                style={{ color: 'var(--text-tertiary)' }}
                                title={t('projects.unshare_thread')}
                            >
                                <Lock className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
