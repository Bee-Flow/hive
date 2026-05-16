// Canonical list of PII detection categories. Extracted from the inline
// 85-line ALL_PII_CATEGORIES constant in components/admin/GuardrailsPanel.jsx.
//
// Labels live in i18n; this module just owns the *structure* (id, group,
// icon, label translation key). The consumer attaches the localized
// label via their `t(...)` function. Two small helpers do that pairing:
//
//   piiCategoriesLocalized(t)    → all 21 categories with `.label` filled in
//   piiCategoriesLocalSubset(t)  → just the 8 that the on-server detector
//                                  supports (or the full 21 when Azure
//                                  PII is available)
//
// The "Azure CosmosDB / Storage key" entry gets a more accurate fallback
// label in the local-only case where the Privacy Filter only emits a
// generic `secret` token — see the LOCAL_OVERRIDES map.

export type PiiGroup = 'Personal' | 'Contact' | 'Financial' | 'Identity' | 'Digital' | 'Organization' | 'EU';

export interface PiiCategoryDef {
    /** Stable id sent to the backend; matches the Azure Content Safety taxonomy. */
    id: string;
    /** UI group used for the section header on the picker. */
    group: PiiGroup;
    /** Emoji glyph rendered alongside the label. */
    icon: string;
    /** i18n key used to look up the user-visible label. */
    i18nKey: string;
    /** Optional fallback used when the i18n key is missing. */
    fallback?: string;
}

export interface PiiCategoryView extends PiiCategoryDef {
    /** The resolved label (i18n lookup applied). */
    label: string;
}

/** All 21 categories supported by Azure AI Language. */
export const PII_CATEGORIES: readonly PiiCategoryDef[] = [
    // Personal
    { id: 'Person',                            group: 'Personal',    icon: '👤', i18nKey: 'pii.person_name' },
    { id: 'PersonType',                        group: 'Personal',    icon: '👥', i18nKey: 'pii.person_type' },
    { id: 'Age',                               group: 'Personal',    icon: '🎂', i18nKey: 'pii.age' },
    { id: 'DateOfBirth',                       group: 'Personal',    icon: '📅', i18nKey: 'pii.date_of_birth' },
    // Contact
    { id: 'PhoneNumber',                       group: 'Contact',     icon: '📱', i18nKey: 'pii.phone_number' },
    { id: 'Email',                             group: 'Contact',     icon: '📧', i18nKey: 'pii.email_address' },
    { id: 'Address',                           group: 'Contact',     icon: '🏠', i18nKey: 'pii.physical_address' },
    // Financial
    { id: 'CreditCardNumber',                  group: 'Financial',   icon: '💳', i18nKey: 'pii.credit_card' },
    { id: 'BankAccountNumber',                 group: 'Financial',   icon: '🏦', i18nKey: 'pii.bank_account' },
    { id: 'InternationalBankingAccountNumber', group: 'Financial',   icon: '🌐', i18nKey: 'pii.iban' },
    { id: 'ABARoutingNumber',                  group: 'Financial',   icon: '🔢', i18nKey: 'pii.aba_routing' },
    { id: 'SWIFTCode',                         group: 'Financial',   icon: '🏧', i18nKey: 'pii.swift_code' },
    // Identity / Government
    { id: 'USSocialSecurityNumber',            group: 'Identity',    icon: '🆔', i18nKey: 'pii.ssn' },
    { id: 'PassportNumber',                    group: 'Identity',    icon: '🛂', i18nKey: 'pii.passport' },
    { id: 'DriversLicenseNumber',              group: 'Identity',    icon: '🪪', i18nKey: 'pii.drivers_license' },
    // Digital / Secrets
    { id: 'IPAddress',                         group: 'Digital',     icon: '🌐', i18nKey: 'pii.ip_address' },
    { id: 'URL',                               group: 'Digital',     icon: '🔗', i18nKey: 'pii.url' },
    { id: 'AzureDocumentDBAuthKey',            group: 'Digital',     icon: '☁️', i18nKey: 'pii.azure_cosmosdb_key' },
    { id: 'AzureStorageAccountKey',            group: 'Digital',     icon: '☁️', i18nKey: 'pii.azure_storage_key' },
    // Organization
    { id: 'Organization',                      group: 'Organization', icon: '🏢', i18nKey: 'pii.organization' },
    // EU / Netherlands
    { id: 'EUNationalIdentificationNumber',    group: 'EU',          icon: '🇪🇺', i18nKey: 'pii.eu_national_id' },
];

/**
 * Subset that the on-server PII detector (OpenAI Privacy Filter) actually
 * supports — see server/core/localPiiDetection.js LABEL_TO_CATEGORY.
 * When only the local detector is active, listing the other 13 would
 * present admins with toggles that silently never fire.
 */
export const LOCAL_PII_CATEGORY_IDS: ReadonlySet<string> = new Set([
    'Person', 'Email', 'PhoneNumber', 'Address', 'URL',
    'DateOfBirth', 'BankAccountNumber', 'AzureStorageAccountKey',
]);

/**
 * When only the local detector is active, the Privacy Filter's `secret`
 * token is generic (any password / API key / credential) rather than
 * Azure-specific. Override the label/icon so admins aren't told it's
 * tied to Azure Storage.
 */
export interface LocalOverride {
    i18nKey: string;
    fallback: string;
    icon: string;
    group: PiiGroup;
}

export const LOCAL_OVERRIDES: Record<string, LocalOverride> = {
    AzureStorageAccountKey: {
        i18nKey: 'pii.api_key_or_secret',
        fallback: 'API key / secret',
        icon: '🔑',
        group: 'Digital',
    },
};

type TFn = (key: string, fallback?: string) => string;

/** Returns every category with its label resolved via the provided translator. */
export function piiCategoriesLocalized(t: TFn): PiiCategoryView[] {
    return PII_CATEGORIES.map((c) => ({ ...c, label: t(c.i18nKey, c.fallback) }));
}

/**
 * When `azureAvailable` is true the full 21-category list is returned;
 * otherwise the 8-category subset that the local detector supports
 * (with the Azure-specific labels replaced where applicable).
 */
export function piiCategoriesForScope(t: TFn, azureAvailable: boolean): PiiCategoryView[] {
    if (azureAvailable) return piiCategoriesLocalized(t);
    return PII_CATEGORIES
        .filter((c) => LOCAL_PII_CATEGORY_IDS.has(c.id))
        .map((c) => {
            const override = LOCAL_OVERRIDES[c.id];
            if (override) {
                return {
                    ...c,
                    icon: override.icon,
                    group: override.group,
                    label: t(override.i18nKey, override.fallback),
                };
            }
            return { ...c, label: t(c.i18nKey, c.fallback) };
        });
}
