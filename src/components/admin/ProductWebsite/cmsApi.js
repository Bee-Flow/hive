/**
 * CMS API URL builder.
 *
 * Per-site routes use /api/cms/sites/:siteId/* and require an activeSiteId
 * from the panel state. Org-wide routes (enabled flag, default locale,
 * file uploads) live at /api/cms/admin/* — they're not site-specific.
 */
import { API_BASE } from '../../../utils/helpers';

const root = `${API_BASE}/api/cms`;

export const cmsApi = {
    // ── Site management (no siteId required) ──
    listSites:           ()                            => `${root}/sites`,
    createSite:          ()                            => `${root}/sites`,
    // /sites/:siteId → also serves as the SiteDoc / admin payload endpoint
    // for that site (replaces /admin/site).
    site:                (siteId)                      => `${root}/sites/${siteId}`,

    // ── Per-site editor operations ──
    siteLive:            (siteId)                      => `${root}/sites/${siteId}/live`,
    sitePublish:         (siteId)                      => `${root}/sites/${siteId}/publish`,
    siteGraph:           (siteId)                      => `${root}/sites/${siteId}/graph`,
    siteLocaleOverride:  (siteId, locale)              => `${root}/sites/${siteId}/site/locale/${encodeURIComponent(locale)}`,
    pages:               (siteId)                      => `${root}/sites/${siteId}/pages`,
    pagesOrder:          (siteId)                      => `${root}/sites/${siteId}/pages/order`,
    page:                (siteId, pageId)              => `${root}/sites/${siteId}/pages/${pageId}`,
    pageMeta:            (siteId, pageId)              => `${root}/sites/${siteId}/pages/${pageId}/meta`,
    pageHomepage:        (siteId, pageId)              => `${root}/sites/${siteId}/pages/${pageId}/homepage`,
    pageLocaleOverride:  (siteId, pageId, locale)      => `${root}/sites/${siteId}/pages/${pageId}/locale/${encodeURIComponent(locale)}`,

    // ── Org-wide (independent of activeSiteId) ──
    enabled:             ()                            => `${root}/admin/enabled`,
    defaultLocale:       ()                            => `${root}/admin/default-locale`,
    upload:              ()                            => `${root}/admin/upload`,
};
