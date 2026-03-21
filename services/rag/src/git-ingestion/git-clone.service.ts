import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { existsSync, mkdirSync } from 'fs';
import { rm } from 'fs/promises';
import simpleGit from 'simple-git';

export interface CloneResult {
  localPath: string;
  headSha: string;
}

export interface CommitMeta {
  sha: string;
  author: string;
  date: string;
}

@Injectable()
export class GitCloneService {
  private readonly logger = new Logger(GitCloneService.name);
  private readonly baseDir: string;

  constructor() {
    this.baseDir = join(tmpdir(), 'unicore-rag-repos');
    mkdirSync(this.baseDir, { recursive: true });
  }

  repoPath(repoId: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(repoId)) {
      throw new BadRequestException(`Invalid repoId: ${repoId}`);
    }
    const resolved = resolve(this.baseDir, repoId);
    if (!resolved.startsWith(this.baseDir)) {
      throw new BadRequestException('Path traversal detected in repoId');
    }
    return resolved;
  }

  private injectToken(repoUrl: string, authToken: string): string {
    try {
      const url = new URL(repoUrl);
      url.username = 'oauth2';
      url.password = encodeURIComponent(authToken);
      return url.toString();
    } catch {
      return repoUrl;
    }
  }

  async cloneOrPull(
    repoId: string,
    repoUrl: string,
    branch = 'main',
    authToken?: string,
  ): Promise<CloneResult> {
    const localPath = this.repoPath(repoId);
    const cloneUrl = authToken ? this.injectToken(repoUrl, authToken) : repoUrl;

    if (existsSync(localPath)) {
      this.logger.log(`Pulling existing repo ${repoId} (branch: ${branch})`);
      const git = simpleGit(localPath);
      try {
        await git.fetch('origin');
        await git.reset(['--hard', `origin/${branch}`]);
      } catch {
        // Pull failed — re-clone
        this.logger.warn(`Pull failed for ${repoId}, re-cloning`);
        await rm(localPath, { recursive: true, force: true });
        await this.doClone(cloneUrl, localPath, branch);
      }
    } else {
      await this.doClone(cloneUrl, localPath, branch);
    }

    const git = simpleGit(localPath);
    const headSha = (await git.revparse(['HEAD'])).trim();
    return { localPath, headSha };
  }

  private async doClone(url: string, localPath: string, branch: string): Promise<void> {
    const baseArgs = ['--depth', '50'];
    try {
      await simpleGit().clone(url, localPath, [...baseArgs, '--branch', branch]);
    } catch {
      // Branch flag may have failed — retry without it
      try {
        await rm(localPath, { recursive: true, force: true });
        await simpleGit().clone(url, localPath, baseArgs);
      } catch (err) {
        await rm(localPath, { recursive: true, force: true });
        throw err;
      }
    }
  }

  async getCommitMeta(localPath: string): Promise<CommitMeta> {
    try {
      const git = simpleGit(localPath);
      const log = await git.log({ maxCount: 1 });
      return {
        sha: log.latest?.hash ?? '',
        author: log.latest?.author_name ?? 'unknown',
        date: log.latest?.date ?? new Date().toISOString(),
      };
    } catch {
      return { sha: '', author: 'unknown', date: new Date().toISOString() };
    }
  }

  async cleanup(repoId: string): Promise<void> {
    const localPath = this.repoPath(repoId);
    if (existsSync(localPath)) {
      await rm(localPath, { recursive: true, force: true });
      this.logger.log(`Cleaned up repo ${repoId}`);
    }
  }
}
