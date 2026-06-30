import { describe, it, expect } from 'vitest';
import { getIntegrationLogo } from './integrationLogos.jsx';

describe('getIntegrationLogo', () => {
    it('resolves a logo for the outlook-readonly catalog id', () => {
        expect(getIntegrationLogo('outlook-readonly')).not.toBeNull();
    });

    it('renders the identical Outlook brand component for the readonly variant', () => {
        expect(getIntegrationLogo('outlook-readonly')).toBe(getIntegrationLogo('outlook'));
    });
});
