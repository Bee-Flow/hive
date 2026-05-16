import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import usePermissionCheck, { checkPermission } from './usePermissionCheck';

function Probe({ user, required, onResult }: any) {
    const ok = usePermissionCheck(user, required);
    React.useEffect(() => { onResult(ok); }, [ok, onResult]);
    return null;
}

describe('usePermissionCheck', () => {
    it("treats 'all' as a super-permission", () => {
        let out!: boolean;
        render(<Probe user={{ permissions: ['all'] }} required="manage_x" onResult={(v: boolean) => { out = v; }} />);
        expect(out).toBe(true);
    });

    it('treats isAdmin=true as full access', () => {
        let out!: boolean;
        render(<Probe user={{ isAdmin: true }} required="anything" onResult={(v: boolean) => { out = v; }} />);
        expect(out).toBe(true);
    });

    it('returns false for null user', () => {
        let out!: boolean;
        render(<Probe user={null} required="manage_x" onResult={(v: boolean) => { out = v; }} />);
        expect(out).toBe(false);
    });

    it('matches exact permission strings', () => {
        let out!: boolean;
        render(<Probe user={{ permissions: ['view', 'manage_skills'] }} required="manage_skills" onResult={(v: boolean) => { out = v; }} />);
        expect(out).toBe(true);
    });

    it('returns true when ANY of the array matches (any-of semantics)', () => {
        let out!: boolean;
        render(
            <Probe
                user={{ permissions: ['view'] }}
                required={['delete', 'view'] as const}
                onResult={(v: boolean) => { out = v; }}
            />,
        );
        expect(out).toBe(true);
    });

    it('returns false when none of the array matches', () => {
        let out!: boolean;
        render(
            <Probe
                user={{ permissions: ['read'] }}
                required={['delete', 'write'] as const}
                onResult={(v: boolean) => { out = v; }}
            />,
        );
        expect(out).toBe(false);
    });

    it('exposes a non-hook checkPermission with the same semantics', () => {
        expect(checkPermission({ permissions: ['all'] }, 'x')).toBe(true);
        expect(checkPermission({ permissions: ['a'] }, ['a', 'b'])).toBe(true);
        expect(checkPermission(null, 'x')).toBe(false);
    });
});
