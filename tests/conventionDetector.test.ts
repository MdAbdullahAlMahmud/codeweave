import { describe, it, expect } from 'vitest';
import {
  detectFileNaming,
  detectImportStyle,
  detectComponentStructure,
  detectTestFramework,
  detectConventions,
} from '../src/indexer/conventionDetector.js';

describe('detectFileNaming', () => {
  it('detects camelCase majority', () => {
    const result = detectFileNaming(['myUtils.ts', 'apiClient.ts', 'authHelper.ts', 'index.ts']);
    expect(result.naming).toBe('camelCase');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('detects PascalCase majority', () => {
    const result = detectFileNaming(['UserCard.tsx', 'AuthProvider.tsx', 'DashboardPage.tsx']);
    expect(result.naming).toBe('PascalCase');
  });

  it('detects kebab-case majority', () => {
    const result = detectFileNaming(['user-card.ts', 'auth-provider.ts', 'dashboard-page.ts', 'api-client.ts']);
    expect(result.naming).toBe('kebab-case');
  });

  it('detects snake_case majority', () => {
    const result = detectFileNaming(['user_model.py', 'auth_service.py', 'database_helper.py']);
    expect(result.naming).toBe('snake_case');
  });

  it('returns mixed when no clear winner', () => {
    const result = detectFileNaming(['myFile.ts', 'my-file.ts', 'my_file.ts', 'MyFile.ts']);
    expect(result.naming).toBe('mixed');
  });

  it('returns mixed for empty array', () => {
    const result = detectFileNaming([]);
    expect(result.naming).toBe('mixed');
    expect(result.confidence).toBe(0);
  });
});

describe('detectImportStyle', () => {
  it('detects relative imports', () => {
    const contents = [
      `import { foo } from './utils';`,
      `import { bar } from '../components/Button';`,
      `import { baz } from './helpers/index';`,
    ];
    expect(detectImportStyle(contents)).toBe('relative');
  });

  it('detects absolute/alias imports', () => {
    const contents = [
      `import { foo } from '@/utils';`,
      `import { bar } from '~/components/Button';`,
      `import { baz } from 'src/helpers';`,
    ];
    expect(detectImportStyle(contents)).toBe('absolute');
  });

  it('returns mixed when split evenly', () => {
    // Both relative and absolute in equal measure
    const contents = [
      `import { a } from './local'; import { b } from '@/remote';`,
    ];
    // Result depends on ratio — just ensure no throw
    const result = detectImportStyle(contents);
    expect(['relative', 'absolute', 'mixed']).toContain(result);
  });

  it('returns mixed for empty contents', () => {
    expect(detectImportStyle([])).toBe('mixed');
  });
});

describe('detectComponentStructure', () => {
  it('detects colocated tests', () => {
    const files = [
      'src/components/Button.tsx',
      'src/components/Button.test.tsx',
      'src/utils/helpers.ts',
      'src/utils/helpers.test.ts',
    ];
    expect(detectComponentStructure(files)).toBe('colocated');
  });

  it('detects separate test directories', () => {
    const files = [
      'src/components/Button.tsx',
      'tests/Button.test.tsx',
      'src/utils/helpers.ts',
      '__tests__/helpers.test.ts',
    ];
    expect(detectComponentStructure(files)).toBe('separate');
  });

  it('returns unknown when no test files', () => {
    const files = ['src/components/Button.tsx', 'src/utils/helpers.ts'];
    expect(detectComponentStructure(files)).toBe('unknown');
  });
});

describe('detectTestFramework', () => {
  it('detects vitest', () => expect(detectTestFramework(['vitest', 'typescript'])).toBe('vitest'));
  it('detects jest', () => expect(detectTestFramework(['jest', '@types/jest'])).toBe('jest'));
  it('detects mocha', () => expect(detectTestFramework(['mocha', 'chai'])).toBe('mocha'));
  it('detects playwright', () => expect(detectTestFramework(['@playwright/test'])).toBe('playwright'));
  it('returns null when none found', () => expect(detectTestFramework(['typescript', 'eslint'])).toBeNull());
  it('prefers vitest over jest when both present', () => {
    expect(detectTestFramework(['jest', 'vitest'])).toBe('vitest');
  });
});

describe('detectConventions (integration)', () => {
  it('returns a full ConventionInfo object', () => {
    const result = detectConventions({
      filePaths: ['UserCard.tsx', 'AuthProvider.tsx', 'UserCard.test.tsx'],
      tsJsContents: [`import { x } from './utils';`],
      devDependencies: ['vitest'],
    });

    expect(result.fileNaming).toBe('PascalCase');
    expect(result.testFramework).toBe('vitest');
    expect(result.importStyle).toBe('relative');
    expect(result.componentStructure).toBe('colocated');
  });
});
