import { optionPairs } from './rowValues';

/**
 * App Studio — turning a block pasted out of Excel / Google Sheets into rows
 * the record endpoints accept.
 *
 * Excel and Sheets put TAB-separated text on the clipboard, a saved .csv is
 * comma-separated, and a .csv saved on a European machine is semicolon-
 * separated — so the separator is sniffed rather than assumed. Parsing follows
 * the quoting rules those tools write: a field may be wrapped in double quotes,
 * a wrapped field may contain the separator or line breaks, and a doubled quote
 * inside one means a literal quote. (No library here does this: agent-hub has
 * no CSV dependency, and the server's xlsx one never reaches the browser.)
 *
 * Nothing in this module talks to the network — it produces { values, problems }
 * per row and the caller decides what to send.
 */

// Sniffed in this order, so a tab-containing paste is never read as a CSV.
const DELIMITERS = ['\t', ';', ','];
const SNIFF_BYTES = 4096;

const YES = new Set(['yes', 'y', 'true', '1', 'x', 'ja', 'waar', 'on']);
const NO = new Set(['no', 'n', 'false', '0', '', 'nee', 'onwaar', 'off']);

/** The characters a multi-select cell may separate its choices with. */
const LIST_SPLIT = /[,;|]/;

function parseRows(text, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (quoted) {
            if (ch !== '"') { field += ch; continue; }
            if (text[i + 1] === '"') { field += '"'; i += 1; continue; }
            quoted = false;
            continue;
        }
        if (ch === '"' && field === '') { quoted = true; continue; }
        if (ch === delimiter) { row.push(field); field = ''; continue; }
        if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
        field += ch;
    }
    row.push(field);
    rows.push(row);
    return rows;
}

/** The separator that splits the first line into the most columns. */
function sniffDelimiter(text) {
    const sample = text.slice(0, SNIFF_BYTES);
    let best = DELIMITERS[0];
    let width = 0;
    for (const d of DELIMITERS) {
        const first = parseRows(sample, d)[0] || [];
        if (first.length > width) { best = d; width = first.length; }
    }
    return best;
}

/**
 * Split pasted text into a header row plus data rows. Fully blank lines are
 * dropped — a spreadsheet selection almost always carries a trailing one.
 */
export function parsePasted(text) {
    const raw = String(text ?? '').replace(/\r\n?/g, '\n').replace(/\n+$/, '');
    if (!raw.trim()) return { header: [], rows: [], delimiter: DELIMITERS[0] };
    const delimiter = sniffDelimiter(raw);
    const all = parseRows(raw, delimiter);
    const header = (all[0] || []).map((h) => h.trim());
    const rows = all.slice(1).filter((cells) => cells.some((c) => c.trim() !== ''));
    return { header, rows, delimiter };
}

