import { describe, it, expect } from 'vitest';
import { shortAppLabel, actionLabelMap, uiDescription } from './appLabels';

// Verbatim from GET /api/automation/catalog: every action label is
// `name.replace(/_/g, ' ')` and every description is the LLM tool schema's.
const talkActions = [
    { tool: 'nextcloud_talk_list_rooms', label: 'nextcloud talk list rooms',
      description: "List the user's Nextcloud Talk conversations (rooms). Returns token, type, name, last message preview, unread count." },
    { tool: 'nextcloud_talk_get_room', label: 'nextcloud talk get room',
      description: 'Fetch detailed information about a single Talk room.' },
    { tool: 'nextcloud_talk_send_message', label: 'nextcloud talk send message',
      description: 'Post a message to a Talk room. The user has approved sending this message — go ahead. Use replyTo to reply to a specific message; use silent=true to suppress notifications.' },
    { tool: 'nextcloud_talk_create_room', label: 'nextcloud talk create room',
      description: 'Create a new Talk room. The user has approved this. roomType: 1 = one-to-one, 2 = group, 3 = public, 4 = changelog.' },
];

describe('shortAppLabel', () => {
    it('drops the vendor word the cluster caption already shows', () => {
        expect(shortAppLabel('Nextcloud Talk', 'Nextcloud')).toBe('Talk');
        expect(shortAppLabel('Nextcloud User Status', 'Nextcloud')).toBe('User Status');
        // The vendor word comes from the FIRST word of the category, so
        // "Google Workspace" still strips "Google".
        expect(shortAppLabel('Google Calendar', 'Google Workspace')).toBe('Calendar');
    });

    it('leaves an app that does not carry the vendor word alone', () => {
        expect(shortAppLabel('Gmail', 'Google Workspace')).toBe('Gmail');
        expect(shortAppLabel('Fireflies', 'Productivity')).toBe('Fireflies');
        expect(shortAppLabel('Webpages', 'Automation')).toBe('Webpages');
    });

    it('names the vendor\'s own core app rather than leaving it blank', () => {
        // 'Nextcloud' inside a NEXTCLOUD cluster has nothing left to strip, and
        // stripping it to '' would be worse than redundant.
        expect(shortAppLabel('Nextcloud', 'Nextcloud', 'nextcloud')).toBe('Files');
        // An unmapped one keeps the full name instead of vanishing.
        expect(shortAppLabel('Nextcloud', 'Nextcloud', 'something-else')).toBe('Nextcloud');
    });

    it('is inert without a category', () => {
        expect(shortAppLabel('Nextcloud Talk', '')).toBe('Nextcloud Talk');
        expect(shortAppLabel('', 'Nextcloud')).toBe('');
    });
});

describe('actionLabelMap', () => {
    it('strips the prefix every sibling tool shares', () => {
        const m = actionLabelMap(talkActions);
        expect(m.get('nextcloud_talk_list_rooms')).toBe('List rooms');
        expect(m.get('nextcloud_talk_send_message')).toBe('Send message');
    });

    it('only strips as far as the tools actually agree', () => {
        // The Files app shares `nextcloud_` and nothing more.
        const m = actionLabelMap([
            { tool: 'nextcloud_list_files', label: 'nextcloud list files' },
            { tool: 'nextcloud_search_files', label: 'nextcloud search files' },
            { tool: 'nextcloud_create_folder', label: 'nextcloud create folder' },
        ]);
        expect(m.get('nextcloud_list_files')).toBe('List files');
        expect(m.get('nextcloud_create_folder')).toBe('Create folder');
    });

    it('never strips a name down to nothing', () => {
        // `nextcloud_tables` would be the common prefix of the first two, which
        // would leave the shorter one empty — so one token has to survive.
        const m = actionLabelMap([
            { tool: 'nextcloud_tables', label: 'nextcloud tables' },
            { tool: 'nextcloud_tables_create', label: 'nextcloud tables create' },
        ]);
        expect(m.get('nextcloud_tables')).toBe('Tables');
        expect(m.get('nextcloud_tables_create')).toBe('Tables create');
    });

    it('defers to a label a human wrote', () => {
        // A label that is not the server's mechanical `name.replace(/_/g,' ')`
        // is somebody's choice; guessing over the top of it would be a
        // regression the day the catalog gains curated labels.
        const m = actionLabelMap([
            { tool: 'gmail_send', label: 'Send email' },
            { tool: 'gmail_read', label: 'Read email' },
        ]);
        expect(m.get('gmail_send')).toBe('Send email');
    });

    it('leaves a lone action alone — one name is not a prefix', () => {
        const m = actionLabelMap([{ tool: 'webpages_publish', label: 'webpages publish' }]);
        expect(m.get('webpages_publish')).toBe('Webpages publish');
    });

    it('survives an empty or junk action list', () => {
        expect(actionLabelMap([]).size).toBe(0);
        expect(actionLabelMap(undefined).size).toBe(0);
        expect(actionLabelMap([null, { label: 'no tool' }]).size).toBe(0);
    });
});

describe('uiDescription', () => {
    it('drops the sentences addressed to the model, not the author', () => {
        expect(uiDescription(talkActions[3].description)).toBe('Create a new Talk room.');
        expect(uiDescription('Create a new note. The user has approved this — go ahead.'))
            .toBe('Create a new note.');
        expect(uiDescription('List the Nextcloud Tables the user can access, with id and title. Call this first to find a table id.'))
            .toBe('List the Nextcloud Tables the user can access, with id and title.');
    });

    it('keeps the sentence that says what comes back', () => {
        // "Returns …" is the half of the description an automation author most
        // needs: it is the shape of the data the next step gets.
        expect(uiDescription(talkActions[0].description))
            .toBe("List the user's Nextcloud Talk conversations (rooms). Returns token, type, name, last message preview, unread count.");
    });

    it('keeps a usable sentence that merely follows a dropped one', () => {
        const out = uiDescription(talkActions[2].description);
        expect(out.startsWith('Post a message to a Talk room.')).toBe(true);
        expect(out).not.toMatch(/approved/);
        expect(out).toMatch(/replyTo/);
    });

    it('does not split on an abbreviation or a numbered clause', () => {
        const out = uiDescription('Upload a file. Two sources: 1) sourceHandle, e.g. from another step, or 2) content.');
        expect(out).toMatch(/1\) sourceHandle, e\.g\. from another step/);
    });

    it('flattens the multi-line schema strings and caps runaway ones', () => {
        const long = `Upload or overwrite a file in Nextcloud.\n  ${'x'.repeat(400)}`;
        const out = uiDescription(long);
        expect(out.length).toBeLessThanOrEqual(181);
        expect(out).not.toMatch(/\n/);
    });

    it('returns an empty string rather than undefined for nothing', () => {
        expect(uiDescription(undefined)).toBe('');
        expect(uiDescription('   ')).toBe('');
        // A description that is ENTIRELY model-directed leaves nothing to show.
        expect(uiDescription('The user has approved this.')).toBe('');
    });
});
