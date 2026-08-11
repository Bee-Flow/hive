/**
 * useRelativeTime — locale-aware relative timestamps ("5m ago", "zojuist").
 *
 * `utils/dateFormatters.formatRelativeTime` hardcodes English suffixes and
 * ignores the app locale for everything but the >7d fallback. This hook keeps
 * the same thresholds but resolves the labels through t(), so Dutch (or any
 * server-provided locale) renders correctly. It is a hook rather than a util
 * because t()/locale only exist inside the TranslationProvider.
 *
 * Returns a memoized `rel(dateLike)`; invalid/empty input yields ''.
 */
import { useCallback } from 'react';
import { useTranslation } from './useTranslation';
import { MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY, MS_PER_WEEK } from '../constants/units';

export default function useRelativeTime() {
    const { t, locale } = useTranslation();
    return useCallback((dateLike) => {
        if (dateLike == null || dateLike === '') return '';
        const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
        if (Number.isNaN(d.getTime())) return '';
        const diff = Date.now() - d.getTime();
        if (diff < MS_PER_MINUTE) return t('time.just_now', 'just now');
        if (diff < MS_PER_HOUR) return t('time.minutes_ago', '{count}m ago', { count: Math.floor(diff / MS_PER_MINUTE) });
        if (diff < MS_PER_DAY) return t('time.hours_ago', '{count}h ago', { count: Math.floor(diff / MS_PER_HOUR) });
        if (diff < MS_PER_WEEK) return t('time.days_ago', '{count}d ago', { count: Math.floor(diff / MS_PER_DAY) });
        return d.toLocaleDateString(locale);
    }, [t, locale]);
}
