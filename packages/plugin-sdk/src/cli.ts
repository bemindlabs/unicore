#!/usr/bin/env node
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline';
import { validateSchema, MANIFEST_SCHEMA } from './schema-validator.js';

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

function getTypeSpecificTemplate(type: PluginType, id: string, name: string): string {
  switch (type) {
    case 'agent':
      return `import type { Plugin, PluginContext, PluginManifest } from '@unicore/plugin-sdk';
import manifest from '../plugin.json' assert { type: 'json' };

/**
 * ${name} — UniCore Agent Plugin
 *
 * Agents participate in the OpenClaw multi-agent network.
 * Implement your agent logic in the activate() hook and
 * listen to the 'ai' permission-gated event bus for prompts.
 */
const plugin: Plugin = {
  manifest: manifest as PluginManifest,

  async activate(ctx: PluginContext): Promise<void> {
    ctx.sandbox.assertPermission('ai');
    ctx.logger.info('${name} agent activated');
    // TODO: register agent capabilities and event handlers
  },

  async deactivate(): Promise<void> {
    // TODO: unregister handlers and release resources
  },

  async configure(config: Record<string, unknown>, ctx: PluginContext): Promise<void> {
    ctx.logger.info('${name} configured', config);
    // TODO: apply runtime configuration
  },
};

export default plugin;
`;

    case 'integration':
      return `import type { Plugin, PluginContext, PluginManifest } from '@unicore/plugin-sdk';
import manifest from '../plugin.json' assert { type: 'json' };

/**
 * ${name} — UniCore Integration Plugin
 *
 * Integrations bridge external services (APIs, webhooks, databases)
 * with the UniCore platform. Use the 'network' permission to make
 * outbound HTTP requests.
 */
const plugin: Plugin = {
  manifest: manifest as PluginManifest,

  async activate(ctx: PluginContext): Promise<void> {
    ctx.sandbox.assertPermission('network');
    ctx.logger.info('${name} integration activated');
    // TODO: initialise HTTP client / connection pool
  },

  async deactivate(): Promise<void> {
    // TODO: close connections and flush pending requests
  },

  async configure(config: Record<string, unknown>, ctx: PluginContext): Promise<void> {
    ctx.logger.info('${name} reconfigured', config);
    // TODO: reconnect with updated credentials / base URL
  },
};

export default plugin;
`;

    case 'workflow':
      return `import type { Plugin, PluginContext, PluginManifest } from '@unicore/plugin-sdk';
import manifest from '../plugin.json' assert { type: 'json' };

/**
 * ${name} — UniCore Workflow Plugin
 *
 * Workflow plugins register custom steps that can be composed in
 * the UniCore visual workflow builder. Each step receives a payload
 * and returns a result via the Kafka-backed workflow engine.
 */
const plugin: Plugin = {
  manifest: manifest as PluginManifest,

  async activate(ctx: PluginContext): Promise<void> {
    ctx.sandbox.assertPermission('workflow');
    ctx.logger.info('${name} workflow plugin activated');
    // TODO: register workflow step handlers
    // e.g. ctx.events?.on('workflow:step:${id}', handleStep);
  },

  async deactivate(): Promise<void> {
    // TODO: deregister step handlers
  },

  async configure(config: Record<string, unknown>, ctx: PluginContext): Promise<void> {
    ctx.logger.info('${name} workflow configured', config);
    // TODO: apply updated step configuration
  },
};

export default plugin;
`;

    case 'theme':
      return `import type { Plugin, PluginContext, PluginManifest } from '@unicore/plugin-sdk';
import manifest from '../plugin.json' assert { type: 'json' };

/**
 * ${name} — UniCore Theme Plugin
 *
 * Theme plugins inject CSS custom properties (design tokens) into the
 * UniCore dashboard, enabling white-label and custom-brand experiences.
 * Requires the 'config' permission to write theme variables.
 */

/** CSS custom properties injected by this theme */
const THEME_TOKENS: Record<string, string> = {
  '--color-primary': '#6366f1',
  '--color-primary-foreground': '#ffffff',
  '--color-secondary': '#f1f5f9',
  '--color-secondary-foreground': '#0f172a',
  '--radius': '0.5rem',
  // TODO: add your brand tokens
};

const plugin: Plugin = {
  manifest: manifest as PluginManifest,

  async activate(ctx: PluginContext): Promise<void> {
    ctx.sandbox.assertPermission('config');
    ctx.logger.info('${name} theme activated');
    // TODO: apply THEME_TOKENS to the dashboard renderer
  },

  async deactivate(): Promise<void> {
    // TODO: restore default theme tokens
  },

  async configure(config: Record<string, unknown>, ctx: PluginContext): Promise<void> {
    ctx.logger.info('${name} theme reconfigured', config);
    // TODO: merge config overrides into THEME_TOKENS and re-apply
  },
};

export default plugin;
`;
  }
}

