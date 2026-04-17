import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, X, StopCircle, MessageCircle, FileText, Image, File as FileIcon, FileSpreadsheet, ArrowUp, Sparkles, LayoutGrid, Globe } from 'lucide-react';
import ModelTierSelector from './ModelTierSelector';
import EffortSelector from './EffortSelector';
import GoogleDrivePicker from './chat/GoogleDrivePicker';
import GmailPicker from './chat/GmailPicker';
import ImageGenSettings, { loadSettings } from './chat/ImageGenSettings';
import MusicGenSettings from './chat/MusicGenSettings';
import ElevenLabsSettings from './chat/ElevenLabsSettings';
import VideoGenSettings from './chat/VideoGenSettings';
import { API_BASE, authFetch } from '../utils/helpers';
import scopedStorage from '../utils/scopedStorage';

// App definitions for the apps overlay
const APP_DEFS = [
    {
        id: 'google-drive', label: 'Google Drive', description: 'Attach files from Drive', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" /><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47" /><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 13.8z" fill="#ea4335" /><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" /><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" /><path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" /></svg>,
    },
    {
        id: 'gmail', label: 'Gmail', description: 'Attach emails', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M45 16.2l-5 2.75-5 4.75V40h7c1.66 0 3-1.34 3-3V16.2z" fill="#4caf50" /><path d="M3 16.2l3.04 1.67L13 24.7V40H6c-1.66 0-3-1.34-3-3V16.2z" fill="#1e88e5" /><path d="M35 11.2l-11 8.5-11-8.5V24.7l11 8.5 11-8.5V11.2z" fill="#e53935" /><path d="M3 12.3V16.2l10 8.5V11.2L7.96 7.57A2.98 2.98 0 003 12.3z" fill="#c62828" /><path d="M45 12.3V16.2l-10 8.5V11.2l5.04-3.63A2.98 2.98 0 0145 12.3z" fill="#fbc02d" /></svg>,
    },
    {
        id: 'google-calendar', label: 'Google Calendar', description: 'Ask about your schedule', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><path d="M152.637 200H47.363C21.201 200 0 178.799 0 152.637V47.363C0 21.201 21.201 0 47.363 0h105.273C178.799 0 200 21.201 200 47.363v105.273C200 178.799 178.799 200 152.637 200z" fill="#fff" /><path d="M152.637 200H47.363C21.201 200 0 178.799 0 152.637V47.363C0 21.201 21.201 0 47.363 0h105.273C178.799 0 200 21.201 200 47.363v105.273C200 178.799 178.799 200 152.637 200z" fill="#4285f4" fillOpacity="0.12" /><path d="M148.363 32H51.637C40.799 32 32 40.799 32 51.637v96.726C32 159.201 40.799 168 51.637 168h96.726c10.838 0 19.637-8.799 19.637-19.637V51.637C168 40.799 159.201 32 148.363 32z" fill="#fff" /><path d="M168 68H32V51.637C32 40.799 40.799 32 51.637 32h96.726C159.201 32 168 40.799 168 51.637V68z" fill="#4285f4" /><rect x="60" y="42" width="8" height="20" rx="4" fill="#1a73e8" /><rect x="132" y="42" width="8" height="20" rx="4" fill="#1a73e8" /><text x="67" y="108" fontFamily="Google Sans,Arial,sans-serif" fontSize="28" fontWeight="600" fill="#70757a">27</text><rect x="56" y="120" width="36" height="4" rx="2" fill="#ea4335" /><rect x="56" y="130" width="28" height="4" rx="2" fill="#34a853" /><rect x="108" y="88" width="36" height="4" rx="2" fill="#4285f4" /><rect x="108" y="98" width="28" height="4" rx="2" fill="#fbbc04" /><rect x="108" y="120" width="36" height="4" rx="2" fill="#ea4335" /><rect x="108" y="130" width="20" height="4" rx="2" fill="#34a853" /></svg>,
    },
    {
        id: 'google-slides', label: 'Google Slides', description: 'Ask about presentations', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#FBBC04" /><path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#E8A400" /><rect x="13" y="24" width="22" height="14" rx="1.5" fill="#fff" /><rect x="17" y="28" width="14" height="2" rx="1" fill="#FBBC04" /><rect x="17" y="33" width="10" height="2" rx="1" fill="#FBBC04" /></svg>,
    },
    {
        id: 'google-sheets', label: 'Google Sheets', description: 'Create & edit spreadsheets', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#0F9D58" /><path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#087B4A" /><rect x="13" y="22" width="22" height="16" rx="1" fill="#fff" /><line x1="13" y1="28" x2="35" y2="28" stroke="#0F9D58" strokeWidth="1" /><line x1="13" y1="33" x2="35" y2="33" stroke="#0F9D58" strokeWidth="1" /><line x1="24" y1="22" x2="24" y2="38" stroke="#0F9D58" strokeWidth="1" /></svg>,
    },
    {
        id: 'google-docs', label: 'Google Docs', description: 'Create & read documents', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#4285F4" /><path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#2A67C8" /><rect x="14" y="22" width="16" height="2" rx="1" fill="#fff" /><rect x="14" y="27" width="20" height="2" rx="1" fill="#fff" /><rect x="14" y="32" width="12" height="2" rx="1" fill="#fff" /></svg>,
    },
    {
        id: 'google-contacts', label: 'Google Contacts', description: 'Search, create & update contacts', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M40 45H8c-1.66 0-3-1.34-3-3V6c0-1.66 1.34-3 3-3h22l13 13v27c0 1.66-1.34 3-3 3z" fill="#4285F4" /><path d="M30 3l13 13H33c-1.66 0-3-1.34-3-3V3z" fill="#2A67C8" /><circle cx="24" cy="22" r="6" fill="#fff" /><path d="M14 38c0-5.52 4.48-10 10-10s10 4.48 10 10" fill="#fff" /></svg>,
    },
    {
        id: 'google-keep', label: 'Google Keep', description: 'List, create & delete notes', requiresGoogle: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="3" width="38" height="42" rx="3" fill="#FBBC04" /><rect x="14" y="16" width="20" height="3" rx="1.5" fill="#fff" /><rect x="14" y="23" width="20" height="3" rx="1.5" fill="#fff" /><rect x="14" y="30" width="14" height="3" rx="1.5" fill="#fff" /><circle cx="24" cy="10" r="3" fill="#fff" /></svg>,
    },
    {
        id: 'outlook', label: 'Outlook', description: 'Send & read emails', requiresMicrosoft: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="ol_g1" x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse"><stop stopColor="#1490DF"/><stop offset="1" stopColor="#1068BF"/></linearGradient></defs><path d="M44 10.88V37.12A2.88 2.88 0 0 1 41.12 40H22V8h19.12A2.88 2.88 0 0 1 44 10.88z" fill="#1490DF"/><path d="M22 8h11v16H22z" fill="#1068BF" fillOpacity="0.5"/><path d="M33 8h8.12A2.88 2.88 0 0 1 44 10.88V24H33z" fill="#28A8EA"/><path d="M33 24H44v13.12A2.88 2.88 0 0 1 41.12 40H33z" fill="#0078D4"/><path d="M22 24h11v16H22z" fill="#1068BF"/><path d="M26 14L44 14V10.88A2.88 2.88 0 0 0 41.12 8H22l4 6z" fill="#28A8EA" fillOpacity="0.7"/><rect x="2" y="12" width="24" height="24" rx="2.4" fill="url(#ol_g1)"/><text x="14" y="30" textAnchor="middle" fontFamily="Segoe UI,Arial,sans-serif" fontWeight="600" fontSize="16" fill="white">O</text></svg>,
    },
    {
        id: 'ms-calendar', label: 'MS Calendar', description: 'Manage your schedule', requiresMicrosoft: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mc_g1" x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse"><stop stopColor="#1490DF"/><stop offset="1" stopColor="#1068BF"/></linearGradient></defs><path d="M44 10.88V37.12A2.88 2.88 0 0 1 41.12 40H22V8h19.12A2.88 2.88 0 0 1 44 10.88z" fill="#1490DF"/><path d="M22 8h11v16H22z" fill="#1068BF" fillOpacity="0.5"/><path d="M33 8h8.12A2.88 2.88 0 0 1 44 10.88V24H33z" fill="#28A8EA"/><path d="M33 24H44v13.12A2.88 2.88 0 0 1 41.12 40H33z" fill="#0078D4"/><path d="M22 24h11v16H22z" fill="#1068BF"/><rect x="27" y="14" width="3" height="3" rx="0.5" fill="white"/><rect x="32" y="14" width="3" height="3" rx="0.5" fill="white"/><rect x="37" y="14" width="3" height="3" rx="0.5" fill="white"/><rect x="27" y="19" width="3" height="3" rx="0.5" fill="white"/><rect x="32" y="19" width="3" height="3" rx="0.5" fill="white"/><rect x="37" y="19" width="3" height="3" rx="0.5" fill="white"/><rect x="27" y="29" width="3" height="3" rx="0.5" fill="white" fillOpacity="0.7"/><rect x="32" y="29" width="3" height="3" rx="0.5" fill="white" fillOpacity="0.7"/><rect x="27" y="34" width="3" height="3" rx="0.5" fill="white" fillOpacity="0.7"/><rect x="2" y="12" width="24" height="24" rx="2.4" fill="url(#mc_g1)"/><rect x="7" y="19" width="14" height="14" rx="1" fill="white"/><rect x="7" y="17" width="14" height="4" rx="1" fill="#1068BF"/><rect x="10" y="15.5" width="1.5" height="3" rx="0.75" fill="white"/><rect x="16.5" y="15.5" width="1.5" height="3" rx="0.75" fill="white"/><rect x="9" y="24" width="3" height="2" rx="0.5" fill="#1490DF" fillOpacity="0.8"/><rect x="14" y="24" width="3" height="2" rx="0.5" fill="#1490DF" fillOpacity="0.5"/><rect x="9" y="28" width="3" height="2" rx="0.5" fill="#1490DF" fillOpacity="0.5"/></svg>,
    },
    {
        id: 'onedrive', label: 'OneDrive', description: 'Access files & folders', requiresMicrosoft: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M19.55 22.1l8.65-5.3a11.09 11.09 0 0 1 5.7-1.57A11.23 11.23 0 0 1 44 24.9l.08.6A7.54 7.54 0 0 1 39.5 39H14.05a9.05 9.05 0 0 1-3.85-17.25z" fill="#0364B8"/><path d="M19.55 22.1l.15-.25A12.8 12.8 0 0 1 26.35 17a11.09 11.09 0 0 1 1.85-.17l-.4-.03A12.75 12.75 0 0 0 14.95 8.5a12.8 12.8 0 0 0-12.7 10.72 9.55 9.55 0 0 1 7.95 2.53z" fill="#0078D4"/><path d="M10.2 21.75A9.55 9.55 0 0 0 2.25 19.22 9.55 9.55 0 0 0 3.9 38.04l.15.01 10-1.05.01-.01a9.05 9.05 0 0 1-3.86-15.24z" fill="#1490DF"/><path d="M33.9 15.23A11.23 11.23 0 0 0 28.2 16.8l-8.65 5.3a9.05 9.05 0 0 0 3.85 14.95l.65.01H39.5a7.54 7.54 0 0 0 4.58-13.56l-.08-.6a11.23 11.23 0 0 0-10.1-7.67z" fill="#28A8EA"/></svg>,
    },
    {
        id: 'ms-contacts', label: 'MS Contacts', description: 'Search & manage contacts', requiresMicrosoft: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="mp_g1" x1="24" y1="2" x2="24" y2="46" gradientUnits="userSpaceOnUse"><stop stopColor="#1490DF"/><stop offset="1" stopColor="#1068BF"/></linearGradient></defs><path d="M44 10.88V37.12A2.88 2.88 0 0 1 41.12 40H22V8h19.12A2.88 2.88 0 0 1 44 10.88z" fill="#1490DF"/><path d="M22 8h11v16H22z" fill="#1068BF" fillOpacity="0.5"/><path d="M33 8h8.12A2.88 2.88 0 0 1 44 10.88V24H33z" fill="#28A8EA"/><path d="M33 24H44v13.12A2.88 2.88 0 0 1 41.12 40H33z" fill="#0078D4"/><path d="M22 24h11v16H22z" fill="#1068BF"/><circle cx="34" cy="17" r="4" fill="white"/><path d="M27.5 31c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" fill="white"/><rect x="2" y="12" width="24" height="24" rx="2.4" fill="url(#mp_g1)"/><circle cx="14" cy="21" r="3.5" fill="white"/><path d="M8 31c0-3.31 2.69-6 6-6s6 2.69 6 6" fill="white"/></svg>,
    },
    {
        id: 'fireflies', label: 'Fireflies.ai', description: 'Meeting transcripts', requiresFireflies: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="22 20 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30.5749 22H24V28.5267H30.5749V22Z" fill="url(#ff_app_g1)" /><path d="M38.3633 29.8789H31.7883V36.4056H38.3633V29.8789Z" fill="url(#ff_app_g2)" /><path d="M38.3633 22H31.7883V28.5267H43.9998V27.594C43.9997 26.1104 43.4058 24.6875 42.3489 23.6384C41.2919 22.5894 39.8585 22 38.3638 22H38.3633Z" fill="url(#ff_app_g3)" /><path d="M24 29.8789V36.4056C24.0002 37.8892 24.594 39.3121 25.6509 40.3612C26.7079 41.4103 28.1413 41.9996 29.636 41.9996H30.5749V29.8789H24Z" fill="url(#ff_app_g4)" /><defs><linearGradient id="ff_app_g1" x1="40.08" y1="38.51" x2="12.44" y2="9.47" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ff_app_g2" x1="40.18" y1="38.42" x2="12.54" y2="9.38" gradientUnits="userSpaceOnUse"><stop stopColor="#FF3C82" /><stop offset="0.49" stopColor="#B251B2" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ff_app_g3" x1="44.77" y1="34.05" x2="35.4" y2="0.12" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient><linearGradient id="ff_app_g4" x1="35.55" y1="42.82" x2="2.03" y2="32.61" gradientUnits="userSpaceOnUse"><stop stopColor="#E82A73" /><stop offset="0.54" stopColor="#9B4AB0" /><stop offset="1" stopColor="#3B73FF" /></linearGradient></defs></svg>,
    },
    {
        id: 'youtrack', label: 'YouTrack', description: 'Issues and projects', requiresYouTrack: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="yt_app_g1" x1="12" y1="58" x2="58" y2="12" gradientUnits="userSpaceOnUse"><stop stopColor="#FC3791" /><stop offset="0.52" stopColor="#9B4AB0" /><stop offset="1" stopColor="#6166E8" /></linearGradient></defs><rect width="70" height="70" rx="14" fill="url(#yt_app_g1)" /><path d="M16 18h38v34H16z" fill="white" fillOpacity="0.9" /><path d="M20 25h20v3H20zM20 32h28v3H20zM20 39h14v3H20z" fill="url(#yt_app_g1)" /></svg>,
    },
    {
        id: 'gamma', label: 'Gamma', description: 'AI presentations', requiresGamma: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h16v16H4z" rx="3" fill="url(#gamma_app_g1)" /><path d="M8 9h8v1.5H8zM8 12.5h6v1.5H8zM8 16h4v1.5H8z" fill="white" fillOpacity="0.9" /><defs><linearGradient id="gamma_app_g1" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop stopColor="#6366F1" /><stop offset="1" stopColor="#A855F7" /></linearGradient></defs></svg>,
    },
    {
        id: 'web-search', label: 'Web Search', description: 'Search the web', requiresNone: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="11" cy="11" r="7" stroke="#6366F1" strokeWidth="2" fill="none" /><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" /><circle cx="11" cy="11" r="3" stroke="#6366F1" strokeWidth="1.5" fill="rgba(99,102,241,0.1)" /></svg>,
    },
    {
        id: 'google-maps', label: 'Google Maps', description: 'Directions, routes & places', requiresNone: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#EA4335"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>,
    },

    {
        id: 'image-gen', label: 'Image Generation', description: 'AI image creation settings', requiresNone: true,
        iconSvg: (s = 'w-5 h-5') => <span className={`${s} flex items-center justify-center text-base`}>🍌</span>,
    },
    {
        id: 'elevenlabs', label: 'ElevenLabs', description: 'Music with vocals, TTS & sound effects', requiresNone: true,
        iconSvg: (s = 'w-5 h-5') => <span className={`${s} flex items-center justify-center text-base`}>🎵</span>,
    },
    {
        id: 'whatsapp', label: 'WhatsApp', description: 'Send & read messages', requiresWhatsApp: true,
        iconSvg: (s = 'w-5 h-5') => <svg className={s} viewBox="0 0 24 24" fill="#25D366" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
    },
];

const InputArea = ({
    onSendMessage,
    onStopGenerating,
    isLoading,
    selectedAgent,
    activeThreadParent,
    threadTitle,
    onExitThread,
    warningText,
    directMode,
    modelTiers,
    selectedTier,
    onTierChange,
    input,
    setInput,
    agentIntegrations,
    isMobile
}) => {
    const [attachments, setAttachments] = useState([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [drivePickerOpen, setDrivePickerOpen] = useState(false);
    const [gmailPickerOpen, setGmailPickerOpen] = useState(false);
    const [imageGenOpen, setImageGenOpen] = useState(false);
    const [imageGenSettings, setImageGenSettings] = useState(loadSettings);
    const [musicGenOpen, setMusicGenOpen] = useState(false);
    const [elevenLabsOpen, setElevenLabsOpen] = useState(false);
    const [videoGenOpen, setVideoGenOpen] = useState(false);
    const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
    // Per-integration enable/disable — user-scoped so toggling "disable images"
    // as user A doesn't persist into user B's composer on the same browser.
    const [disabledMedia, setDisabledMedia] = useState(() => scopedStorage.getJSON('disabledMedia', {}));
    const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
        const v = scopedStorage.getItem('webSearchEnabled');
        return v === null ? true : v === 'true';
    });
    const [orgDisableSearchOnUpload, setOrgDisableSearchOnUpload] = useState(false);
    const [searchProviderConfig, setSearchProviderConfig] = useState('agent-search');
    const [hasFirefliesKey, setHasFirefliesKey] = useState(false);
    const [orgEnabledIntegrations, setOrgEnabledIntegrations] = useState(null);
    const [hasGoogleKey, setHasGoogleKey] = useState(false);
    const [hasElevenLabsKey, setHasElevenLabsKey] = useState(false);
    const [hasYouTrackConfig, setHasYouTrackConfig] = useState(false);
    const [hasGammaKey, setHasGammaKey] = useState(false);
    const [hasWhatsApp, setHasWhatsApp] = useState(false);
    const [n8nWorkflows, setN8nWorkflows] = useState([]);
    const [mcpServers, setMcpServers] = useState([]);

    const [isGoogleUser, setIsGoogleUser] = useState(false);
    const [isMicrosoftUser, setIsMicrosoftUser] = useState(false);
    const imageGenBtnRef = useRef(null);
    const musicGenBtnRef = useRef(null);
    const elevenLabsBtnRef = useRef(null);
    const videoGenBtnRef = useRef(null);
    const mediaMenuBtnRef = useRef(null);
    const mediaMenuRef = useRef(null);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const dropZoneRef = useRef(null);
    const appsRef = useRef(null);
    const [appsOverlayOpen, setAppsOverlayOpen] = useState(false);
    const [appSearch, setAppSearch] = useState('');

    // Close media menu on click outside
    useEffect(() => {
        if (!mediaMenuOpen) return;
        const handler = (e) => {
            if (mediaMenuRef.current?.contains(e.target)) return;
            if (mediaMenuBtnRef.current?.contains(e.target)) return;
            setMediaMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [mediaMenuOpen]);

    // Apps enable/disable state (loaded from server, synced on change)
    const [enabledApps, setEnabledApps] = useState(null); // null = all enabled

    // Save enabled apps to server
    const toggleApp = (appId) => {
        setEnabledApps(prev => {
            const defaults = APP_DEFS.filter(a => !a.requiresNone).map(a => a.id);
            const current = prev || defaults;
            const next = current.includes(appId)
                ? current.filter(id => id !== appId)
                : [...current, appId];
            // Persist to server (fire-and-forget)
            authFetch(`${API_BASE}/ai/user-settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabledApps: next }),
            }).catch(() => { });
            return next;
        });
    };

    const isAppEnabled = (appId) => {
        if (!enabledApps) return true; // all enabled by default
        return enabledApps.includes(appId);
    };

    // Close apps overlay on outside click
    useEffect(() => {
        if (!appsOverlayOpen) return;
        const close = (e) => { if (appsRef.current && !appsRef.current.contains(e.target)) setAppsOverlayOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [appsOverlayOpen]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px';
        }
    }, [input]);

    // Check user settings (Fireflies key, Google SSO status, enabled apps)
    useEffect(() => {
        authFetch(`${API_BASE}/ai/user-settings`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) {
                    setHasFirefliesKey(!!data.hasFirefliesKey);
                    setHasYouTrackConfig(!!data.hasYouTrackConfig);
                    setHasGammaKey(!!data.hasGammaKey);

                    setIsGoogleUser(!!data.isGoogleUser);
                    setIsMicrosoftUser(!!data.isMicrosoftUser);
                    if (data.enabledApps) setEnabledApps(data.enabledApps);
                    if (data.orgEnabledIntegrations !== undefined) setOrgEnabledIntegrations(data.orgEnabledIntegrations);
                    if (data.hasGoogleKey !== undefined) setHasGoogleKey(data.hasGoogleKey);
                    if (data.hasElevenLabsKey !== undefined) setHasElevenLabsKey(data.hasElevenLabsKey);
                    if (data.disableSearchOnUpload) setOrgDisableSearchOnUpload(true);
                    if (data.searchProvider) setSearchProviderConfig(data.searchProvider);
                }
            })
            .catch(() => { });
        // Fetch n8n workflows if n8n is available
        authFetch(`${API_BASE}/ai/n8n/config`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.workflows?.length) {
                    setN8nWorkflows(data.workflows.filter(w => w.enabled && !w.allowKbIngestion));
                }
            })
            .catch(() => { });
        // Check WhatsApp connection status
        authFetch(`${API_BASE}/api/integrations/whatsapp/status`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && (data.status === 'connected' || data.hasSavedSession)) {
                    setHasWhatsApp(true);
                }
            })
            .catch(() => { });
        // Fetch MCP servers for apps menu
        authFetch(`${API_BASE}/ai/mcp-servers/user-credentials`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.servers?.length) {
                    setMcpServers(data.servers.filter(s => s.toolCount > 0));
                }
            })
            .catch(() => { });
    }, []);

    // Process files (shared between file input, drop, and paste)
    const processFiles = useCallback(async (files) => {
        if (files.length === 0) return;
        const newAttachments = [];

        for (const file of files) {
            // Limit file size to 20MB
            if (file.size > 20 * 1024 * 1024) {
                console.warn(`File ${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)}MB), max 20MB`);
                continue;
            }

            const reader = new FileReader();
            const content = await new Promise((resolve) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });

            newAttachments.push({
                name: file.name,
                type: file.type || 'application/octet-stream',
                size: file.size,
                content: content
            });
        }

        if (newAttachments.length > 0) {
            setAttachments(prev => [...prev, ...newAttachments]);
        }
    }, []);

    const handleFileSelect = async (e) => {
        const files = Array.from(e.target.files || []);
        await processFiles(files);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // ---- Drag & Drop ----
    const handleDragEnter = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set false if leaving the drop zone entirely
        if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget)) {
            setIsDragOver(false);
        }
    }, []);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0) {
            await processFiles(files);
        }
    }, [processFiles]);

    // ---- Paste (Ctrl+V) ----
    // Extract files from clipboardData (sync — classic approach)
    const extractPasteFiles = useCallback((clipboardData) => {
        if (!clipboardData) return [];
        const files = [];

        // Method 1: clipboardData.items (Chrome, Edge, most browsers)
        const items = Array.from(clipboardData.items || []);
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    if (file.type.startsWith('image/') && (!file.name || file.name === 'image.png')) {
                        const ext = file.type.split('/')[1] || 'png';
                        files.push(new File([file], `pasted-image-${Date.now()}.${ext}`, { type: file.type }));
                    } else {
                        files.push(file);
                    }
                }
            }
        }

        // Method 2: clipboardData.files fallback (Firefox)
        if (files.length === 0) {
            const clipFiles = Array.from(clipboardData.files || []);
            for (const file of clipFiles) {
                if (file.type.startsWith('image/')) {
                    const ext = file.type.split('/')[1] || 'png';
                    files.push(new File([file], `pasted-image-${Date.now()}.${ext}`, { type: file.type }));
                } else {
                    files.push(file);
                }
            }
        }

        return files;
    }, []);

    // Extract image from HTML clipboard data (e.g. images copied from web pages)
    const extractImageFromHtml = useCallback(async (clipboardData) => {
        if (!clipboardData) return null;
        const items = Array.from(clipboardData.items || []);
        const htmlItem = items.find(i => i.kind === 'string' && i.type === 'text/html');
        if (!htmlItem) return null;

        const html = await new Promise(resolve => htmlItem.getAsString(resolve));
        // Look for <img> tags with data URLs or http URLs
        const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
        if (!imgMatch) return null;

        const src = imgMatch[1];
        try {
            if (src.startsWith('data:image/')) {
                // Base64 data URL — convert to File
                const res = await fetch(src);
                const blob = await res.blob();
                const ext = blob.type.split('/')[1] || 'png';
                return new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: blob.type });
            } else if (src.startsWith('http')) {
                // Try to fetch the remote image
                const res = await fetch(src);
                if (res.ok) {
                    const blob = await res.blob();
                    if (blob.type.startsWith('image/')) {
                        const ext = blob.type.split('/')[1] || 'png';
                        return new File([blob], `pasted-image-${Date.now()}.${ext}`, { type: blob.type });
                    }
                }
            }
        } catch (err) {
            console.warn('[Paste] Failed to extract image from HTML:', err);
        }
        return null;
    }, []);

    // Async fallback using navigator.clipboard.read() (works on Linux/Wayland where clipboardData is empty)
    const readClipboardAsync = useCallback(async () => {
        if (!navigator.clipboard?.read) {
            console.log('[Paste] navigator.clipboard.read not available');
            return [];
        }
        try {
            const clipboardItems = await navigator.clipboard.read();
            const files = [];
            for (const item of clipboardItems) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        const blob = await item.getType(type);
                        const ext = type.split('/')[1] || 'png';
                        files.push(new File([blob], `pasted-image-${Date.now()}.${ext}`, { type }));
                    }
                }
            }
            console.log(`[Paste] navigator.clipboard.read() found ${files.length} image(s)`);
            return files;
        } catch (err) {
            console.warn('[Paste] navigator.clipboard.read() failed:', err.message);
            return [];
        }
    }, []);

    // Check if clipboard might contain image data (even if not directly accessible sync)
    const clipboardMayHaveImage = useCallback((clipboardData) => {
        if (!clipboardData) return false;
        const items = Array.from(clipboardData.items || []);
        // Check for any image type in items
        for (const item of items) {
            if (item.type.startsWith('image/')) return true;
        }
        // Also check files list
        const clipFiles = Array.from(clipboardData.files || []);
        if (clipFiles.some(f => f.type.startsWith('image/'))) return true;
        // On Linux/Wayland, screenshot images are only accessible via the async
        // navigator.clipboard.read() API — clipboardData.items will be empty.
        // Text paste on the same systems DOES populate items with text/plain,
        // so empty items reliably signals a potential screenshot, not plain text.
        if (items.length === 0 && clipFiles.length === 0) return true;
        return false;
    }, []);

    const handlePaste = useCallback(async (e) => {
        console.log('[Paste] Paste event fired. Items:', e.clipboardData?.items?.length, 'Files:', e.clipboardData?.files?.length);

        // Try sync extraction first (fastest, works on most browsers)
        let files = extractPasteFiles(e.clipboardData);

        if (files.length > 0) {
            console.log('[Paste] Sync extraction found', files.length, 'file(s)');
            e.preventDefault();
            await processFiles(files);
            return;
        }

        // Try extracting image from HTML clipboard (copied from web pages)
        const htmlImage = await extractImageFromHtml(e.clipboardData);
        if (htmlImage) {
            console.log('[Paste] HTML image extraction succeeded');
            e.preventDefault();
            await processFiles([htmlImage]);
            return;
        }

        // Async fallback: navigator.clipboard.read() for Linux/Wayland screenshots
        // This fires when the sync clipboardData shows image MIME types but getAsFile()
        // returns null (a known Wayland/browser quirk).
        // We also try if items has explicit image types but sync extraction somehow missed them.
        const hasClipboardAPI = !!navigator.clipboard?.read;
        const maybeImage = clipboardMayHaveImage(e.clipboardData);

        if (hasClipboardAPI && maybeImage) {
            console.log('[Paste] Trying async clipboard API (Linux/Wayland screenshot fallback)');
            // Check permission first to avoid blocking text paste if denied
            let permissionOk = true;
            try {
                const perm = await navigator.permissions.query({ name: 'clipboard-read' });
                if (perm.state === 'denied') {
                    console.warn('[Paste] clipboard-read permission denied — skipping async API, letting text paste proceed');
                    permissionOk = false;
                }
            } catch (_) { /* permissions API not available — proceed optimistically */ }

            if (permissionOk) {
                // Must preventDefault BEFORE the async call to avoid the textarea inserting garbage
                e.preventDefault();
                files = await readClipboardAsync();
                if (files.length > 0) {
                    await processFiles(files);
                } else {
                    console.log('[Paste] Async clipboard API returned no images');
                }
            }
        }
        // If none of the above matched, let the default paste behavior handle it (text paste)
    }, [processFiles, extractPasteFiles, extractImageFromHtml, readClipboardAsync, clipboardMayHaveImage]);

    // Document-level paste listener (catches pastes ONLY when textarea doesn't have focus)
    useEffect(() => {
        const onDocumentPaste = async (e) => {
            if (!textareaRef.current) return;
            const activeEl = document.activeElement;
            // If the textarea has focus, its own onPaste handler already handles it — skip
            if (activeEl === textareaRef.current) return;
            // Skip other inputs/textareas too
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) return;

            console.log('[Paste/Doc] Document paste event. Items:', e.clipboardData?.items?.length, 'Files:', e.clipboardData?.files?.length);

            let files = extractPasteFiles(e.clipboardData);
            if (files.length > 0) {
                e.preventDefault();
                await processFiles(files);
                textareaRef.current?.focus();
                return;
            }

            // HTML image fallback
            const htmlImage = await extractImageFromHtml(e.clipboardData);
            if (htmlImage) {
                e.preventDefault();
                await processFiles([htmlImage]);
                textareaRef.current?.focus();
                return;
            }

            // Async clipboard API fallback — only if items explicitly show image types
            if (clipboardMayHaveImage(e.clipboardData) && navigator.clipboard?.read) {
                let permissionOk = true;
                try {
                    const perm = await navigator.permissions.query({ name: 'clipboard-read' });
                    if (perm.state === 'denied') permissionOk = false;
                } catch (_) { /* proceed */ }

                if (permissionOk) {
                    e.preventDefault();
                    files = await readClipboardAsync();
                    if (files.length > 0) {
                        await processFiles(files);
                        textareaRef.current?.focus();
                    }
                }
            }
        };

        document.addEventListener('paste', onDocumentPaste);
        return () => document.removeEventListener('paste', onDocumentPaste);
    }, [processFiles, extractPasteFiles, extractImageFromHtml, readClipboardAsync, clipboardMayHaveImage]);

    const removeAttachment = (index) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const getFileIcon = (type) => {
        if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
        if (type.includes('pdf') || type.includes('word') || type.includes('.document')) return <FileText className="w-4 h-4" />;
        if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return <FileSpreadsheet className="w-4 h-4" />;
        return <FileIcon className="w-4 h-4" />;
    };

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const handleSend = () => {
        if ((!input.trim() && attachments.length === 0) || isLoading) return;
        onSendMessage(input, attachments, activeThreadParent);
        setInput('');
        setAttachments([]);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
    };

    const handleKeyDown = (e) => {
        // On mobile, Enter creates a new line (send via button only)
        // On desktop, Enter sends, Shift+Enter creates new line
        if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
            e.preventDefault();
            handleSend();
        }
    };



    return (
        <>
            <div
                ref={dropZoneRef}
                className={`${isMobile ? 'px-2 py-1.5' : 'px-4 py-2.5'} bg-[var(--bg-primary)] relative z-20`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Drag overlay */}
                {isDragOver && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--accent-primary)] bg-opacity-10 border-2 border-dashed border-[var(--accent-primary)] rounded-xl backdrop-blur-sm pointer-events-none"
                        style={{ margin: '8px' }}
                    >
                        <div className="flex flex-col items-center gap-2 text-[var(--accent-primary)]">
                            <Image className="w-8 h-8" />
                            <span className="text-sm font-medium">Drop files here</span>
                        </div>
                    </div>
                )}

                <div className="max-w-3xl mx-auto">

                    {/* Thread Banner */}
                    {activeThreadParent && (
                        <div className="flex items-center justify-between bg-[var(--bg-secondary)] px-4 py-2 rounded-t-lg border-x border-t border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] animate-slide-up">
                            <div className="flex items-center gap-2">
                                <MessageCircle className="w-3 h-3 text-[var(--accent-primary)]" />
                                <span>Replying to <span className="font-medium text-[var(--text-primary)]">{threadTitle || 'Thread'}</span></span>
                            </div>
                            <button onClick={onExitThread} className="hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors">
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {/* Attachment Preview */}
                    {attachments.length > 0 && (
                        <div className={`flex flex-wrap gap-2 bg-[var(--bg-secondary)] px-3 py-2.5 border-x border-t border-[var(--border-subtle)] ${activeThreadParent ? '' : 'rounded-t-xl'}`}>
                            {attachments.map((att, idx) =>
                                att.type.startsWith('image/') ? (
                                    // Image attachment — card with thumbnail + overlaid remove button
                                    <div
                                        key={idx}
                                        className="relative group flex-shrink-0"
                                    >
                                        <img
                                            src={att.content}
                                            alt={att.name}
                                            className="w-16 h-16 object-cover rounded-xl border border-[var(--border-subtle)] shadow-sm"
                                        />
                                        {/* Filename overlay at bottom */}
                                        <div className="absolute bottom-0 left-0 right-0 bg-black/50 rounded-b-xl px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-white text-[9px] truncate block">{att.name}</span>
                                        </div>
                                        {/* Remove button — top-right corner */}
                                        <button
                                            onClick={() => removeAttachment(idx)}
                                            className="absolute -top-1.5 -right-1.5 bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded-full p-0.5 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50 hover:border-red-300 hover:text-red-500 text-[var(--text-tertiary)]"
                                            aria-label="Remove attachment"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    // Non-image attachment — refined pill
                                    <div
                                        key={idx}
                                        className="flex items-center gap-2 bg-[var(--bg-tertiary)] border border-[var(--border-subtle)] hover:border-[var(--border-primary)] px-2.5 py-2 rounded-xl text-xs text-[var(--text-secondary)] transition-colors group"
                                    >
                                        <div className="text-[var(--text-tertiary)]">{getFileIcon(att.type)}</div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate max-w-[120px] font-medium text-[var(--text-primary)]">{att.name}</span>
                                            <span className="text-[10px] text-[var(--text-tertiary)]">{formatFileSize(att.size)}</span>
                                        </div>
                                        <button
                                            onClick={() => removeAttachment(idx)}
                                            className="p-0.5 ml-0.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-tertiary)] hover:text-red-500 transition-colors"
                                            aria-label="Remove attachment"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )
                            )}
                        </div>
                    )}


                    <div role="form" aria-label="Chat message input" data-testid="chat-input-form" className={`relative flex flex-col bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] shadow-md transition-all focus-within:border-[var(--accent-primary)] focus-within:shadow-lg focus-within:shadow-[var(--accent-primary)]/10 ${(activeThreadParent || attachments.length > 0) ? 'rounded-t-none border-t-0' : ''} ${isDragOver ? 'border-[var(--accent-primary)] shadow-lg' : ''}`}>

                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            multiple
                            accept="image/*,.pdf,.docx,.csv,.xlsx,.xls,.txt,.md,.json,.js,.jsx,.ts,.tsx,.py,.html,.css"
                            className="hidden"
                            aria-label="Upload file attachment"
                            data-testid="file-upload"
                        />

                        {/* Textarea Row */}
                        <div className={`${isMobile ? 'px-2' : 'px-4'} pt-3 pb-1`}>
                            <textarea
                                ref={textareaRef}
                                id="chat-message-input"
                                name="message"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                placeholder={activeThreadParent ? "Reply to thread..." : directMode ? "Message AI..." : "Message " + (selectedAgent?.name || "Agent") + "..."}
                                aria-label="Chat message"
                                data-testid="chat-message-input"
                                rows={1}
                                className="w-full max-h-[180px] bg-transparent border-none focus:ring-0 text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none py-2 text-[15px] leading-relaxed overflow-y-auto outline-none"
                            />
                        </div>

                        {/* Toolbar Row */}
                        <div className="flex items-center justify-between px-3 pb-3">
                            <div className="flex items-center gap-1">
                                {/* Attach Button */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
                                    title="Attach file"
                                    aria-label="Attach file"
                                    data-testid="attach-file-button"
                                >
                                    <Paperclip className="w-5 h-5" />
                                </button>
                                {/* Multimedia Creation — grouped dropdown (gated by org settings + agent disableExternalTools) */}
                                {!selectedAgent?.config?.disableExternalTools && (() => {
                                    const orgOn = (id) => !orgEnabledIntegrations || orgEnabledIntegrations.includes(id);
                                    const showImageGen = orgOn('image-gen') && hasGoogleKey;
                                    const showMusicGen = orgOn('music-gen') && hasGoogleKey;
                                    const showElevenLabs = orgOn('elevenlabs') && hasElevenLabsKey;
                                    const showVideoGen = orgOn('video-gen') && hasGoogleKey;
                                    if (!showImageGen && !showMusicGen && !showElevenLabs && !showVideoGen) return null;
                                    return (
                                        <div className="relative">
                                            <button
                                                ref={mediaMenuBtnRef}
                                                onClick={() => setMediaMenuOpen(!mediaMenuOpen)}
                                                className={`p-2 rounded-lg transition-colors text-base leading-none ${mediaMenuOpen || imageGenOpen || musicGenOpen || elevenLabsOpen || videoGenOpen ? 'bg-purple-500/10 text-purple-400' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                                                title="Multimedia Creation"
                                                aria-label="Multimedia Creation"
                                                data-testid="multimedia-button"
                                            >
                                                🎨
                                            </button>
                                            {mediaMenuOpen && (
                                                <div
                                                    ref={mediaMenuRef}
                                                    className="absolute bottom-full left-0 mb-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-xl p-1.5 min-w-[180px] z-50"
                                                >
                                                    {showImageGen && (
                                                        <button
                                                            ref={imageGenBtnRef}
                                                            onClick={() => { setMediaMenuOpen(false); setImageGenOpen(true); }}
                                                            onContextMenu={(e) => { e.preventDefault(); const next = { ...disabledMedia, image: !disabledMedia.image }; setDisabledMedia(next); scopedStorage.setJSON('disabledMedia', next); }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm text-left"
                                                            style={{ opacity: disabledMedia.image ? 0.35 : 1 }}
                                                        >
                                                            <span className="text-base">🍌</span>
                                                            <span className="text-[var(--text-primary)]">Image Generation</span>
                                                        </button>
                                                    )}
                                                    {showMusicGen && (
                                                        <button
                                                            ref={musicGenBtnRef}
                                                            onClick={() => { setMediaMenuOpen(false); setMusicGenOpen(true); }}
                                                            onContextMenu={(e) => { e.preventDefault(); const next = { ...disabledMedia, music: !disabledMedia.music }; setDisabledMedia(next); scopedStorage.setJSON('disabledMedia', next); }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm text-left"
                                                            style={{ opacity: disabledMedia.music ? 0.35 : 1 }}
                                                        >
                                                            <span className="text-base">🎹</span>
                                                            <span className="text-[var(--text-primary)]">Music Generation</span>
                                                        </button>
                                                    )}
                                                    {showElevenLabs && (
                                                        <button
                                                            ref={elevenLabsBtnRef}
                                                            onClick={() => { setMediaMenuOpen(false); setElevenLabsOpen(true); }}
                                                            onContextMenu={(e) => { e.preventDefault(); const next = { ...disabledMedia, elevenlabs: !disabledMedia.elevenlabs }; setDisabledMedia(next); scopedStorage.setJSON('disabledMedia', next); }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm text-left"
                                                            style={{ opacity: disabledMedia.elevenlabs ? 0.35 : 1 }}
                                                        >
                                                            <span className="text-base">🎵</span>
                                                            <span className="text-[var(--text-primary)]">ElevenLabs</span>
                                                        </button>
                                                    )}
                                                    {showVideoGen && (
                                                        <button
                                                            ref={videoGenBtnRef}
                                                            onClick={() => { setMediaMenuOpen(false); setVideoGenOpen(true); }}
                                                            onContextMenu={(e) => { e.preventDefault(); const next = { ...disabledMedia, video: !disabledMedia.video }; setDisabledMedia(next); scopedStorage.setJSON('disabledMedia', next); }}
                                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors text-sm text-left"
                                                            style={{ opacity: disabledMedia.video ? 0.35 : 1 }}
                                                        >
                                                            <span className="text-base">🎬</span>
                                                            <span className="text-[var(--text-primary)]">Video Generation</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <ImageGenSettings
                                                isOpen={imageGenOpen}
                                                onClose={() => setImageGenOpen(false)}
                                                anchorRef={imageGenBtnRef}
                                                settings={imageGenSettings}
                                                onSettingsChange={setImageGenSettings}
                                            />
                                            <MusicGenSettings
                                                isOpen={musicGenOpen}
                                                onClose={() => setMusicGenOpen(false)}
                                                anchorRef={musicGenBtnRef}
                                            />
                                            <ElevenLabsSettings
                                                isOpen={elevenLabsOpen}
                                                onClose={() => setElevenLabsOpen(false)}
                                                anchorRef={elevenLabsBtnRef}
                                            />
                                            <VideoGenSettings
                                                isOpen={videoGenOpen}
                                                onClose={() => setVideoGenOpen(false)}
                                                anchorRef={videoGenBtnRef}
                                            />
                                        </div>
                                    );
                                })()}
                                {/* Web Search Toggle (gated by org settings for agent-search + agent disableExternalTools) */}
                                {!selectedAgent?.config?.disableExternalTools && searchProviderConfig !== 'disabled' && (!orgEnabledIntegrations || orgEnabledIntegrations.includes('agent-search')) && (
                                <button
                                    onClick={() => {
                                        if (orgDisableSearchOnUpload && attachments.length > 0) return;
                                        const next = !webSearchEnabled;
                                        setWebSearchEnabled(next);
                                        scopedStorage.setItem('webSearchEnabled', String(next));
                                    }}
                                    className={`p-2 rounded-lg transition-colors ${orgDisableSearchOnUpload && attachments.length > 0 ? 'text-orange-400/60 opacity-50 cursor-not-allowed bg-orange-500/5' : webSearchEnabled ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20' : 'text-[var(--text-tertiary)] opacity-40 hover:opacity-70 hover:bg-[var(--bg-tertiary)]'}`}
                                    title={orgDisableSearchOnUpload && attachments.length > 0 ? 'Web search disabled by organisation policy (files attached)' : webSearchEnabled ? 'Web search enabled (click to disable)' : 'Web search disabled (click to enable)'}
                                    aria-label={webSearchEnabled ? 'Web search enabled' : 'Web search disabled'}
                                    aria-pressed={webSearchEnabled}
                                    data-testid="web-search-toggle"
                                >
                                    <Globe className="w-5 h-5" />
                                </button>
                                )}
                                {/* Apps Button — hidden if no apps available or agent disableExternalTools */}
                                {!selectedAgent?.config?.disableExternalTools && (() => {
                                    const n8nAppDefs = n8nWorkflows.map(wf => ({
                                        id: `n8n_run_${wf.slug}`,
                                        label: wf.name,
                                        description: wf.description || 'n8n workflow',
                                        iconSvg: (s = 'w-5 h-5') => <img src="/n8n-color.png" alt="n8n" className={`${s} object-contain`} />,
                                        isN8n: true,
                                    }));
                                    const mcpAppDefs = mcpServers.map(srv => ({
                                        id: `mcp_${srv.id}`,
                                        label: srv.name,
                                        description: `${srv.toolCount} tools available${srv.allConfigured ? '' : ' — credentials needed'}`,
                                        iconSvg: (s = 'w-5 h-5') => <span className={`${s} flex items-center justify-center text-base`}>{srv.icon || '🔌'}</span>,
                                        isMcp: true,
                                        mcpConfigured: srv.allConfigured,
                                        requiresNone: false,
                                    }));
                                    const allAppDefs = [...APP_DEFS, ...n8nAppDefs, ...mcpAppDefs];
                                    const availableApps = allAppDefs.filter(app => {
                                        // Base availability checks
                                        if (app.requiresGoogle && !isGoogleUser) return false;
                                        if (app.requiresMicrosoft && !isMicrosoftUser) return false;
                                        if (app.requiresFireflies && !hasFirefliesKey) return false;
                                        if (app.requiresYouTrack && !hasYouTrackConfig) return false;
                                        if (app.requiresGamma && !hasGammaKey) return false;
                                        if (app.requiresWhatsApp && !hasWhatsApp) return false;
                                        // Org-level gating — gate ALL apps (matching backend ORG_EXEMPT_APPS logic)
                                        if (orgEnabledIntegrations) {
                                            if (app.isMcp) {
                                                // MCP servers use mcp:{serverId} format in enabledIntegrations
                                                const mcpId = `mcp:${app.id.replace(/^mcp_/, '')}`;
                                                if (!orgEnabledIntegrations.includes(mcpId)) return false;
                                            } else if (app.isN8n) {
                                                if (!orgEnabledIntegrations.includes('n8n')) return false;
                                            } else if (!app.requiresNone) {
                                                // All standard apps (Google, Microsoft, AI, third-party)
                                                if (!orgEnabledIntegrations.includes(app.id)) return false;
                                            }
                                        }
                                        if (app.requiresNone) return false;
                                        // Agent-level integration filtering (MCP apps bypass — they're globally available)
                                        if (agentIntegrations && !app.isMcp) {
                                            if (app.isN8n) return agentIntegrations.includes('n8n');
                                            return agentIntegrations.includes(app.id);
                                        }
                                        return true;
                                    });
                                    if (availableApps.length === 0) return null;
                                    return (
                                        <div className="relative" ref={appsRef}>
                                            <button
                                                onClick={() => { setAppsOverlayOpen(v => !v); setAppSearch(''); }}
                                                className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${appsOverlayOpen ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}
                                                title="Apps"
                                            >
                                                <LayoutGrid className="w-5 h-5" />
                                            </button>
                                            {appsOverlayOpen && (() => {
                                                const filtered = appSearch.trim()
                                                    ? availableApps.filter(a => a.label.toLowerCase().includes(appSearch.toLowerCase()) || a.description.toLowerCase().includes(appSearch.toLowerCase()))
                                                    : availableApps;
                                                const handleAppClick = (app) => {
                                                    if (!isAppEnabled(app.id)) return;
                                                    setAppsOverlayOpen(false);
                                                    switch (app.id) {
                                                        case 'google-drive': setDrivePickerOpen(true); break;
                                                        case 'gmail': setGmailPickerOpen(true); break;
                                                        case 'google-calendar': setInput("What's on my calendar this week?"); break;
                                                        case 'google-slides': setInput('List my recent presentations'); break;
                                                        case 'google-sheets': setInput('List my Google Sheets spreadsheets'); break;
                                                        case 'google-docs': setInput('List my recent Google Docs documents'); break;
                                                        case 'google-contacts': setInput('Search my contacts for '); break;
                                                        case 'google-keep': setInput('List my Google Keep notes'); break;
                                                        case 'fireflies': setInput('List my recent meeting transcripts'); break;
                                                        case 'youtrack': setInput('Search my YouTrack issues'); break;
                                                        case 'gamma': setInput('Create a presentation about '); break;
                                                        case 'whatsapp': setInput('List my recent WhatsApp chats'); break;
                                                        case 'outlook': setInput('Show my recent Outlook emails'); break;
                                                        case 'ms-calendar': setInput("What's on my calendar this week?"); break;
                                                        case 'onedrive': setInput('List my OneDrive files'); break;
                                                        case 'ms-contacts': setInput('Search my contacts for '); break;
                                                        default:
                                                            if (app.isN8n) {
                                                                setInput(`Run the ${app.label} workflow `);
                                                            } else if (app.isMcp) {
                                                                setInput(`Use ${app.label} to `);
                                                            }
                                                            break;

                                                    }
                                                };
                                                return (
                                                    <div
                                                        className="absolute bottom-full left-0 mb-2 w-80 rounded-xl border shadow-2xl overflow-hidden z-50"
                                                        style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', animation: 'appsOverlayIn .15s ease-out' }}
                                                    >
                                                        {/* Header */}
                                                        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                                            <div className="flex items-center justify-between mb-1">
                                                                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Apps</h3>
                                                                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                                                    {availableApps.filter(a => isAppEnabled(a.id)).length}/{availableApps.length} active
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] mb-2.5" style={{ color: 'var(--text-tertiary)' }}>Click to use · Toggle to enable/disable</p>
                                                            {/* Search */}
                                                            <input
                                                                type="text"
                                                                value={appSearch}
                                                                onChange={e => setAppSearch(e.target.value)}
                                                                placeholder="Search apps..."
                                                                autoFocus
                                                                className="w-full px-3 py-1.5 text-sm rounded-lg border outline-none transition-colors focus:border-[var(--accent-primary)]"
                                                                style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                                                            />
                                                        </div>
                                                        {/* App List */}
                                                        <div className="p-1.5 max-h-72 overflow-y-auto">
                                                            {filtered.length === 0 ? (
                                                                <div className="text-center py-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>No apps found</div>
                                                            ) : filtered.map(app => {
                                                                const enabled = isAppEnabled(app.id);
                                                                return (
                                                                    <div
                                                                        key={app.id}
                                                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${enabled ? 'cursor-pointer hover:bg-[var(--bg-tertiary)]' : 'opacity-50'}`}
                                                                        onClick={() => handleAppClick(app)}
                                                                    >
                                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--bg-tertiary)]">
                                                                            {app.iconSvg('w-5 h-5')}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{app.label}</div>
                                                                            <div className="text-[11px] truncate" style={{ color: 'var(--text-tertiary)' }}>{app.description}</div>
                                                                        </div>
                                                                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0" onClick={e => e.stopPropagation()}>
                                                                            <input type="checkbox" checked={enabled} onChange={() => toggleApp(app.id)} className="sr-only peer" />
                                                                            <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                                                                        </label>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })()}
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Model Tier Selector (Direct Mode) */}
                                {directMode && modelTiers && (
                                    <div className="mr-1">
                                        <ModelTierSelector
                                            tiers={modelTiers}
                                            value={selectedTier}
                                            onChange={onTierChange}
                                        />
                                    </div>
                                )}

                                {/* Thinking-effort selector — shown when the currently-selected
                                    tier resolves to a reasoning-capable model. Mirrors the
                                    `supportsReasoning` regexes used by the backend provider
                                    adapters so server and client agree on availability. */}
                                {directMode && modelTiers && (() => {
                                    const modelId = modelTiers?.[selectedTier]?.model || '';
                                    const supportsReasoning = /claude-opus-4|claude-sonnet-4|^o\d|gpt-5|gemini-2\.5|gemini-3|magistral/i.test(modelId);
                                    if (!supportsReasoning) return null;
                                    return (
                                        <div className="mr-1">
                                            <EffortSelector modelId={modelId} />
                                        </div>
                                    );
                                })()}

                                {/* Send / Stop Buttons */}
                                {isLoading ? (
                                    <button
                                        onClick={onStopGenerating}
                                        className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm active:scale-95 transform duration-100"
                                        title="Stop generating"
                                        aria-label="Stop generating"
                                        data-testid="stop-generating-button"
                                    >
                                        <StopCircle className="w-5 h-5" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleSend}
                                        disabled={!input.trim() && attachments.length === 0}
                                        className="p-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95 transform duration-100"
                                        title="Send message (Enter)"
                                        aria-label="Send message"
                                        data-testid="send-message-button"
                                    >
                                        <ArrowUp className="w-6 h-6" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>


                    <div className="text-center mt-1.5 mb-0.5 select-none">
                        <p className="text-[10px] text-[var(--text-tertiary)]">
                            {warningText || 'AI can make mistakes. Please verify important information.'}
                            {!isMobile && (
                                <>
                                    <span className="mx-1.5">·</span>
                                    <span>Shift+Enter for new line</span>
                                </>
                            )}
                        </p>
                    </div>

                    <style>{`
                        @keyframes appsOverlayIn {
                            from { opacity: 0; transform: translateY(4px); }
                            to   { opacity: 1; transform: translateY(0); }
                        }
                    `}</style>
                </div>
            </div>

            {/* Google Drive Picker Modal */}
            <GoogleDrivePicker
                isOpen={drivePickerOpen}
                onClose={() => setDrivePickerOpen(false)}
                apiBase={API_BASE}
                onFilesSelected={(driveFiles) => {
                    const newAttachments = driveFiles.map(f => ({
                        name: f.name,
                        type: f.type || 'text/plain',
                        size: f.size || f.content?.length || 0,
                        content: f.content,
                        source: 'google-drive',
                    }));
                    setAttachments(prev => [...prev, ...newAttachments]);
                }}
            />

            {/* Gmail Picker Modal */}
            <GmailPicker
                isOpen={gmailPickerOpen}
                onClose={() => setGmailPickerOpen(false)}
                apiBase={API_BASE}
                onFilesSelected={(emailFiles) => {
                    const newAttachments = emailFiles.map(f => ({
                        name: f.name,
                        type: f.type || 'text/plain',
                        size: f.size || f.content?.length || 0,
                        content: f.content,
                        source: 'gmail',
                    }));
                    setAttachments(prev => [...prev, ...newAttachments]);
                }}
            />
        </>
    );
};
export default InputArea;

