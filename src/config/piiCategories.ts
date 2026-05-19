// Canonical list of PII detection categories. The picker UI on the
// org Privacy Shield page and the consumer privacy section both read
// this single list so a category only needs to be added in one place.
//
// Labels live in i18n; this module just owns the *structure* (id, group,
// icon, label translation key). Consumers attach the localized label via
// their `t(...)` function:
//
//   piiCategoriesLocalized(t)    → all 20 categories with `.label` filled in
//
// Detector coverage:
//   • In-process Transformers.js (openai/privacy-filter) emits 8 of these
//   • GLiNER guard-service emits 16 of these
//   Server filters unsupported categories silently, so checking a category
//   the active detector doesn't cover is a no-op (no harm done).

export type PiiGroup = 'Personal' | 'Contact' | 'Financial' | 'Identity' | 'Digital' | 'Organization' | 'EU / Netherlands';

export interface PiiCategoryDef {
    /** Stable id sent to the backend. */
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

/**
 * 20 categories — every entry has a backing detector mapping in either
 * server/core/localPiiDetection.js LABEL_TO_CATEGORY or
 * guard-service/app/services/pii.py GLINER_LABELS_TO_CATEGORY.
 * Adding rows without a mapping means admins will see toggles that
 * silently never fire.
 */
export const PII_CATEGORIES: readonly PiiCategoryDef[] = [
    // Personal
    { id: 'Person',                            group: 'Personal',    icon: '👤', i18nKey: 'pii.person_name' },
    { id: 'DateOfBirth',                       group: 'Personal',    icon: '📅', i18nKey: 'pii.date_of_birth' },
    // Contact
    { id: 'PhoneNumber',                       group: 'Contact',     icon: '📱', i18nKey: 'pii.phone_number' },
    { id: 'Email',                             group: 'Contact',     icon: '📧', i18nKey: 'pii.email_address' },
    { id: 'Address',                           group: 'Contact',     icon: '🏠', i18nKey: 'pii.physical_address' },
    // Financial
    { id: 'CreditCardNumber',                  group: 'Financial',   icon: '💳', i18nKey: 'pii.credit_card' },
    { id: 'BankAccountNumber',                 group: 'Financial',   icon: '🏦', i18nKey: 'pii.bank_account' },
    { id: 'InternationalBankingAccountNumber', group: 'Financial',   icon: '🌐', i18nKey: 'pii.iban' },
    // Identity / Government
    { id: 'USSocialSecurityNumber',            group: 'Identity',    icon: '🆔', i18nKey: 'pii.ssn' },
    { id: 'PassportNumber',                    group: 'Identity',    icon: '🛂', i18nKey: 'pii.passport' },
    { id: 'DriversLicenseNumber',              group: 'Identity',    icon: '🪪', i18nKey: 'pii.drivers_license' },
    // Digital / Secrets
    { id: 'IPAddress',                         group: 'Digital',     icon: '🌐', i18nKey: 'pii.ip_address' },
    { id: 'URL',                               group: 'Digital',     icon: '🔗', i18nKey: 'pii.url' },
    { id: 'ApiKeyOrSecret',                    group: 'Digital',     icon: '🔑', i18nKey: 'pii.api_key_or_secret' },
    // Organization
    { id: 'Organization',                      group: 'Organization', icon: '🏢', i18nKey: 'pii.organization' },
    // EU / Netherlands — GLiNER-supported, no regex.
    // The guard-service collapses multiple natural-language labels
    // (e.g. "national id number", "identity card number") onto each
    // canonical ID below, so detection works across DE/FR/ES/IT/NL forms.
    { id: 'NationalIdentificationNumber',      group: 'EU / Netherlands', icon: '🆔',  i18nKey: 'pii.national_id' },
    { id: 'TaxIdentificationNumber',           group: 'EU / Netherlands', icon: '🧾',  i18nKey: 'pii.tax_id' },
    { id: 'HealthInsuranceNumber',             group: 'EU / Netherlands', icon: '🏥',  i18nKey: 'pii.health_insurance' },
    { id: 'MedicalCondition',                  group: 'EU / Netherlands', icon: '❤️‍🩹', i18nKey: 'pii.medical_condition' },
    { id: 'Medication',                        group: 'EU / Netherlands', icon: '💊',  i18nKey: 'pii.medication' },
    { id: 'LicensePlateNumber',                group: 'EU / Netherlands', icon: '🚗',  i18nKey: 'pii.license_plate' },
];

type TFn = (key: string, fallback?: string) => string;

/** Returns every category with its label resolved via the provided translator. */
export function piiCategoriesLocalized(t: TFn): PiiCategoryView[] {
    return PII_CATEGORIES.map((c) => ({ ...c, label: t(c.i18nKey, c.fallback) }));
}