function getTypeDefaultPermissions(type: PluginType): string[] {
  switch (type) {
    case 'agent':
      return ['ai', 'events'];
    case 'integration':
      return ['network', 'events'];
    case 'workflow':
      return ['workflow', 'events'];
    case 'theme':
      return ['config'];
  }
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

  const defaultPermissions = getTypeDefaultPermissions(type);

  // plugin.json (manifest)
  const manifest = {
    id,
    name,
    version: '0.1.0',
    description,
    author,
    type,
    entrypoint: 'dist/index.js',
    permissions: defaultPermissions,
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
      validate: 'npx @unicore/plugin-sdk validate',
    },
    dependencies: {
      '@unicore/plugin-sdk': 'workspace:*',
    },
    devDependencies: {
      '@types/jest': '^29.5.0',
      '@types/node': '^20.0.0',
      jest: '^29.7.0',
      'ts-jest': '^29.2.0',
      typescript: '^5.5.0',
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

  // src/index.ts (type-specific template)
  await writeFile(join(dir, 'src', 'index.ts'), getTypeSpecificTemplate(type, id, name));

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
      grantedPermissions: new Set(${JSON.stringify(defaultPermissions)}),
      hasPermission: jest.fn((p) => ${JSON.stringify(defaultPermissions)}.includes(p as string)),
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

A UniCore **${type}** plugin.

## Installation

\`\`\`bash
pnpm add @unicore-plugin/${id}
\`\`\`

## Configuration

<!-- Describe configuration options here -->

## Usage

<!-- Describe usage here -->

## Development

\`\`\`bash
pnpm install
pnpm build
pnpm test
pnpm validate   # validate manifest + bundle
\`\`\`
`;

  await writeFile(join(dir, 'README.md'), readme);
}

async function validatePlugin(targetDir: string): Promise<void> {
  const dir = resolve(targetDir);

  console.log(`Validating plugin in '${dir}'...\n`);

  let passed = 0;
  let failed = 0;

  function pass(msg: string): void {
    console.log(`  ✓ ${msg}`);
    passed++;
  }

  function fail(msg: string): void {
    console.log(`  ✗ ${msg}`);
    failed++;
  }

  // 1. Manifest file exists
  const manifestPath = join(dir, 'plugin.json');
  if (!existsSync(manifestPath)) {
    fail('plugin.json not found');
    console.log(`\n✗ Validation failed (${failed} error${failed !== 1 ? 's' : ''})`);
    process.exit(1);
  }
  pass('plugin.json found');

  // 2. Parse manifest JSON
  let manifest: unknown;
  try {
    const raw = await readFile(manifestPath, 'utf-8');
    manifest = JSON.parse(raw);
    pass('plugin.json is valid JSON');
  } catch {
    fail('plugin.json contains invalid JSON');
    console.log(`\n✗ Validation failed (${failed} error${failed !== 1 ? 's' : ''})`);
    process.exit(1);
  }

  // 3. Schema validation
  const result = validateSchema(manifest, MANIFEST_SCHEMA, 'manifest');
  if (result.valid) {
    pass('manifest schema is valid');
  } else {
    for (const err of result.errors) {
      fail(`schema: ${err}`);
    }
  }

  // 4. Entrypoint bundle exists (if manifest is an object with entrypoint)
  if (manifest !== null && typeof manifest === 'object') {
    const mf = manifest as Record<string, unknown>;
    if (typeof mf['entrypoint'] === 'string') {
      const bundlePath = join(dir, mf['entrypoint']);
      if (existsSync(bundlePath)) {
        pass(`bundle exists: ${mf['entrypoint']}`);
      } else {
        fail(`bundle not found: ${mf['entrypoint']} (run 'pnpm build' first)`);
      }
    }

    // 5. Required fields present
    const requiredFields = ['id', 'name', 'version', 'type', 'entrypoint'];
    const allPresent = requiredFields.every((f) => f in mf);
    if (allPresent) {
      pass('all required manifest fields present');
    }

    // 6. Plugin type is valid
    if (typeof mf['type'] === 'string') {
      if (PLUGIN_TYPES.includes(mf['type'] as PluginType)) {
        pass(`plugin type '${mf['type']}' is valid`);
      } else {
        fail(`plugin type '${mf['type']}' is not one of: ${PLUGIN_TYPES.join(', ')}`);
      }
    }

    // 7. Version follows semver
    if (typeof mf['version'] === 'string') {
      if (/^\d+\.\d+\.\d+/.test(mf['version'])) {
        pass(`version '${mf['version']}' follows semver`);
      } else {
        fail(`version '${mf['version']}' does not follow semver (expected X.Y.Z)`);
      }
    }

    // 8. ID follows naming convention
    if (typeof mf['id'] === 'string') {
      if (/^[a-z0-9][a-z0-9-_.]*$/.test(mf['id'])) {
        pass(`plugin id '${mf['id']}' follows naming convention`);
      } else {
        fail(`plugin id '${mf['id']}' must match ^[a-z0-9][a-z0-9-_.]*$`);
      }
    }

    // 9. package.json present
    if (existsSync(join(dir, 'package.json'))) {
      pass('package.json found');
    } else {
      fail('package.json not found');
    }

    // 10. tsconfig.json present
    if (existsSync(join(dir, 'tsconfig.json'))) {
      pass('tsconfig.json found');
    } else {
      fail('tsconfig.json not found');
    }
  }

  console.log('');
  if (failed === 0) {
    console.log(`✓ Validation passed (${passed} check${passed !== 1 ? 's' : ''})`);
  } else {
    console.log(
      `✗ Validation failed — ${failed} error${failed !== 1 ? 's' : ''}, ${passed} passed`,
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    console.log('UniCore Plugin SDK CLI\n');
    console.log('Usage:');
    console.log('  npx @unicore/plugin-sdk init              Scaffold a new plugin interactively');
    console.log('  npx @unicore/plugin-sdk validate [dir]    Validate manifest and bundle (default: .)');
    process.exit(0);
  }

  if (command === 'init') {
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

      console.log(`\nScaffolding '${type}' plugin '${id}' in '${outDir}'...`);

      await generatePlugin({ id, name, type, description, author, outDir });

      console.log('\nDone! Next steps:');
      console.log(`  cd ${outDir}`);
      console.log('  pnpm install');
      console.log('  pnpm build');
      console.log('  pnpm test');
      console.log('  pnpm validate');
    } catch (err) {
      rl.close();
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    return;
  }

  if (command === 'validate') {
    const targetDir = args[1] ?? '.';
    try {
      await validatePlugin(targetDir);
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error("Run 'npx @unicore/plugin-sdk --help' for usage.");
  process.exit(1);
}

main();
