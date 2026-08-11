// ElevenLabs TTS option tables. Replaces the identical TTS_MODELS /
// TTS_VOICES arrays that were copy-pasted into both ElevenLabsSettings
// and NanoBananaSettings — voice/model additions now happen in one place.

export const TTS_MODELS = [
    { label: 'Flash v2.5 (Fast)', value: 'eleven_flash_v2_5' },
    { label: 'v3 (Highest Quality)', value: 'eleven_v3' },
    { label: 'Multilingual v2', value: 'eleven_multilingual_v2' },
];

export const DEFAULT_TTS_MODEL = 'eleven_flash_v2_5';

export const TTS_VOICES = [
    { label: 'George (Default)', value: 'JBFqnCBsd6RMkjVDRZzb' },
    { label: 'Rachel', value: '21m00Tcm4TlvDq8ikWAM' },
    { label: 'Drew', value: '29vD33N1CtxCmqQRPOHJ' },
    { label: 'Clyde', value: '2EiwWnXFnvU5JabPnv8n' },
    { label: 'Paul', value: '5Q0t7uMcjvnagumLfvZi' },
    { label: 'Domi', value: 'AZnzlk1XvdvUeBnXmlld' },
    { label: 'Bella', value: 'EXAVITQu4vr4xnSDxMaL' },
    { label: 'Antoni', value: 'ErXwobaYiN019PkySvjV' },
    { label: 'Elli', value: 'MF3mGyEYCl7XYWbV9V6O' },
    { label: 'Josh', value: 'TxGEqnHWrfWFTfGW9XjX' },
    { label: 'Arnold', value: 'VR6AewLTigWG4xSOukaG' },
    { label: 'Adam', value: 'pNInz6obpgDQGcFmaJgB' },
    { label: 'Sam', value: 'yoZ06aMxZJJ28mfd3POQ' },
];

export const DEFAULT_TTS_VOICE = 'JBFqnCBsd6RMkjVDRZzb';
