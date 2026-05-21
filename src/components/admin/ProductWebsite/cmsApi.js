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
    // Import a previously-exported site (POST JSON body). Always
    // creates a NEW siteId — never overwrites an existing one.
    importSite:          ()                            => `${root}/sites/import`,
    // /sites/:siteId → also serves as the SiteDoc / admin payload endpoint
    // for that site (replaces /admin/site).
    site:                (siteId)                      => `${root}/sites/${siteId}`,
    // Site export — GET returns the full SiteDoc + every PageDoc as a
    // downloadable JSON file (Content-Disposition: attachment).
    siteExport:          (siteId)                      => `${root}/sites/${siteId}/export`,
    // Duplicate a site into a new version of the same version group
    // (POST, no body). Returns { id, name, versionGroupId, versionName }.
    siteDuplicate:       (siteId)                      => `${root}/sites/${siteId}/duplicate`,

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
    // Page templates — global, shared across all sites. List/save/delete
    // only; "apply" happens by passing `templateId` to POST pages.
    templates:           ()                            => `${root}/admin/templates`,
    template:            (templateId)                  => `${root}/admin/templates/${templateId}`,
};
