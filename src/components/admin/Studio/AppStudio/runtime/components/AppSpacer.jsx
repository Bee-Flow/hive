import { spaceSteps } from '../styleResolver';

/** App Studio runtime — 'spacer'. Spec: server/appStudio/componentSpecs.js. */

export default function AppSpacer({ node }) {
    const steps = Number.isFinite(node.props?.steps) ? node.props.steps : 2;
    // Each spacer step is two spacing steps (8px × density) of empty height.
    return <div aria-hidden="true" style={{ height: spaceSteps(steps * 2) }} />;
}
