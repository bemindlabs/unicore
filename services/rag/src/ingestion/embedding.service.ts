import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  EmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResponse,
} from "../common/interfaces/embedding.interface";

/**
 * EmbeddingService integrates with the unicore AI Engine service to produce
 * vector embeddings for text chunks.  In the absence of the live engine
 * (e.g. unit tests / local dev without GPU) it falls back to a deterministic
 * stub so that the rest of the pipeline can be exercised end-to-end.
 */
@Injectable()
export class EmbeddingService implements EmbeddingProvider {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly aiEngineUrl: string;
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly dimensions: number;

  constructor(private readonly config: ConfigService) {
    this.aiEngineUrl = this.config.get<string>(
      "AI_ENGINE_URL",
      "http://localhost:4200",
    );
    this.apiKey = this.config.get<string>("AI_ENGINE_API_KEY");
    this.model = this.config.get<string>(
      "EMBEDDING_MODEL",
      "text-embedding-3-small",
    );
    this.dimensions = this.config.get<number>("EMBEDDING_DIMENSIONS", 1536);
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = request.model ?? this.model;

    try {
      const response = await fetch(`${this.aiEngineUrl}/api/v1/llm/embed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({ text: request.text, model }),
      });

      if (!response.ok) {
        throw new Error(
          `AI Engine returned ${response.status}: ${await response.text()}`,
        );
      }

      return (await response.json()) as EmbeddingResponse;
    } catch (err) {
      this.logger.warn(
        `AI Engine unavailable, using stub embedding: ${String(err)}`,
      );
      return this.stubEmbed(request.text, model);
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResponse[]> {
    const MAX_BATCH_SIZE = 1000;
    if (texts.length > MAX_BATCH_SIZE) {
      throw new BadRequestException(`Batch size cannot exceed ${MAX_BATCH_SIZE}`);
    }

    try {
      const results = await Promise.all(
        texts.map(async (text) => {
          const response = await fetch(`${this.aiEngineUrl}/api/v1/llm/embed`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(this.apiKey
                ? { Authorization: `Bearer ${this.apiKey}` }
                : {}),
            },
            body: JSON.stringify({ text, model: this.model }),
          });

          if (!response.ok) {
            throw new Error(
              `AI Engine returned ${response.status}: ${await response.text()}`,
            );
          }

          return (await response.json()) as EmbeddingResponse;
        }),
      );
      return results;
    } catch (err) {
      this.logger.warn(
        `AI Engine batch unavailable, using stub embeddings: ${String(err)}`,
      );
      return Promise.all(texts.map((t) => this.stubEmbed(t, this.model)));
    }
  }

  /**
   * Deterministic stub embedding — returns a pseudo-random unit vector seeded
   * from the text hash.  Used only when the AI Engine is unreachable.
   */
  private stubEmbed(text: string, model: string): EmbeddingResponse {
    const seed = this.simpleHash(text);
    const embedding = this.seededUnitVector(seed, this.dimensions);
    return { embedding, model, tokenCount: Math.ceil(text.length / 4) };
  }

  private simpleHash(str: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  private seededUnitVector(seed: number, size: number): number[] {
    const vec: number[] = [];
    let s = seed;
    for (let i = 0; i < size; i++) {
      // LCG
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      vec.push((s / 0xffffffff) * 2 - 1);
    }
    // Normalize to unit vector
    const norm = Math.sqrt(vec.reduce((acc, v) => acc + v * v, 0));
    return vec.map((v) => v / norm);
  }
}
