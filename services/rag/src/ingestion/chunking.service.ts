import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}

export interface TextChunk {
  content: string;
  startChar: number;
  endChar: number;
  index: number;
}

/**
 * RecursiveTextSplitter — mirrors LangChain's recursive character splitter.
 *
 * Algorithm:
 *  1. Try to split by the first separator that produces chunks within size.
 *  2. If a split still exceeds chunkSize, recurse with remaining separators.
 *  3. Merge small adjacent chunks until they reach chunkSize, respecting overlap.
 */
@Injectable()
export class ChunkingService {
  private readonly defaultChunkSize: number;
  private readonly defaultChunkOverlap: number;

  private static readonly DEFAULT_SEPARATORS = [
    '\n\n',
    '\n',
    '. ',
    '! ',
    '? ',
    '; ',
    ', ',
    ' ',
    '',
  ];

  constructor(private readonly config: ConfigService) {
    this.defaultChunkSize = this.config.get<number>('CHUNK_SIZE', 512);
    this.defaultChunkOverlap = this.config.get<number>('CHUNK_OVERLAP', 64);
  }

  split(text: string, options?: ChunkOptions): TextChunk[] {
    const chunkSize = options?.chunkSize ?? this.defaultChunkSize;
    const overlap = options?.chunkOverlap ?? this.defaultChunkOverlap;
    const separators =
      options?.separators ?? ChunkingService.DEFAULT_SEPARATORS;

    const rawChunks = this.recursiveSplit(text, separators, chunkSize);
    const merged = this.mergeChunks(rawChunks, chunkSize, overlap);

    return merged.map((content, index) => {
      const startChar = text.indexOf(content);
      return {
        content,
        startChar: startChar >= 0 ? startChar : 0,
        endChar: startChar >= 0 ? startChar + content.length : content.length,
        index,
      };
    });
  }

  private recursiveSplit(
    text: string,
    separators: string[],
    chunkSize: number,
  ): string[] {
    // Base case: text fits within chunkSize
    if (text.length <= chunkSize) {
      return text.length > 0 ? [text] : [];
    }

    const [separator, ...remainingSeparators] = separators;

    // Last resort: split by character
    if (separator === '') {
      const chunks: string[] = [];
      for (let i = 0; i < text.length; i += chunkSize) {
        chunks.push(text.slice(i, i + chunkSize));
      }
      return chunks;
    }

    const splits = text.split(separator).filter((s) => s.length > 0);

    // If no splits occurred, try the next separator
    if (splits.length <= 1) {
      return remainingSeparators.length > 0
        ? this.recursiveSplit(text, remainingSeparators, chunkSize)
        : [text];
    }

    // Process each split
    const goodSplits: string[] = [];
    for (const split of splits) {
      if (split.length <= chunkSize) {
        goodSplits.push(split);
      } else if (remainingSeparators.length > 0) {
        // Recurse with remaining separators for oversized splits
        const subChunks = this.recursiveSplit(
          split,
          remainingSeparators,
          chunkSize,
        );
        goodSplits.push(...subChunks);
      } else {
        // Fallback: hard split
        for (let i = 0; i < split.length; i += chunkSize) {
          goodSplits.push(split.slice(i, i + chunkSize));
        }
      }
    }

    return goodSplits;
  }

  private mergeChunks(
    splits: string[],
    chunkSize: number,
    overlap: number,
  ): string[] {
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLen = 0;

    for (const split of splits) {
      const splitLen = split.length;

      if (currentLen + splitLen > chunkSize && currentChunk.length > 0) {
        // Emit current chunk
        const chunk = currentChunk.join(' ').trim();
        if (chunk.length > 0) {
          chunks.push(chunk);
        }

        // Build overlap: keep trailing pieces that fit within overlap window
        while (
          currentChunk.length > 0 &&
          currentLen > overlap
        ) {
          const removed = currentChunk.shift()!;
          currentLen -= removed.length + 1; // +1 for space
        }
      }

      currentChunk.push(split);
      currentLen += splitLen + 1;
    }

    if (currentChunk.length > 0) {
      const chunk = currentChunk.join(' ').trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }
}
