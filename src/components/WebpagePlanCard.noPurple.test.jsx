import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import WebpagePlanCard from './WebpagePlanCard';

// Hard project rule: no purple/violet/indigo anywhere. The pending plan tone
// previously used indigo-500 (rgb 99,102,241). Lock it out.
const FORBIDDEN = [/99\s*,\s*102\s*,\s*241/i, /#6366f1/i, /#4f46e5/i, /#818cf8/i, /#7c3aed/i, /indigo/i, /violet/i];

const plan = {
    title: 'Build a landing page',
    steps: [{ file: 'index.html', action: 'create', description: 'Hero + form' }],
};

describe('WebpagePlanCard — no purple', () => {
    for (const status of ['pending', 'approved', 'executed', 'rejected']) {
        it(`has no indigo/violet in the ${status} tone`, () => {
            const { container } = render(<WebpagePlanCard plan={plan} planId="p1" status={status} />);
            const html = container.innerHTML;
            for (const re of FORBIDDEN) {
                expect(re.test(html), `${status} tone must not contain ${re}`).toBe(false);
            }
        });
    }
});
