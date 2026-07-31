// The /vitest entry point, not the bare package: only it augments Vitest's
// Assertion type, so matchers like toBeInTheDocument() also type-check.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
