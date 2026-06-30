import React from 'react';
import TemplateGallery from './TemplateGallery';

export default function TemplatesTab({ onPickTemplate }) {
    if (!onPickTemplate) return null;
    return <TemplateGallery onPick={onPickTemplate} />;
}
