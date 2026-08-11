import React from 'react';
import { Mic } from 'lucide-react';
import EmptyState from '../../../components/shared/EmptyState';

export default function LibraryEmptyState({ onCapture }) {
    return (
        <EmptyState
            icon={<Mic className="w-14 h-14" />}
            title="No meetings yet"
            description="Record live, upload a file, or connect Nextcloud Talk or Google Meet to import your call recordings automatically."
            action={{
                label: 'New transcription',
                onClick: onCapture,
                icon: <Mic className="w-4 h-4" />,
            }}
        />
    );
}
