import React from 'react';
import DesignEditor from '../DesignEditor';

/**
 * Design inspector — hosts the site-wide brand editor (colors, fonts, logo,
 * favicon, radius, theme). DesignEditor brings its own heading + scroll
 * container. Edits flow through `onChange` → updateDesign → the shared
 * 'site' save slot (coalesces with chrome edits — do not split).
 */
export default function DesignInspector({ design, onChange }) {
    return (
        <div className="h-full flex flex-col min-h-0">
            <DesignEditor design={design} onChange={onChange} />
        </div>
    );
}
