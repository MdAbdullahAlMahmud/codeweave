import fs from 'node:fs';
import path from 'node:path';
import type { ParsedManifest, PackageManager } from './pkgParser.js';

export interface StackInfo {
  language: string | null;
  runtime: string | null;
  framework: string | null;
  database: string | null;
  testing: string[];
  styling: string[];
  packageManager: PackageManager | null;
  buildTool: string | null;
  /** Raw detected values for debugging */
  raw: Record<string, string[]>;
}

type Detector = (names: Set<string>, repoRoot: string) => Partial<StackInfo>;

// ── Dependency name helpers ────────────────────────────────────────────────

function hasDep(names: Set<string>, ...candidates: string[]): boolean {
  return candidates.some((c) => names.has(c));
}

// ── Individual detectors ────────────────────────────────────────────────────

const detectLanguage: Detector = (_names, repoRoot) => {
  const checks: [string, string][] = [
    ['tsconfig.json', 'TypeScript'],
    ['Cargo.toml', 'Rust'],
    ['go.mod', 'Go'],
    ['pubspec.yaml', 'Dart'],
    ['pyproject.toml', 'Python'],
    ['requirements.txt', 'Python'],
    ['Gemfile', 'Ruby'],
    ['composer.json', 'PHP'],
    ['build.gradle', 'Java/Kotlin'],
    ['build.gradle.kts', 'Kotlin'],
    ['Package.swift', 'Swift'],
  ];

  for (const [file, lang] of checks) {
    if (fs.existsSync(path.join(repoRoot, file))) {
      return { language: lang };
    }
  }

  if (fs.existsSync(path.join(repoRoot, 'package.json'))) {
    return { language: 'JavaScript' };
  }

  return {};
};

const detectRuntime: Detector = (names, repoRoot) => {
  if (fs.existsSync(path.join(repoRoot, '.nvmrc')) || fs.existsSync(path.join(repoRoot, '.node-version'))) {
    return { runtime: 'Node.js' };
  }
  if (fs.existsSync(path.join(repoRoot, 'Dockerfile'))) {
    try {
      const df = fs.readFileSync(path.join(repoRoot, 'Dockerfile'), 'utf8');
      if (df.includes('FROM node')) return { runtime: 'Node.js' };
      if (df.includes('FROM python')) return { runtime: 'Python' };
      if (df.includes('FROM golang')) return { runtime: 'Go' };
    } catch { /* ignore */ }
  }
  if (hasDep(names, 'react-native', 'expo')) return { runtime: 'React Native' };
  if (fs.existsSync(path.join(repoRoot, 'package.json'))) return { runtime: 'Node.js' };
  return {};
};

const detectFramework: Detector = (names) => {
  // Frontend
  if (hasDep(names, 'next', 'next.js')) return { framework: 'Next.js' };
  if (hasDep(names, 'nuxt', 'nuxt3')) return { framework: 'Nuxt' };
  if (hasDep(names, '@remix-run/react', '@remix-run/node')) return { framework: 'Remix' };
  if (hasDep(names, '@sveltejs/kit')) return { framework: 'SvelteKit' };
  if (hasDep(names, 'gatsby')) return { framework: 'Gatsby' };
  if (hasDep(names, 'astro')) return { framework: 'Astro' };
  if (hasDep(names, 'vite') && hasDep(names, 'react', '@vitejs/plugin-react')) return { framework: 'Vite + React' };

  // Backend JS
  if (hasDep(names, 'express')) return { framework: 'Express' };
  if (hasDep(names, 'fastify')) return { framework: 'Fastify' };
  if (hasDep(names, '@nestjs/core')) return { framework: 'NestJS' };
  if (hasDep(names, 'hono')) return { framework: 'Hono' };
  if (hasDep(names, 'koa')) return { framework: 'Koa' };

  // Python
  if (hasDep(names, 'django')) return { framework: 'Django' };
  if (hasDep(names, 'flask')) return { framework: 'Flask' };
  if (hasDep(names, 'fastapi')) return { framework: 'FastAPI' };

  // Ruby
  if (hasDep(names, 'rails', 'railties')) return { framework: 'Rails' };
  if (hasDep(names, 'sinatra')) return { framework: 'Sinatra' };

  // PHP
  if (hasDep(names, 'laravel/framework')) return { framework: 'Laravel' };
  if (hasDep(names, 'symfony/symfony', 'symfony/framework-bundle')) return { framework: 'Symfony' };

  // UI libraries (no dedicated framework detected)
  if (hasDep(names, 'react', 'react-dom')) return { framework: 'React' };
  if (hasDep(names, 'vue', '@vue/core')) return { framework: 'Vue' };
  if (hasDep(names, '@angular/core')) return { framework: 'Angular' };
  if (hasDep(names, 'svelte')) return { framework: 'Svelte' };

  return {};
};

