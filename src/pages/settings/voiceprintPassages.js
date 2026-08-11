/**
 * Read-aloud passages for voice-profile enrollment.
 *
 * pyannoteAI's voiceprint model is language-agnostic, so the passage is purely
 * a UX device: it exists so the user keeps talking naturally for the ~25
 * seconds a good template needs, instead of running dry after "testing, one,
 * two" and enrolling five seconds of hesitation.
 *
 * Sizing: ~70 words is ~26s at a normal 160 wpm reading pace — comfortably
 * over the 12s floor, and under the 28s auto-stop even for a fast reader.
 * There is deliberately a little more text than 28 seconds' worth: running out
 * of words before the timer is what produces a tail of silence.
 *
 * Content: two paragraphs so the UI can dim the first one halfway through as an
 * alignment-free reading cue. Each mixes statement and question prosody and
 * covers the sounds that carry speaker identity — fricatives (s/f/sch/g),
 * diphthongs (ui/ei/au), nasals — rather than being a flat word list.
 */

const PASSAGES = {
    nl: [
        'Goedemorgen, ik neem dit fragment op zodat Bee Flow mijn stem later kan herkennen in vergaderingen. Ik spreek rustig en op mijn normale toon, precies zoals ik dat in een gesprek met collega’s zou doen.',
        'Buiten schijnt de zon, terwijl ik hier bij het raam zit en nadenk over de planning van volgende week. Zullen we dinsdag om half elf beginnen? Dan bespreken we de nieuwe afspraken en de vragen die nog openstaan.',
    ],
    en: [
        'Good morning. I am recording this short passage so that Bee Flow can recognise my voice in future meetings. I am speaking calmly, in my normal tone, exactly the way I would talk with a colleague.',
        'Outside, the weather is changing again, and I am thinking about the plan for next week. Shall we start on Tuesday at half past ten? Then we can go through the new agreements and the open questions.',
    ],
};

/**
 * The passage for a UI locale, falling back to English for languages we have
 * not written one for. (Any language works acoustically — this only affects
 * how comfortable the text is to read aloud.)
 *
 * @param {string} locale e.g. 'nl', 'nl-NL', 'de'
 * @returns {string[]} paragraphs
 */
export function passageFor(locale) {
    const key = String(locale || 'en').slice(0, 2).toLowerCase();
    return PASSAGES[key] || PASSAGES.en;
}

export default PASSAGES;
