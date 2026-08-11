// Join class names, dropping falsy values — a tiny dependency-free stand-in for
// clsx/classnames. The codebase concatenates class strings inline everywhere;
// prefer this for conditional class composition.
//
//   cn('a', cond && 'b', undefined, ['c', cond2 && 'd'])  // → 'a b c'

export type ClassValue = string | number | false | null | undefined | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
    const out: string[] = [];
    for (const input of inputs) {
        if (!input) continue;
        if (Array.isArray(input)) {
            const nested = cn(...input);
            if (nested) out.push(nested);
        } else {
            out.push(String(input));
        }
    }
    return out.join(' ');
}

export default cn;
