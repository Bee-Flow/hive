import { appDesignProps, NAV_STYLES, NAV_DEFAULT_STYLE } from './appDesign';
import './app-tokens.css';
import Brand from './shell/Brand';
import MobileNav from './shell/MobileNav';
import NavMega from './shell/NavMega';
import { navModel } from './shell/navModel';
import NavSidebar from './shell/NavSidebar';
import NavTabs from './shell/NavTabs';
import UserMenu from './shell/UserMenu';
import { themeVars } from './themeVars';

/**
 * App Studio runtime — the fixed app chrome for run/preview. Since A2 this is
 * a thin dispatcher over the shell system in ./shell/:
 *
 *   nav.style 'tabs' (default) — top bar: Brand + NavTabs (flattened groups,
 *     measured overflow into a "Meer" menu) + UserMenu; below 640px the tabs
 *     give way to MobileNav's bottom-sheet drawer.
 *   nav.style 'sidebar' — NavSidebar (brand on top, grouped items,
 *     collapsible) next to the content column; no top bar on desktop, a
 *     brand+drawer bar on mobile.
 *   nav.style 'rail' — the same sidebar, permanently icon-only.
 *   nav.style 'mega' — top bar where each nav GROUP opens a panel of screens
 *     with descriptions. With no groups declared it falls back to NavTabs, so
 *     the choice degrades into the default rather than into an empty bar.
 *
 * Without a definition.nav the tabs layout renders exactly like the pre-A2
 * shell (modulo the drawer replacing the old native <select> — an approved
 * universal-polish item). Screen content renders as {children} (usually
 * AppRenderer). `viewer`/`appId`/`onExit` are optional: the editor preview
 * passes its preview user (or null) and no onExit.
 */

export default function AppShell({
    definition,
    screenId,
    onNavigate,
    viewer = null,
    appId = null,
    onExit = null,
    children,
}) {
    const screens = definition?.screens || [];
    const activeScreen = screens.find((s) => s.id === screenId) || null;
    const model = navModel(definition);
    const showNav = model.flat.length > 1;
    const navStyle = NAV_STYLES.includes(definition?.nav?.style)
        ? definition.nav.style
        : NAV_DEFAULT_STYLE;
    // Design layer (App Design v2) — identity in, nothing out.
    const design = appDesignProps(definition);

    const rootClass = (layout) =>
        `app-shell flex ${layout} w-full h-full min-h-0${design.className ? ` ${design.className}` : ''}`;
    const rootStyle = {
        ...themeVars(definition?.theme),
        ...design.style,
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
    };
    const appearance = definition?.theme?.appearance || 'auto';

    /*
     * `flex flex-col` on <main> so a full-height renderer and a sibling banner
     * (ConnectionsPreflight) share the box instead of the banner pushing
     * 100%-of-main past the bottom. Harmless for a normal screen.
     */
    const main = <main className="flex flex-col flex-1 min-h-0 overflow-auto">{children}</main>;

    if (navStyle === 'sidebar' || navStyle === 'rail') {
        return (
            <div className={rootClass('flex-row')} data-app-appearance={appearance} style={rootStyle}>
                <NavSidebar
                    definition={definition}
                    model={model}
                    screenId={screenId}
                    onNavigate={onNavigate}
                    viewer={viewer}
                    appId={appId}
                    onExit={onExit}
                    railed={navStyle === 'rail'}
                />
                <div className="flex flex-col flex-1 min-w-0 min-h-0">
                    <MobileNav
                        variant="bar"
                        model={model}
                        activeScreen={activeScreen}
                        onNavigate={onNavigate}
                        brand={<Brand definition={definition} />}
                    />
                    {main}
                </div>
            </div>
        );
    }

    return (
        <div className={rootClass('flex-col')} data-app-appearance={appearance} style={rootStyle}>
            <header
                className="flex items-center gap-4 border-b px-4 shrink-0"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
            >
                <Brand definition={definition} />
                {showNav ? (
                    // 'mega' without groups has nothing to open, so it renders
                    // as the tab row it would otherwise be hiding.
                    navStyle === 'mega' && model.groups.length ? (
                        <NavMega model={model} screenId={screenId} onNavigate={onNavigate} />
                    ) : (
                        <NavTabs screens={model.flat} screenId={screenId} onNavigate={onNavigate} />
                    )
                ) : null}
                <div className="ml-auto flex items-center gap-2 shrink-0">
                    {showNav ? (
                        <MobileNav
                            variant="inline"
                            model={model}
                            activeScreen={activeScreen}
                            onNavigate={onNavigate}
                        />
                    ) : null}
                    <UserMenu viewer={viewer} onExit={onExit} direction="down" />
                </div>
            </header>
            {main}
        </div>
    );
}
