// Shared i18n test stub.
//
// Most component tests mocked useTranslation with the same identity translator:
//   () => ({ default: () => ({ t: (_k, fallback) => fallback || _k }) })
// The manual mock at src/hooks/__mocks__/useTranslation.tsx uses `tStub` below,
// so a test only needs a bare `vi.mock('@/hooks/useTranslation')`.
//
// NOTE: this matches the real hook's provider-less fallback (a string 2nd arg
// wins, otherwise the key). Tests that assert on specific translated strings or
// raw keys should keep their own inline factory instead.

/** Identity translator: returns the string fallback when given, else the key. */
export function tStub(key: string, fallbackOrParams?: unknown): string {
    return typeof fallbackOrParams === 'string' ? fallbackOrParams : key;
}

/** The value shape the real `useTranslation()` hook returns. */
export const translationValue = {
    t: tStub,
    locale: 'en',
    setLocale: () => {},
    isLoading: false,
    strings: {} as Record<string, string>,
};
