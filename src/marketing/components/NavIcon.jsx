import React from 'react';
import AppIcon from '../../components/AppIcon';

/**
 * The mark beside a mega-menu / drawer item.
 *
 * Nav items used to store an emoji here (🐝, 🛡️, ⚖️). Emoji render in the
 * visitor's OS font, so the same menu is Apple's glossy set on a Mac, Segoe on
 * Windows and Noto on Android — three different visual languages, none of them
 * ours, at three different optical weights. Next to a line-drawn product UI
 * that reads as generated filler rather than design.
 *
 * So a nav icon is now a Lucide name, matching how block icons have always
 * worked elsewhere in the CMS. Anything that is not a PascalCase identifier is
 * still rendered verbatim: sites seeded before this change hold emoji in the
 * same field, and a CMS editor may reasonably type one. Back-compat, not a
 * fallback for typos — an unknown Lucide name renders nothing rather than the
 * literal string, which is AppIcon's behaviour and the right one here.
 */
const LUCIDE_NAME = /^[A-Z][A-Za-z0-9]*$/;

export default function NavIcon({ icon, className = '' }) {
    if (!icon) return null;
    if (LUCIDE_NAME.test(icon)) {
        return <AppIcon name={icon} className={className} aria-hidden="true" />;
    }
    return <>{icon}</>;
}
