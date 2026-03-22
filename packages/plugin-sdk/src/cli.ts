#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline';

const PLUGIN_TYPES = ['agent', 'integration', 'workflow', 'theme'] as const;
type PluginType = (typeof PLUGIN_TYPES)[number];

async function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function promptChoice<T extends string>(
  rl: ReturnType<typeof createInterface>,
  question: string,
  choices: T[],
  defaultChoice: T,
): Promise<T> {
  const choiceStr = choices.map((c) => (c === defaultChoice ? `[${c}]` : c)).join('/');
  const answer = await prompt(rl, `${question} (${choiceStr}): `);
  const trimmed = answer.trim().toLowerCase() as T;
  return choices.includes(trimmed) ? trimmed : defaultChoice;
}

async function generatePlugin(options: {
  id: string;
  name: string;
  type: PluginType;
  description: string;
  author: string;
  outDir: string;
}): Promise<void> {
  const { id, name, type, description, author, outDir } = options;

  const dir = resolve(outDir);
  if (existsSync(dir)) {
    throw new Error(`Directory '${dir}' already exists`);
  }

  await mkdir(dir, { recursive: true });
  await mkdir(join(dir, 'src'), { recursive: true });
  await mkdir(join(dir, 'src', '__tests__'), { recursive: true });

  // plugin.json
  const manifest = {
    id,
    name,
    version: '0.1.0',
    description,
    author,
    type,
    entrypoint: 'dist/index.js',
    permissions: [] as string[],
    unicoreVersion: '>=0.0.1',
  };

  await writeFile(join(dir, 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n');

  // package.json
  const pkg = {
    name: `@unicore-plugin/${id}`,
    version: '0.1.0',
    description,
    type: 'module',
    main: './dist/index.js',
    types: './dist/index.d.ts',
    scripts: {
      build: 'tsc',
      test: 'jest',
      typecheck: 'tsc --noEmit',
    },
    dependencies: {
      '@unicore/plugin-sdk': 'workspace:*',
    },
    devDependencies: {
      '@types/jest': '^29.5.0',
      '@types/node': '^20.0.0',
      'jest': '^29.7.0',
      'ts-jest': '^29.2.0',
      'typescript': '^5.5.0',
    },
  };

  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

  // tsconfig.json
  const tsconfig = {
    extends: '../../tsconfig.json',
    compilerOptions: {
      outDir: 'dist',
      rootDir: 'src',
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      noEmit: false,
    },
    include: ['src'],
    exclude: ['node_modules', 'dist'],
  };

  await writeFile(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n');

  // jest.config.ts
  await writeFile(
    join(dir, 'jest.config.ts'),
    `import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
};

export default config;
`,
  );

  // src/index.ts
  const indexContent = `import type { Plugin, PluginContext, PluginManifest } from '@unicore/plugin-sdk';
import manifest from '../plugin.json' assert { type: 'json' };

const plugin: Plugin = {
  manifest: manifest as PluginManifest,

  async activate(ctx: PluginContext): Promise<void> {
    ctx.logger.info('${name} activated');
    // TODO: implement activation logic
  },

  async deactivate(): Promise<void> {
    // TODO: implement cleanup logic
  },

  async configure(config: Record<string, unknown>, ctx: PluginContext): Promise<void> {
    ctx.logger.info('${name} configured', config);
    // TODO: handle configuration updates
  },
};

export default plugin;
`;

  await writeFile(join(dir, 'src', 'index.ts'), indexContent);

  // src/__tests__/plugin.test.ts
  const testContent = `import type { PluginContext } from '@unicore/plugin-sdk';
import plugin from '../index.js';

describe('${name}', () => {
  const mockCtx: PluginContext = {
    pluginId: '${id}',
    config: {},
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    sandbox: {
      grantedPermissions: new Set(),
      hasPermission: jest.fn(() => false),
      assertPermission: jest.fn(),
    },
  };

  it('has a valid manifest', () => {
    expect(plugin.manifest.id).toBe('${id}');
    expect(plugin.manifest.type).toBe('${type}');
  });

  it('activates without errors', async () => {
    await expect(plugin.activate(mockCtx)).resolves.toBeUndefined();
  });

  it('deactivates without errors', async () => {
    if (plugin.deactivate) {
      await expect(plugin.deactivate()).resolves.toBeUndefined();
    }
  });
});
`;

  await writeFile(join(dir, 'src', '__tests__', 'plugin.test.ts'), testContent);

  // README.md
  const readme = `# ${name}

Updated: ${new Date().toISOString().split('T')[0]}

A UniCore plugin of type \`${type}\`.

## Installation

\`\`\`bash
pnpm add @unicore-plugin/${id}
\`\`\`

## Configuration

<!-- Describe configuration options here -->

## Usage

<!-- Describe usage here -->
`;

  await writeFile(join(dir, 'README.md'), readme);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command !== 'init') {
    console.log('UniCore Plugin SDK CLI');
    console.log('');
    console.log('Usage:');
    console.log('  npx @unicore/plugin-sdk init    Scaffold a new plugin');
    process.exit(0);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log('\nUniCore Plugin Scaffolder\n');

    const id = (await prompt(rl, 'Plugin ID (e.g. my-plugin): ')).trim().toLowerCase();
    if (!id || !/^[a-z0-9][a-z0-9-_.]*$/.test(id)) {
      console.error('Invalid plugin ID. Use lowercase letters, numbers, hyphens, dots, underscores.');
      process.exit(1);
    }

    const name = (await prompt(rl, `Plugin name [${id}]: `)).trim() || id;
    const description = (await prompt(rl, 'Description: ')).trim();
    const author = (await prompt(rl, 'Author: ')).trim();
    const type = await promptChoice(rl, 'Plugin type', [...PLUGIN_TYPES], 'integration');
    const outDir = (await prompt(rl, `Output directory [./${id}]: `)).trim() || `./${id}`;

    rl.close();

    console.log(`\nScaffolding plugin '${id}' in '${outDir}'...`);

    await generatePlugin({ id, name, type, description, author, outDir });

    console.log('\nDone! Next steps:');
    console.log(`  cd ${outDir}`);
    console.log('  pnpm install');
    console.log('  pnpm build');
    console.log('  pnpm test');
  } catch (err) {
    rl.close();
    console.error('Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
