/**
 * navModel(definition) — the ONE place that turns definition.screens +
 * definition.nav.groups into what the shells render. Shared by NavTabs
 * (flattened), NavSidebar (grouped) and MobileNav (grouped drawer) so the
 * three surfaces can never disagree about ordering or membership.
 *
 * Rules (mirroring the server's resolveNavScreens in appDesignSpec.js):
 *   - screens with showInNav === false never appear;
 *   - a screen listed in a group leaves the ungrouped list;
 *   - a screen claimed by an earlier group is skipped in later ones
 *     (one nav place per screen);
 *   - group refs to unknown/hidden screens are dropped, groups that end up
 *     empty are dropped;
 *   - order: ungrouped screens in definition order, then grouped screens in
 *     group order (that is also the flattened tabs order).
 */
export function navModel(definition) {
    const screens = definition?.screens || [];
    const navScreens = screens.filter((s) => s && s.showInNav !== false);
    const byId = new Map(navScreens.map((s) => [s.id, s]));

    const rawGroups = Array.isArray(definition?.nav?.groups) ? definition.nav.groups : [];
    const claimed = new Set();
    const groups = [];
    for (const g of rawGroups) {
        if (!g || typeof g !== 'object') continue;
        const members = [];
        for (const ref of Array.isArray(g.screens) ? g.screens : []) {
            if (claimed.has(ref)) continue;
            const screen = byId.get(ref);
            if (!screen) continue;
            claimed.add(ref);
            members.push(screen);
        }
        if (members.length) {
            groups.push({ id: g.id, label: g.label, icon: g.icon || null, screens: members });
        }
    }

    const ungrouped = navScreens.filter((s) => !claimed.has(s.id));
    const flat = [...ungrouped, ...groups.flatMap((g) => g.screens)];
    return { ungrouped, groups, flat };
}

export default navModel;
