import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { extname, relative } from 'path';

export interface CodeChunk {
  content: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  chunkType: 'file' | 'function';
  commitAuthor: string;
  commitDate: string;
}

export interface ChunkFileOptions {
  filePath: string;
  repoRoot: string;
  commitAuthor: string;
  commitDate: string;
}

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.bin',
  '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.lock', '.map', '.snap',
]);

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python',
  '.go': 'go',
  '.java': 'java',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.php': 'php',
  '.cs': 'csharp',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp',
  '.c': 'c', '.h': 'c',
  '.md': 'markdown', '.mdx': 'markdown',
  '.json': 'json',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.toml': 'toml',
  '.sh': 'bash', '.bash': 'bash',
  '.sql': 'sql',
  '.html': 'html', '.htm': 'html',
  '.css': 'css', '.scss': 'css', '.sass': 'css',
};

export const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '__pycache__',
  'vendor', '.cache', 'coverage', '.nyc_output', 'target', '.turbo',
  'out', '.output', '.vercel',
]);

const FILE_SIZE_THRESHOLD_LINES = 500;

// Regex to detect top-level function/class declarations per language
const FUNCTION_PATTERNS: Record<string, RegExp> = {
  typescript: /^(?:export\s+)?(?:(?:async\s+)?function\s+\w+|class\s+\w+|interface\s+\w+|type\s+\w+\s*=|enum\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\()/,
  javascript: /^(?:export\s+)?(?:(?:async\s+)?function\s+\w+|class\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\()/,
  python: /^(?:def |class |async def )/,
  go: /^(?:func |type )/,
};

@Injectable()
export class CodeChunkerService {
  private readonly logger = new Logger(CodeChunkerService.name);

  shouldSkipPath(filePath: string): boolean {
    return filePath.split(/[\\/]/).some((p) => SKIP_DIRS.has(p));
  }

  isBinaryFile(filePath: string): boolean {
    return BINARY_EXTENSIONS.has(extname(filePath).toLowerCase());
  }

  detectLanguage(filePath: string): string {
    return LANGUAGE_MAP[extname(filePath).toLowerCase()] ?? 'text';
  }

  async chunkFile(options: ChunkFileOptions): Promise<CodeChunk[]> {
    const { filePath, repoRoot, commitAuthor, commitDate } = options;
    const relPath = relative(repoRoot, filePath);

    if (this.shouldSkipPath(relPath) || this.isBinaryFile(filePath)) {
      return [];
    }

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (err) {
      this.logger.warn(`Could not read ${relPath}: ${String(err)}`);
      return [];
    }

    if (content.trim().length === 0) return [];

    // Reject files that look binary (null bytes in first 8KB)
    if (content.slice(0, 8192).includes('\0')) return [];

    const language = this.detectLanguage(filePath);
    const lines = content.split('\n');

    // Small file: emit as a single file-level chunk
    if (lines.length <= FILE_SIZE_THRESHOLD_LINES) {
      return [{
        content,
        filePath: relPath,
        language,
        startLine: 1,
        endLine: lines.length,
        chunkType: 'file',
        commitAuthor,
        commitDate,
      }];
    }

    // Large file: split by function/class boundaries
    return this.splitByFunctions(content, relPath, language, commitAuthor, commitDate);
  }

  private splitByFunctions(
    content: string,
    relPath: string,
    language: string,
    commitAuthor: string,
    commitDate: string,
  ): CodeChunk[] {
    const pattern = FUNCTION_PATTERNS[language];
    if (!pattern) {
      return this.chunkByLines(content, relPath, language, commitAuthor, commitDate);
    }

    const lines = content.split('\n');
    // Collect line indices where top-level declarations start
    const boundaries: number[] = [0];
    for (let i = 1; i < lines.length; i++) {
      if (pattern.test(lines[i]!)) {
        boundaries.push(i);
      }
    }
    boundaries.push(lines.length);

    const chunks: CodeChunk[] = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      const start = boundaries[i]!;
      const end = boundaries[i + 1]!;
      const slice = lines.slice(start, end).join('\n').trim();
      if (slice.length === 0) continue;
      chunks.push({
        content: slice,
        filePath: relPath,
        language,
        startLine: start + 1,
        endLine: end,
        chunkType: 'function',
        commitAuthor,
        commitDate,
      });
    }

    return chunks.length > 0
      ? chunks
      : this.chunkByLines(content, relPath, language, commitAuthor, commitDate);
  }

  private chunkByLines(
    content: string,
    relPath: string,
    language: string,
    commitAuthor: string,
    commitDate: string,
  ): CodeChunk[] {
    const lines = content.split('\n');
    const chunkSize = FILE_SIZE_THRESHOLD_LINES;
    const chunks: CodeChunk[] = [];

    for (let i = 0; i < lines.length; i += chunkSize) {
      const slice = lines.slice(i, i + chunkSize).join('\n').trim();
      if (slice.length === 0) continue;
      chunks.push({
        content: slice,
        filePath: relPath,
        language,
        startLine: i + 1,
        endLine: Math.min(i + chunkSize, lines.length),
        chunkType: 'file',
        commitAuthor,
        commitDate,
      });
    }

    return chunks;
  }
}
