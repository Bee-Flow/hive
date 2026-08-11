// Canonical list of PII detection categories. The picker UI on the
// org Privacy Shield page and the consumer privacy section both read
// this single list so a category only needs to be added in one place.
//
// Labels live in i18n; this module just owns the *structure* (id, group,
// icon, label translation key). Consumers attach the localized label via
// their `t(...)` function:
//
//   piiCategoriesLocalized(t)    → all 21 categories with `.label` filled in
//
// Detector coverage: the on-server PII Guard (guard-service) is the single
// backend. Detection is performed by a GLiNER model; the sole exception is
// the Dutch BSN, which is validated by its elfproef checksum because an
// unanchored nine-digit number carries no signal a model can read. The
// server filters unsupported categories silently, so checking a category the
// detector doesn't cover is a no-op.

import type { LucideIcon } from 'lucide-react';
import {
    Banknote, BookUser, Building2, Cake, Car, CreditCard, Fingerprint, Hash,
    HeartPulse, Home, IdCard, KeyRound, Landmark, Link2, Mail, Network, Pill,
    ReceiptText, Smartphone, Stethoscope, User,
} from 'lucide-react';

export type PiiGroup = 'Personal' | 'Contact' | 'Financial' | 'Identity' | 'Digital' | 'Organization' | 'EU / Netherlands';

export interface PiiCategoryDef {
    /** Stable id sent to the backend. */
    id: string;
    /** UI group used for the section header on the picker. */
    group: PiiGroup;
    /**
     * @deprecated Emoji glyph. Superseded by `Icon`; kept only because
     * NcOnboardingWizard still carries its own emoji copy of this list.
     * Every picker renders `Icon`.
     */
    icon: string;
    /**
     * The lucide component every surface renders.
     *
     * A component REFERENCE rather than an icon name, deliberately: a name
     * would need a registry, and a registry either imports all ~1500 lucide
     * icons (killing tree-shaking) or is a hand-maintained map — a second
     * place to edit, which is exactly the drift this catalog exists to
     * prevent. A reference is a plain value, so this file stays `.ts` and
     * both the .jsx and .tsx consumers can use it.
     *
     * Two collisions the emoji had are resolved here: 🆔 stood for both SSN
     * and National ID, and 🌐 for both IBAN and IP address.
     */
    Icon: LucideIcon;
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
 * 21 categories — every entry has a backing label in
 * guard-service/app/services/pii.py (GLINER_LABELS_TO_CATEGORY) AND appears
 * in a _LABEL_GROUPS entry. Both are required: a category mapped but not
 * grouped is never asked of the model, so it returns "clean" rather than an
 * error. Adding a row here without both means admins see a toggle that
 * silently never fires; guard-service tests assert the two lists agree.
 */
export const PII_CATEGORIES: readonly PiiCategoryDef[] = [
    // Personal
    { id: 'Person',                            group: 'Personal',    icon: '👤', Icon: User,        i18nKey: 'pii.person_name' },
    { id: 'DateOfBirth',                       group: 'Personal',    icon: '📅', Icon: Cake,        i18nKey: 'pii.date_of_birth' },
    // Contact
    { id: 'PhoneNumber',                       group: 'Contact',     icon: '📱', Icon: Smartphone,  i18nKey: 'pii.phone_number' },
    { id: 'Email',                             group: 'Contact',     icon: '📧', Icon: Mail,        i18nKey: 'pii.email_address' },
    { id: 'Address',                           group: 'Contact',     icon: '🏠', Icon: Home,        i18nKey: 'pii.physical_address' },
    // Financial
    { id: 'CreditCardNumber',                  group: 'Financial',   icon: '💳', Icon: CreditCard,  i18nKey: 'pii.credit_card' },
    { id: 'BankAccountNumber',                 group: 'Financial',   icon: '🏦', Icon: Landmark,    i18nKey: 'pii.bank_account' },
    { id: 'InternationalBankingAccountNumber', group: 'Financial',   icon: '🌐', Icon: Banknote,    i18nKey: 'pii.iban' },
    // Identity / Government
    { id: 'USSocialSecurityNumber',            group: 'Identity',    icon: '🆔', Icon: Hash,        i18nKey: 'pii.ssn' },
    { id: 'PassportNumber',                    group: 'Identity',    icon: '🛂', Icon: BookUser,    i18nKey: 'pii.passport' },
    { id: 'DriversLicenseNumber',              group: 'Identity',    icon: '🪪', Icon: IdCard,      i18nKey: 'pii.drivers_license' },
    // Digital / Secrets
    { id: 'IPAddress',                         group: 'Digital',     icon: '🌐', Icon: Network,     i18nKey: 'pii.ip_address' },
    { id: 'URL',                               group: 'Digital',     icon: '🔗', Icon: Link2,       i18nKey: 'pii.url' },
    { id: 'ApiKeyOrSecret',                    group: 'Digital',     icon: '🔑', Icon: KeyRound,    i18nKey: 'pii.api_key_or_secret' },
    // Organization
    { id: 'Organization',                      group: 'Organization', icon: '🏢', Icon: Building2,  i18nKey: 'pii.organization' },
    // EU / Netherlands — GLiNER-supported, no regex.
    // The guard-service collapses multiple natural-language labels
    // (e.g. "national id number", "identity card number") onto each
    // canonical ID below, so detection works across DE/FR/ES/IT/NL forms.
    { id: 'NationalIdentificationNumber',      group: 'EU / Netherlands', icon: '🆔',  Icon: Fingerprint,  i18nKey: 'pii.national_id' },
    { id: 'TaxIdentificationNumber',           group: 'EU / Netherlands', icon: '🧾',  Icon: ReceiptText,  i18nKey: 'pii.tax_id' },
    { id: 'HealthInsuranceNumber',             group: 'EU / Netherlands', icon: '🏥',  Icon: HeartPulse,   i18nKey: 'pii.health_insurance' },
    { id: 'MedicalCondition',                  group: 'EU / Netherlands', icon: '❤️‍🩹', Icon: Stethoscope,  i18nKey: 'pii.medical_condition' },
    { id: 'Medication',                        group: 'EU / Netherlands', icon: '💊',  Icon: Pill,         i18nKey: 'pii.medication' },
    { id: 'LicensePlateNumber',                group: 'EU / Netherlands', icon: '🚗',  Icon: Car,          i18nKey: 'pii.license_plate' },
];

type TFn = (key: string, fallback?: string) => string;

/** Returns every category with its label resolved via the provided translator. */
export function piiCategoriesLocalized(t: TFn): PiiCategoryView[] {
    return PII_CATEGORIES.map((c) => ({ ...c, label: t(c.i18nKey, c.fallback) }));
}