/** Fields a paste can fill — a computed field is worked out, never written. */
export function importableFields(fields) {
    return (Array.isArray(fields) ? fields : []).filter((f) => f && f.key && f.type !== 'computed');
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/**
 * Pre-match each pasted column to a field by its label or its column name,
 * ignoring case, spaces and punctuation. An unmatched column maps to '' —
 * "don't import this one" — and one field is never claimed twice.
 */
export function suggestMapping(header, fields) {
    const usable = importableFields(fields);
    const taken = new Set();
    return (Array.isArray(header) ? header : []).map((h) => {
        const n = norm(h);
        if (!n) return '';
        const hit = usable.find((f) => !taken.has(f.key) && (norm(f.name) === n || norm(f.key) === n));
        if (!hit) return '';
        taken.add(hit.key);
        return hit.key;
    });
}

/**
 * Read a number the way a spreadsheet wrote it: currency signs and thousands
 * separators dropped, and both decimal conventions accepted. When a value holds
 * both separators the LAST one is the decimal point ("1.234,56" and "1,234.56"
 * are the same amount); a lone comma is a decimal point unless it groups three
 * digits at a time ("1,234" and "1,234,567" are whole numbers).
 */
export function parseNumberish(text) {
    let s = String(text ?? '').trim().replace(/[\s\u00a0]/g, '').replace(/^[€$£]|[€$£]$/g, '');
    if (!s) return NaN;
    const hasDot = s.includes('.');
    const hasComma = s.includes(',');
    if (hasDot && hasComma) {
        const decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.';
        const grouping = decimal === ',' ? '.' : ',';
        s = s.split(grouping).join('').replace(decimal, '.');
    } else if (hasComma) {
        s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.split(',').join('') : s.replace(',', '.');
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
        s = s.split('.').join('');
    }
    return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
}

const pad = (n) => String(n).padStart(2, '0');

function calendarDate(y, m, d) {
    if (m < 1 || m > 12 || d < 1) return null;
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
}

/**
 * Read a date the way a spreadsheet wrote it: ISO first, then the
 * day-before-month spellings used across Europe. A pair like 03/04 is
 * genuinely ambiguous — it is read day-first unless the first number can only
 * be a day-of-month reading the other way round.
 */
export function parseDateish(text) {
    const s = String(text ?? '').trim();
    if (!s) return null;
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    const parts = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (parts) {
        const a = Number(parts[1]);
        const b = Number(parts[2]);
        const year = Number(parts[3]);
        if (a > 12 && b <= 12) return calendarDate(year, b, a);
        if (b > 12 && a <= 12) return calendarDate(year, a, b);
        return calendarDate(year, b, a);
    }
    return null;
}

/** Split a datetime cell into its date and its 'HH:mm' clock time, if any. */
function parseDatetimeish(text) {
    const s = String(text ?? '').trim();
    const m = s.match(/^(.*?)[T\s]+(\d{1,2}):(\d{2})(?::\d{2})?/);
    const date = parseDateish(m ? m[1] : s);
    if (!date) return null;
    if (!m) return `${date}T00:00`;
    const hh = Number(m[2]);
    const mm = Number(m[3]);
    if (hh > 23 || mm > 59) return null;
    return `${date}T${pad(hh)}:${pad(mm)}`;
}

function matchChoice(text, field) {
    const wanted = norm(text);
    const hit = optionPairs(field).find((o) => norm(o.value) === wanted || norm(o.label) === wanted);
    return hit ? hit.value : null;
}

function choiceList(field) {
    return optionPairs(field).map((o) => o.label).join(', ');
}

const fieldLabel = (field) => field?.name || field?.key || 'This column';

/**
 * Convert one pasted cell for one field. Returns { value, error }: `error` is
 * the sentence shown next to the cell in the preview and in the skipped list,
 * so it always names the value that would not convert.
 */
export function coerceCell(raw, field) {
    const text = String(raw ?? '').trim();
    const type = field?.type || 'text';
    if (text === '') {
        if (field?.required && type !== 'bool') return { value: null, error: `${fieldLabel(field)} can’t be empty` };
        return { value: type === 'bool' ? false : null, error: null };
    }
    switch (type) {
        case 'number': {
            const n = parseNumberish(text);
            return Number.isFinite(n) ? { value: n, error: null } : { value: null, error: `“${text}” is not a number` };
        }
        case 'bool': {
            const t = text.toLowerCase();
            if (YES.has(t)) return { value: true, error: null };
            if (NO.has(t)) return { value: false, error: null };
            return { value: null, error: `“${text}” is not a yes or a no` };
        }
        case 'date': {
            const d = parseDateish(text);
            return d ? { value: d, error: null } : { value: null, error: `“${text}” is not a date (try 2026-03-14 or 14-03-2026)` };
        }
        case 'datetime': {
            const d = parseDatetimeish(text);
            return d ? { value: d, error: null } : { value: null, error: `“${text}” is not a date and time (try 2026-03-14 09:30)` };
        }
        case 'select': {
            const v = matchChoice(text, field);
            if (v !== null) return { value: v, error: null };
            return { value: null, error: `“${text}” is not one of the choices (${choiceList(field)})` };
        }
        case 'multiselect': {
            const wanted = text.split(LIST_SPLIT).map((p) => p.trim()).filter(Boolean);
            const picked = [];
            for (const part of wanted) {
                const v = matchChoice(part, field);
                if (v === null) return { value: null, error: `“${part}” is not one of the choices (${choiceList(field)})` };
                picked.push(v);
            }
            return { value: picked, error: null };
        }
        default:
            return { value: text, error: null };
    }
}

/**
 * Apply a mapping to the parsed rows. Each result carries `line` — the row's
 * number in the spreadsheet, counting the header as line 1 — so a skipped row
 * can be pointed at. A field left empty is omitted rather than sent as null,
 * which lets the column's own default apply.
 */
export function buildImportRows({ header = [], rows = [] } = {}, mapping = [], fields = []) {
    const byKey = new Map(importableFields(fields).map((f) => [f.key, f]));
    return rows.map((cells, index) => {
        const values = {};
        const problems = [];
        mapping.forEach((key, col) => {
            const field = key ? byKey.get(key) : null;
            if (!field) return;
            const { value, error } = coerceCell(cells[col], field);
            if (error) {
                problems.push({ column: header[col] || `Column ${col + 1}`, fieldKey: key, message: error });
                return;
            }
            if (value !== null) values[key] = value;
        });
        return { line: index + 2, values, problems };
    });
}
