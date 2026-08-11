/** App Studio runtime — 'heading'. Spec: server/appStudio/componentSpecs.js. */

const LEVEL_TAGS = { 1: 'h1', 2: 'h2', 3: 'h3' };
const LEVEL_CLASSES = {
    1: 'text-2xl font-semibold',
    2: 'text-xl font-semibold',
    3: 'text-lg font-medium',
};

export default function AppHeading({ node }) {
    const { text = 'Heading', level = 2 } = node.props || {};
    const lvl = LEVEL_TAGS[level] ? level : 2;
    const Tag = LEVEL_TAGS[lvl];
    // Color comes from the grid cell (color knob → inherit).
    return <Tag className={`${LEVEL_CLASSES[lvl]} break-words`}>{text}</Tag>;
}
