import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { exec } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** Root directory where plugin artifacts are stored inside the container. */
export const PLUGINS_BASE_DIR = '/app/plugins';

export interface ArtifactDownloadResult {
  buffer: Buffer;
  contentType?: string;
  size: number;
}

/**
 * PluginArtifactService
 *
 * Handles the low-level lifecycle of plugin artifact files:
 *   - download(url)              — fetch the ZIP from a remote URL
 *   - verify(buffer, checksum)   — SHA-256 integrity check
 *   - extract(buffer, targetDir) — unzip into /app/plugins/{pluginId}/{version}/
 *   - cleanup(pluginId)          — remove all versions for a plugin
 */
@Injectable()
export class PluginArtifactService {
  private readonly logger = new Logger(PluginArtifactService.name);

  // ─── Public API ────────────────────────────────────────────────────────────

  /**
   * Download a plugin artifact from the given URL.
   * Returns the raw buffer plus HTTP metadata.
   */
  async download(url: string): Promise<ArtifactDownloadResult> {
    this.logger.log(`Downloading plugin artifact from: ${url}`);

    let response: Response;
    try {
      response = await fetch(url);
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Network error while downloading artifact: ${msg}`);
      throw new InternalServerErrorException(`Artifact download failed: ${msg}`);
    }

    if (!response.ok) {
      const msg = `HTTP ${response.status} ${response.statusText} from ${url}`;
      this.logger.error(`Artifact download error: ${msg}`);
      throw new InternalServerErrorException(`Failed to download artifact: ${msg}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') ?? undefined;

    this.logger.log(
      `Downloaded artifact: ${buffer.length} bytes (content-type=${contentType ?? 'unknown'})`,
    );
    return { buffer, contentType, size: buffer.length };
  }

  /**
   * Verify a buffer against an expected SHA-256 checksum.
   * Accepts both bare hex strings and "sha256:<hex>" prefixed strings.
   *
   * @throws BadRequestException when the digest does not match.
   */
  verify(buffer: Buffer, checksum: string): void {
    const expected = checksum.toLowerCase().replace(/^sha256:/, '');
    const actual = createHash('sha256').update(buffer).digest('hex');

    if (actual !== expected) {
      this.logger.error(
        `Checksum mismatch — expected=${expected} actual=${actual}`,
      );
      throw new BadRequestException(
        `Artifact integrity check failed: checksum mismatch (expected=${expected}, got=${actual})`,
      );
    }

    this.logger.log(`Artifact checksum verified (sha256=${actual})`);
  }

  /**
   * Extract a ZIP artifact buffer into targetDir.
   * Creates targetDir (and all parent directories) when absent.
   * Uses the system `unzip` binary available in the container.
   *
   * @throws InternalServerErrorException on extraction failure.
   */
  async extract(buffer: Buffer, targetDir: string): Promise<void> {
    this.logger.log(`Extracting artifact to: ${targetDir}`);
    await fs.mkdir(targetDir, { recursive: true });

    const tmpFile = join(tmpdir(), `unicore-plugin-${randomUUID()}.zip`);
    try {
      await fs.writeFile(tmpFile, buffer);
      await execAsync(`unzip -o "${tmpFile}" -d "${targetDir}"`);
      this.logger.log(`Artifact extracted successfully to ${targetDir}`);
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`Extraction failed for ${targetDir}: ${msg}`);
      throw new InternalServerErrorException(
        `Failed to extract plugin artifact: ${msg}`,
      );
    } finally {
      await fs.unlink(tmpFile).catch(() => undefined);
    }
  }

  /**
   * Remove all artifact files stored for a given pluginId
   * (i.e. /app/plugins/{pluginId}/ and all version subdirectories).
   * Resolves quietly when the directory does not exist.
   */
  async cleanup(pluginId: string): Promise<void> {
    const pluginDir = join(PLUGINS_BASE_DIR, pluginId);
    this.logger.log(`Cleaning up plugin artifacts at: ${pluginDir}`);

    try {
      await fs.rm(pluginDir, { recursive: true, force: true });
      this.logger.log(`Cleaned up ${pluginDir}`);
    } catch (err) {
      // Non-fatal — log and continue
      this.logger.warn(
        `Cleanup warning for ${pluginDir}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Returns the canonical install path for a specific plugin version.
   * Format: /app/plugins/{pluginId}/{version}
   */
  getInstallPath(pluginId: string, version: string): string {
    return join(PLUGINS_BASE_DIR, pluginId, version);
  }
}
