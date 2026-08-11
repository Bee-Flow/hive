import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../hooks/useTranslation', () => {
    const useTranslation = () => ({
        t: (k, params) => (params?.name ? `${k}:${params.name}` : k),
        locale: 'en',
    });
    return { default: useTranslation, useTranslation };
});

import RemoteStudioApp from './RemoteStudioApp';

describe('RemoteStudioApp', () => {
    beforeEach(() => cleanup());

    it('renders the module component when the import resolves', async () => {
        const Mod = (props) => <div data-testid="mod">hello {props.greeting}</div>;
        const load = vi.fn(() => Promise.resolve({ default: Mod }));
        render(
            <RemoteStudioApp
                moduleId="m1"
                labels={{ en: 'Mod One' }}
                entryUrl="/x"
                load={load}
                componentProps={{ greeting: 'world' }}
            />,
        );
        expect(await screen.findByTestId('mod')).toHaveTextContent('hello world');
    });

    it('shows the error card on import failure and leaves the rest of the SPA alive', async () => {
        const load = vi.fn(() => Promise.reject(new Error('boom')));
        render(
            <div>
                <span data-testid="sibling">still here</span>
                <RemoteStudioApp moduleId="m1" labels={{ en: 'Mod One' }} entryUrl="/x" load={load} />
            </div>,
        );
        expect(await screen.findByTestId('module-error-card')).toBeInTheDocument();
        // A broken module must not take down its neighbours.
        expect(screen.getByTestId('sibling')).toHaveTextContent('still here');
    });

    it('retries the import (fresh nonce) when the user clicks Retry', async () => {
        const Mod = () => <div data-testid="mod">recovered</div>;
        // Fails on the first attempt (nonce 0), succeeds on retry (nonce 1).
        const load = vi.fn((nonce) => (nonce === 0 ? Promise.reject(new Error('boom')) : Promise.resolve({ default: Mod })));
        render(<RemoteStudioApp moduleId="m1" labels={{ en: 'Mod One' }} entryUrl="/x" load={load} />);

        await screen.findByTestId('module-error-card');
        fireEvent.click(screen.getByText('modules.retry'));

        expect(await screen.findByTestId('mod')).toHaveTextContent('recovered');
        expect(load).toHaveBeenCalledTimes(2);
    });
});
