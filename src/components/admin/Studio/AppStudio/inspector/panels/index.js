/**
 * App Studio inspector — panel barrel. Importing this module registers every
 * per-type Content panel with the inspector registry (each file calls
 * registerInspector at module scope). InspectorPanel imports it for the
 * side effect.
 *
 * `divider` intentionally has no Content panel — its only editing surface is
 * the Style section. The registry treats a missing entry as "skip Content".
 */

import './HeadingInspector';
import './TextInspector';
import './ButtonInspector';
import './ImageInspector';
import './SpacerInspector';
import './CalloutInspector';
import './StatInspector';
import './KeyValueInspector';
import './TableInspector';
import './ListInspector';
import './CardInspector';
import './FormInspector';
import './inputPanels';
// v2 rich components
import './DataGridInspector';
import './ChartInspector';
import './PivotInspector';
import './InputFileInspector';
import './InputRichtextInspector';
import './InputDatetimeInspector';
import './InputRelationInspector';
import './InputMultiselectInspector';
import './TabsInspector';
import './ModalInspector';
import './RepeaterInspector';
// v2.1 batch — bespoke panels only where the generic SpecPanel falls short
// (nested lists / layout pickers); every other new type falls back to
// SpecPanel via registry.getInspectorForType.
import './FilterBarInspector';
import './KanbanInspector';
import './RecordDetailInspector';
// AI — needs the shared model-tier + knowledge-base pickers SpecPanel can't render.
import './AiChatInspector';

export { default as BindingField } from './BindingField';
export { default as SpecPanel } from './SpecPanel';