const detectDatabase: Detector = (names) => {
  if (hasDep(names, 'prisma', '@prisma/client')) return { database: 'Prisma (ORM)' };
  if (hasDep(names, 'typeorm')) return { database: 'TypeORM' };
  if (hasDep(names, 'drizzle-orm')) return { database: 'Drizzle ORM' };
  if (hasDep(names, 'mongoose', 'mongodb')) return { database: 'MongoDB' };
  if (hasDep(names, 'pg', 'postgres', '@neondatabase/serverless')) return { database: 'PostgreSQL' };
  if (hasDep(names, 'mysql2', 'mysql')) return { database: 'MySQL' };
  if (hasDep(names, 'better-sqlite3', 'sqlite3')) return { database: 'SQLite' };
  if (hasDep(names, 'redis', 'ioredis')) return { database: 'Redis' };
  if (hasDep(names, 'sequelize')) return { database: 'Sequelize (ORM)' };
  return {};
};

const detectTesting: Detector = (names) => {
  const testing: string[] = [];
  if (hasDep(names, 'vitest')) testing.push('Vitest');
  if (hasDep(names, 'jest', '@jest/core')) testing.push('Jest');
  if (hasDep(names, 'mocha')) testing.push('Mocha');
  if (hasDep(names, 'jasmine', 'jasmine-core')) testing.push('Jasmine');
  if (hasDep(names, '@playwright/test', 'playwright')) testing.push('Playwright');
  if (hasDep(names, 'cypress')) testing.push('Cypress');
  if (hasDep(names, '@testing-library/react', '@testing-library/dom')) testing.push('Testing Library');
  if (hasDep(names, 'pytest', 'pytest-asyncio')) testing.push('pytest');
  if (hasDep(names, 'rspec')) testing.push('RSpec');
  return testing.length ? { testing } : {};
};

const detectStyling: Detector = (names) => {
  const styling: string[] = [];
  if (hasDep(names, 'tailwindcss')) styling.push('Tailwind CSS');
  if (hasDep(names, 'styled-components')) styling.push('styled-components');
  if (hasDep(names, '@emotion/react', '@emotion/styled')) styling.push('Emotion');
  if (hasDep(names, 'sass', 'node-sass')) styling.push('SASS');
  if (hasDep(names, 'less')) styling.push('LESS');
  if (hasDep(names, '@mui/material', '@material-ui/core')) styling.push('MUI');
  if (hasDep(names, 'antd', '@ant-design/icons')) styling.push('Ant Design');
  if (hasDep(names, 'bootstrap', 'react-bootstrap')) styling.push('Bootstrap');
  if (hasDep(names, '@shadcn/ui', 'shadcn')) styling.push('shadcn/ui');
  return styling.length ? { styling } : {};
};

const detectBuildTool: Detector = (names, repoRoot) => {
  if (hasDep(names, 'vite')) return { buildTool: 'Vite' };
  if (hasDep(names, 'tsup')) return { buildTool: 'tsup' };
  if (hasDep(names, 'webpack')) return { buildTool: 'Webpack' };
  if (hasDep(names, 'rollup')) return { buildTool: 'Rollup' };
  if (hasDep(names, 'esbuild')) return { buildTool: 'esbuild' };
  if (hasDep(names, 'parcel')) return { buildTool: 'Parcel' };
  if (hasDep(names, 'turbo', 'turborepo')) return { buildTool: 'Turborepo' };
  if (fs.existsSync(path.join(repoRoot, 'build.gradle')) || fs.existsSync(path.join(repoRoot, 'build.gradle.kts'))) {
    return { buildTool: 'Gradle' };
  }
  return {};
};

// ── Main export ─────────────────────────────────────────────────────────────

export function detectStack(manifests: ParsedManifest[], repoRoot: string): StackInfo {
  // Flatten all dependency names into one set for fast lookup
  const allNames = new Set(manifests.flatMap((m) => m.dependencies.map((d) => d.name)));

  const packageManager = manifests[0]?.packageManager ?? null;

  const detectors: Detector[] = [
    detectLanguage,
    detectRuntime,
    detectFramework,
    detectDatabase,
    detectTesting,
    detectStyling,
    detectBuildTool,
  ];

  const merged: StackInfo = {
    language: null,
    runtime: null,
    framework: null,
    database: null,
    testing: [],
    styling: [],
    packageManager,
    buildTool: null,
    raw: { allDependencies: [...allNames] },
  };

  for (const detector of detectors) {
    const result = detector(allNames, repoRoot);
    if (result.language != null) merged.language = result.language;
    if (result.runtime != null) merged.runtime = result.runtime;
    if (result.framework != null) merged.framework = result.framework;
    if (result.database != null) merged.database = result.database;
    if (result.testing?.length) merged.testing = result.testing;
    if (result.styling?.length) merged.styling = result.styling;
    if (result.buildTool != null) merged.buildTool = result.buildTool;
    if (result.packageManager != null) merged.packageManager = result.packageManager;
  }

  return merged;
}
