/**
 * Unit — the export/import controls in the site menu.
 *
 * The distinction these pin down is easy to lose in a refactor: "Export
 * site" must ask for the **zip**, because that is the only form that carries
 * the uploaded images, while the secondary action asks for **json**. If both
 * were to send the same format (or none, letting the server default decide),
 * the UI would quietly stop offering a complete backup — with no visible
 * symptom until someone restored a site on another install and found every
 * image missing.
 *
 * The file input must also accept .zip, or the picker greys out exactly the
 * file the primary button just produced.
 *
 * Run: cd agent-hub && npx vitest run src/components/admin/ProductWebsite/shell/SiteVersionMenu.test.jsx
 */
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import SiteVersionMenu from './SiteVersionMenu';
import { cmsApi } from '../cmsApi';

// The menu composes two switchers that reach for app-wide context; stub them
// down to nothing so this test stays about the IO row.
vi.mock('../SiteSwitcher', () => ({ default: () => <div data-testid="site-switcher" /> }));
vi.mock('../VersionSwitcher', () => ({ default: () => <div data-testid="version-switcher" /> }));
vi.mock('../../../AppIcon', () => ({
    default: ({ name }) => <span data-icon={name} />,
    AppIcon: ({ name }) => <span data-icon={name} />,
}));

const SITES = [{ id: 'pj_abcd1234', name: 'Bee Flow', versionName: 'v1' }];

function renderMenu(props = {}) {
    const utils = render(
        <SiteVersionMenu
            sites={SITES}
            versions={SITES}
            activeSiteId="pj_abcd1234"
            liveSiteId={null}
            onSelectSite={() => {}}
            onCreateSite={() => {}}
            onRenameSite={() => {}}
            onDeleteSite={() => {}}
            onSetLiveVersion={() => {}}
            onDuplicateVersion={() => {}}
            onExportSite={() => {}}
            onImportFile={() => {}}
            ioStatus={null}
            {...props}
        />
    );
    // The IO row lives inside the dropdown.
    fireEvent.click(screen.getByTitle('Site, versions, export & import'));
    return utils;
}

describe('SiteVersionMenu export/import', () => {
    it('the primary Export asks for the zip — the only complete backup', () => {
        const onExportSite = vi.fn();
        renderMenu({ onExportSite });

        fireEvent.click(screen.getByText('Export site'));
        expect(onExportSite).toHaveBeenCalledWith('zip');
    });

    it('offers a JSON escape hatch, clearly labelled as image-less', () => {
        const onExportSite = vi.fn();
        renderMenu({ onExportSite });

        const jsonBtn = screen.getByText(/Export as JSON \(no images\)/);
        fireEvent.click(jsonBtn);
        expect(onExportSite).toHaveBeenCalledWith('json');
    });

    it('the import picker accepts .zip as well as .json', () => {
        const { container } = renderMenu();
        const input = container.querySelector('input[type="file"]');
        expect(input.getAttribute('accept')).toContain('.zip');
        expect(input.getAttribute('accept')).toContain('.json');
    });

    it('hands the chosen file straight to the parent and resets the input', () => {
        const onImportFile = vi.fn();
        const { container } = renderMenu({ onImportFile });
        const input = container.querySelector('input[type="file"]');
        const file = new File(['zipbytes'], 'site.zip', { type: 'application/zip' });

        fireEvent.change(input, { target: { files: [file] } });

        expect(onImportFile).toHaveBeenCalledTimes(1);
        expect(onImportFile.mock.calls[0][0].name).toBe('site.zip');
        expect(input.value).toBe('');   // so the same file can be picked twice
    });

    it('disables both exports while an import/export is in flight', () => {
        renderMenu({ ioStatus: { kind: 'busy', text: 'Importing…' } });
        expect(screen.getByText('Export site').closest('button')).toBeDisabled();
        expect(screen.getByText(/Export as JSON/).closest('button')).toBeDisabled();
    });
});

describe('cmsApi.siteExport', () => {
    it('defaults to zip and passes the format through', () => {
        expect(cmsApi.siteExport('pj_abcd1234')).toMatch(/\/sites\/pj_abcd1234\/export\?format=zip$/);
        expect(cmsApi.siteExport('pj_abcd1234', 'json')).toMatch(/format=json$/);
    });
});
