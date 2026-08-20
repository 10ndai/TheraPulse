import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// E2E / integration test config — hits real HTTP endpoints via supertest.
// Excluded from the unit test run (vitest.config.ts).
// Run with: npm run test:e2e
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.e2e-spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    server: {
      deps: {
        fallbackCJS: true,
      },
    },
    // No coverage thresholds for E2E tests — coverage is tracked by unit tests
    testTimeout: 30000,
  },
  plugins: [
    swc.vite({
      jsc: {
        target: 'es2022',
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
      },
    }),
  ],
});
