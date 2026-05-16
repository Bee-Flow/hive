// Returns a debounced copy of `value` that updates `ms` milliseconds
// after the input stops changing. Replaces the inline pattern:
//
//   const [val, setVal] = useState(initial);
//   const [debouncedVal, setDebouncedVal] = useState(initial);
//   const ref = useRef();
//   useEffect(() => {
//     clearTimeout(ref.current);
//     ref.current = setTimeout(() => setDebouncedVal(val), 350);
//     return () => clearTimeout(ref.current);
//   }, [val]);
//
// Usage:
//   const debouncedQuery = useDebouncedValue(query, 300);
//   useEffect(() => { search(debouncedQuery); }, [debouncedQuery]);

import { useEffect, useState } from 'react';

export default function useDebouncedValue<T>(value: T, ms: number): T {
    const [debounced, setDebounced] = useState<T>(value);

    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), ms);
        return () => clearTimeout(id);
    }, [value, ms]);

    return debounced;
}
