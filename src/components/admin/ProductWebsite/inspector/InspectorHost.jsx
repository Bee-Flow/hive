import React from 'react';
import TranslationPanel from '../TranslationPanel';
import AnalyticsInspector from './AnalyticsInspector';
import ChromeInspector from './ChromeInspector';
import DesignInspector from './DesignInspector';
import PageInspector from './PageInspector';
import {
    ANALYTICS_VIRTUAL_ID, DESIGN_VIRTUAL_ID, isChromeEntryId, normalizeVirtualId,
} from '../sentinels';

function CenteredNote({ children }) {
    return (
        <div className="flex-1 h-full flex items-center justify-center text-[var(--text-muted)] text-xs p-4 text-center">
            {children}
        </div>
    );
}

/**
 * Inspector mode router — the right panel's single decision point. Priority
 * order is identical to the old Pane B ternary:
 *
 *   translation mode  →  blocked note (design/analytics) | TranslationPanel | pick-a-page
 *   chrome entry      →  ChromeInspector (header / footer / cookie)
 *   design entry      →  DesignInspector
 *   analytics entry   →  AnalyticsInspector
 *   real page         →  PageInspector (page settings + block editor)
 *   nothing           →  placeholder
 */
export default function InspectorHost({
    activePageId,
    activePage,
    translationMode,
    translateProps,     // TranslationPanel props minus `scope` (added here)
    chromeProps,        // { site, pages, onChangeSite }
    designProps,        // { design, onChange }
    analyticsProps,     // { site, onChange, onOpenCookieSettings, onOpenAnalytics }
    pageProps,          // PageInspector props minus `page` (added here)
}) {
    const entryId = normalizeVirtualId(activePageId);
    const isChrome = isChromeEntryId(entryId);
    const isDesign = entryId === DESIGN_VIRTUAL_ID;
    const isAnalytics = entryId === ANALYTICS_VIRTUAL_ID;

    if (translationMode) {
        if (isDesign) {
            return (
                <CenteredNote>
                    Design is shared across all languages. Switch to the
                    default language to edit it.
                </CenteredNote>
            );
        }
        if (isAnalytics) {
            return (
                <CenteredNote>
                    Analytics settings are shared across all languages. Switch
                    to the default language to edit them.
                </CenteredNote>
            );
        }
        if (isChrome || activePage) {
            return (
                <TranslationPanel
                    scope={isChrome ? 'site' : 'page'}
                    {...translateProps}
                />
            );
        }
        return <CenteredNote>Select a page to translate.</CenteredNote>;
    }

    if (isChrome) return <ChromeInspector entryId={entryId} {...chromeProps} />;
    if (isDesign) return <DesignInspector {...designProps} />;
    if (isAnalytics) return <AnalyticsInspector {...analyticsProps} />;
    if (activePage) return <PageInspector page={activePage} {...pageProps} />;

    return <CenteredNote>Select a page from the list.</CenteredNote>;
}
