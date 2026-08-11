/**
 * Run: cd agent-hub && npx vitest run src/marketing/components/NavIcon.test.jsx
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NavIcon from './NavIcon';

describe('NavIcon', () => {
    it('renders a Lucide name as an svg, not as the literal text', () => {
        const { container } = render(<NavIcon icon="ShieldCheck" />);
        expect(container.querySelector('svg')).toBeTruthy();
        expect(container.textContent).toBe('');
    });

    it('still renders a legacy emoji verbatim', () => {
        // Sites seeded before the switch hold an emoji in this field, and a
        // CMS editor can type one. Neither should render an empty box.
        const { container } = render(<NavIcon icon={'\u{1F41D}'} />);
        expect(container.textContent).toBe('\u{1F41D}');
        expect(container.querySelector('svg')).toBeNull();
    });

    it('renders nothing at all when there is no icon', () => {
        const { container } = render(<NavIcon icon="" />);
        expect(container.innerHTML).toBe('');
    });
});
