import React, { useCallback, useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import useTranslation from '../../hooks/useTranslation';
import * as api from '../../pages/meeting-notes/lib/transcriptionsApi';
import TemplateManager from '../../pages/meeting-notes/detail/TemplateManager';

/**
 * Org-admin panel: manage organization-wide and group summary templates in one
 * place. Mirrors the org-scoped MeetingNotesAdminPanel pattern. Self-hides when
 * the caller is not an org admin (the /org endpoint 403s) or Meeting Notes
 * isn't licensed.
 */
export default function SummaryTemplatesAdminPanel() {
    const { t } = useTranslation();
    const [org, setOrg] = useState(null);      // { orgId, templates, groups }
    const [builtins, setBuiltins] = useState([]);
    const [available, setAvailable] = useState(true);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        try {
            const [orgData, list] = await Promise.all([
                api.listOrgSummaryTemplates(),
                api.listSummaryTemplates().catch(() => null),
            ]);
            setOrg(orgData);
            if (list?.builtins) setBuiltins(list.builtins);
        } catch (_) {
            setAvailable(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);

    if (loading) return null;
    if (!available) return null;

    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" style={{ color: 'var(--accent-primary)' }} />
                <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    {t('meeting_notes.template_org_title', 'Organization summary templates')}
                </p>
            </div>
            <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
                {t('meeting_notes.template_org_desc', 'Add Meeting Notes summary styles for your whole organization or a specific group. Members pick them from the Regenerate menu; a default is applied to new meetings automatically.')}
            </p>

            <TemplateManager
                templates={org?.templates || []}
                builtins={builtins}
                canManageOrg
                defaultScope="org"
                groups={org?.groups || []}
                emptyHint={t('meeting_notes.template_org_empty', 'No organization or group templates yet.')}
                onReload={reload}
            />
        </div>
    );
}
