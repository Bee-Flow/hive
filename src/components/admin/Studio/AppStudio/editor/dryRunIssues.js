/**
 * The pre-flight check's findings, in the shape the publish modal already
 * renders.
 *
 * appDryRun answers four questions the static validator cannot: does this
 * binding actually return anything, would a member with this role see an empty
 * screen, does this sequence step write a column that exists, is a table empty.
 * It has existed since Wave 4 and only the AI builder could reach it, so a
 * person building by hand found out by publishing and clicking through the app.
 *
 * Its output is four differently-shaped arrays plus a bag of `_hints` strings.
 * The modal already knows how to draw `{ severity, message, hint, path }`
 * issues — including resolving one back to the component it points at — so this
 * translates rather than adding a second way to show a problem.
 *
 * → { errors, warnings } of issue objects. `nodeId` rides along so the modal's
 * "Show me" can jump to a component the validator never named a path for.
 */

/** An issue the panel can draw. `code` is only used as a React key hint. */
function issue({ code, message, hint = null, nodeId = null, path = null, severity }) {
    return { code, message, hint, nodeId, path, severity };
}

/** "Order list" rather than "cmp_9f2" when the definition still has the node. */
function nodeLabel(definition, nodeId) {
    if (!nodeId) return 'A component';
    let found = null;
    const walk = (nodes) => {
        for (const n of nodes || []) {
            if (found) return;
            if (n?.id === nodeId) { found = n; return; }
            if (Array.isArray(n?.children)) walk(n.children);
        }
    };
    for (const screen of definition?.screens || []) {
        for (const section of screen.sections || []) walk(section.children);
    }
    if (!found) return nodeId;
    const props = found.props || {};
    const text = props.label || props.title || props.text || props.heading;
    return (typeof text === 'string' && text.trim()) ? `“${text.trim().slice(0, 30)}”` : (found.type || nodeId);
}

export default function dryRunIssues(result, definition = null) {
    const errors = [];
    const warnings = [];
    if (!result || typeof result !== 'object') return { errors, warnings };

    // 1. The static pass is already in the right shape — pass it straight
    //    through so a publish blocker reads identically here and there.
    for (const e of asList(result.static?.errors)) errors.push({ ...e, severity: 'error' });
    for (const w of asList(result.static?.warnings)) warnings.push({ ...w, severity: 'warning' });

    // 2. Bindings that were actually EXECUTED. A failure here is a screen that
    //    will not load; zero rows is only worth a warning, because a demo table
    //    nobody has seeded yet is normal and must never block a publish.
    for (const b of asList(result.bindings)) {
        const who = nodeLabel(definition, b.nodeId);
        if (b.ok === false) {
            errors.push(issue({
                code: 'dryrun.binding_failed',
                severity: 'error',
                nodeId: b.nodeId,
                message: `${who} could not load its data.`,
                hint: b.error || 'Open the component and check where its data comes from.',
            }));
        } else if (b.rowCount === 0 && !b.skipped) {
            warnings.push(issue({
                code: 'dryrun.binding_empty',
                severity: 'warning',
                nodeId: b.nodeId,
                message: `${who} shows nothing right now — it found no rows.`,
                hint: b.kind === 'dataset'
                    ? 'The saved view is empty: add rows to the table behind it, or loosen its filters.'
                    : 'Add some rows to the table, or loosen the filter on this component.',
            }));
        }
    }

    // 3. What a member with the previewed role would see. An empty screen for
    //    everyone but the owner is the classic one nobody catches before
    //    somebody else opens the app.
    for (const f of asList(result.roleFindings)) {
        if (f.rowCount !== 0) continue;
        warnings.push(issue({
            code: 'dryrun.role_empty',
            severity: 'warning',
            nodeId: f.nodeId,
            message: `Someone with the “${f.role}” role would see nothing in ${nodeLabel(definition, f.nodeId)}.`,
            hint: f.note
                ? `${f.note} — check that role's access to the table, or share the rows with everyone in the app.`
                : "Check that role's access to the table, or share the rows with everyone in the app.",
        }));
    }

    // 4. Mutating steps, checked against the data model without running them.
    //    A step writing a column that does not exist fails at the moment
    //    somebody clicks the button, which is the worst time to find out.
    for (const a of asList(result.actions)) {
        if (a.ok !== false) continue;
        errors.push(issue({
            code: 'dryrun.step_invalid',
            severity: 'error',
            message: `A step in this app’s logic cannot run: ${a.step || 'a step'}.`,
            // runActionPass reports STRINGS here, not issue objects.
            hint: reasons(a.errors) || 'Open the action and check the table and columns it writes to.',
        }));
    }

    return { errors, warnings };
}

function asList(v) {
    return Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : [];
}

function reasons(v) {
    return (Array.isArray(v) ? v : []).filter((s) => typeof s === 'string' && s.trim()).join('; ');
}
