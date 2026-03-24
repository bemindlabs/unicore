import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { join } from 'path';
import {
  PluginLifecycleManager,
  PluginLoadError,
  PluginLoader,
} from '@bemindlabs/unicore-plugin-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { PLUGINS_BASE_DIR } from './plugin-artifact.service';

/**
 * PluginRuntimeService
 *
 * Bridges the database-driven plugin registry with the in-process
 * PluginLifecycleManager.  On startup it loads every enabled
 * PluginInstallation from the database, registers each one with the
 * lifecycle manager, and activates it with the stored config.  On
 * shutdown it deactivates all active plugins in reverse order.
 */
@Injectable()
export class PluginRuntimeService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PluginRuntimeService.name);

  readonly lifecycle = new PluginLifecycleManager();
  private readonly loader = new PluginLoader();

  constructor(private readonly prisma: PrismaService) {}

  // ─── Lifecycle hooks ───────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    let installations: any[];
    try {
      installations = await this.prisma.pluginInstallation.findMany({
        where: { enabled: true },
      });
    } catch (err) {
      this.logger.warn(
        `Could not load plugin installations (table may not exist yet): ${(err as Error).message}. ` +
          'Skipping plugin loading — run "prisma db push" to create the table.',
      );
      return;
    }

    if (installations.length === 0) {
      this.logger.log('Plugin runtime ready — no enabled plugins found');
      return;
    }

    let loaded = 0;

    for (const installation of installations) {
      const manifestPath = join(
        PLUGINS_BASE_DIR,
        installation.pluginId,
        installation.version,
        'manifest.json',
      );

      try {
        const plugin = await this.loader.loadFromFile(manifestPath);
        this.lifecycle.register(plugin);
        await this.lifecycle.activate(
          plugin.manifest.id,
          (installation.config as Record<string, unknown>) ?? {},
        );
        loaded++;
        this.logger.log(
          `Plugin activated: ${plugin.manifest.id} v${installation.version}`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (err instanceof PluginLoadError) {
          // Artifact not yet on disk — non-fatal, plugin will load after reinstall
          this.logger.warn(
            `Plugin skipped (artifact missing) ${installation.pluginId}@${installation.version}: ${msg}`,
          );
        } else {
          this.logger.error(
            `Failed to load/activate plugin ${installation.pluginId}@${installation.version}: ${msg}`,
          );
        }
      }
    }

    this.logger.log(
      `Plugin runtime ready — ${loaded}/${installations.length} plugin(s) active`,
    );
  }

  async onApplicationShutdown(): Promise<void> {
    const activeCount = this.lifecycle.getActive().length;
    if (activeCount === 0) {
      return;
    }
    this.logger.log(`Deactivating ${activeCount} active plugin(s)…`);
    await this.lifecycle.deactivateAll();
    this.logger.log('All plugins deactivated');
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  /** Returns the number of currently active plugins. */
  getActiveCount(): number {
    return this.lifecycle.getActive().length;
  }
}
