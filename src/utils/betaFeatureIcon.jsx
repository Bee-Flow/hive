import React from 'react';
import { Sparkles, Clock, BookOpen, Globe, Workflow, Brain, Zap } from 'lucide-react';

// Keyword-match a Lucide icon for a beta feature based on its id/name.
// Beta features are dynamic (registry-driven), so there's no hardcoded map
// by id — a fresh beta feature gets a sensible icon without a code change.
//
// Originally lived inside OrgFeatureTogglesPanel; lifted out so the
// consumer Beta-features panel can use the same picker without importing
// the whole org-admin component.
export function pickBetaIcon(idOrName) {
    const s = (idOrName || '').toLowerCase();
    if (s.includes('skill')) return <Sparkles className="w-4 h-4" />;
    if (s.includes('routine')) return <Clock className="w-4 h-4" />;
    if (s.includes('knowledge') || s.includes('kb')) return <BookOpen className="w-4 h-4" />;
    if (s.includes('webpage') || s.includes('web')) return <Globe className="w-4 h-4" />;
    if (s.includes('automation')) return <Workflow className="w-4 h-4" />;
    if (s.includes('memory')) return <Brain className="w-4 h-4" />;
    if (s.includes('zap') || s.includes('quick')) return <Zap className="w-4 h-4" />;
    return <Sparkles className="w-4 h-4" />;
}

export default pickBetaIcon;
