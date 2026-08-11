// Shared useTranslation mock. Opt in from a test with:
//   vi.mock('.../hooks/useTranslation', () => import('@/test/useTranslationMock'));
// Exports mirror the real module (default + named useTranslation + a passthrough
// TranslationProvider) so either import style resolves. The `t` stub returns a
// string 2nd-arg fallback when given, else the key (see ./i18n).
//
// Tests that assert on specific translated strings or raw keys should keep their
// own inline factory instead.
import React from 'react';
import { translationValue } from './i18n';

export function useTranslation() {
    return translationValue;
}

export function TranslationProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}

export default useTranslation;
