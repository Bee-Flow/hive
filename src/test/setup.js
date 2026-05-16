// Vitest global setup.
// Registers @testing-library/jest-dom matchers so tests can use
// `expect(el).toBeInTheDocument()`, `toHaveTextContent()`, etc.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Each test gets a fresh DOM. Without this the React-Testing-Library
// container leaks across tests and assertions get cross-contaminated.
afterEach(() => {
    cleanup();
});
