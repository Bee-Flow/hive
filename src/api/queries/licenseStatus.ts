// Backwards-compat shim. The license module moved to ./license.ts with
// expanded query-key surface; this re-export keeps existing imports
// working until they are migrated.
//
//   import { useLicenseStatus, licenseStatusKey } from '@/api/queries/licenseStatus';
//
// New code should import from './license' directly.

export { useLicenseStatus, licenseStatusKey, licenseKeys, type LicenseStatus } from './license';
