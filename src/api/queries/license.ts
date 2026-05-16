// React-Query-backed licence status hook.
//
// First domain hook to land — used as the model for the rest of /queries/.
// The LicenseProvider can be migrated to use this instead of its hand-rolled
// fetch + useState; until then both work side-by-side.

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export const licenseKeys = {
    all: ['license'] as const,
    status: () => [...licenseKeys.all, 'status'] as const,
};

/** Backwards compatibility — exported under the old key the LicenseProvider uses. */
export const licenseStatusKey = licenseKeys.status();

export interface LicenseStatus {
    tier: string;
    source: string;
    features?: string[];
    limits?: Record<string, unknown>;
    [k: string]: unknown;
}

export function useLicenseStatus() {
    return useQuery<LicenseStatus | null, Error>({
        queryKey: licenseKeys.status(),
        queryFn: ({ signal }) => apiClient.get<LicenseStatus>('/api/license/status', { signal }),
    });
}
