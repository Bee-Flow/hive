import { getIntegrationIcon } from '../../../config/integrationIcons';

const META = [
    { id: 'gmail', label: 'Gmail', group: 'google', description: 'Read & send emails' },
    { id: 'google-calendar', label: 'Calendar', group: 'google', description: 'Create & manage events' },
    { id: 'google-drive', label: 'Drive', group: 'google', description: 'Search & access files' },
    { id: 'google-sheets', label: 'Sheets', group: 'google', description: 'Read & write spreadsheets' },
    { id: 'google-docs', label: 'Docs', group: 'google', description: 'Create & edit documents' },
    { id: 'google-slides', label: 'Slides', group: 'google', description: 'Create presentations' },
    { id: 'google-contacts', label: 'Contacts', group: 'google', description: 'Search, create & update contacts' },
    { id: 'google-keep', label: 'Keep', group: 'google', description: 'List, create & delete notes (Workspace only)' },
    { id: 'google-groups', label: 'Groups', group: 'google', description: 'Read & reply to group conversations' },
    { id: 'outlook', label: 'Outlook', group: 'microsoft', description: 'Read & send emails' },
    { id: 'ms-calendar', label: 'Calendar', group: 'microsoft', description: 'Create & manage events' },
    { id: 'onedrive', label: 'OneDrive', group: 'microsoft', description: 'Search & access files' },
    { id: 'ms-contacts', label: 'Contacts', group: 'microsoft', description: 'Search, create & update contacts' },
    { id: 'image-gen', label: 'Image Generation', group: 'platform', description: 'Generate images with AI' },
    { id: 'music-gen', label: 'Music Generation', group: 'platform', description: 'Generate music with AI' },
    { id: 'video-gen', label: 'Video Generation', group: 'platform', description: 'Generate videos with AI' },
    { id: 'elevenlabs', label: 'ElevenLabs', group: 'platform', description: 'Music with vocals, TTS & SFX' },
    { id: 'agent-search', label: 'Web Search', group: 'platform', description: 'Search the internet' },
    { id: 'fireflies', label: 'Fireflies', group: 'third-party', description: 'Meeting transcriptions' },
    { id: 'youtrack', label: 'YouTrack', group: 'third-party', description: 'Issue tracking' },
    { id: 'gamma', label: 'Gamma', group: 'third-party', description: 'Generate presentations' },
    { id: 'n8n', label: 'n8n', group: 'third-party', description: 'Workflow automations' },
    { id: 'linkedin', label: 'LinkedIn', group: 'third-party', description: 'Post to LinkedIn' },
    { id: 'transcription', label: 'Meeting Transcription', group: 'platform', description: 'Transcribe audio with speaker diarization' },
];

export const INTEGRATION_CATALOG = META.map(item => ({
    ...item,
    iconSvg: getIntegrationIcon(item.id),
}));
