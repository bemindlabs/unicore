import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { IngestDocumentDto, IngestBatchDto, DeleteDocumentsDto, DeleteScopeType, IngestGitRepoDto } from '../common/dto/ingest.dto';
import { GitRepoIngestor } from '../ingest/git-repo.ingestor';

@Controller('ingest')
export class IngestionController {
  private readonly logger = new Logger(IngestionController.name);

  constructor(
    private readonly ingestion: IngestionService,
    private readonly gitRepoIngestor: GitRepoIngestor,
  ) {}

  /**
   * POST /ingest
   * Ingest a single document: chunk → embed → store in Qdrant.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async ingestDocument(@Body() dto: IngestDocumentDto) {
    this.logger.debug(`Ingest document for workspace ${dto.metadata.workspaceId}`);
    return this.ingestion.ingestDocument(dto);
  }

  /**
   * POST /ingest/batch
   * Ingest multiple documents in one request.
   */
  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  async ingestBatch(@Body() dto: IngestBatchDto) {
    this.logger.debug(`Batch ingest: ${dto.documents.length} documents`);
    return this.ingestion.ingestBatch(dto.documents);
  }

  /**
   * DELETE /ingest
   * Delete vectors by scope (document / agent / workspace).
   */
  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteDocuments(@Body() dto: DeleteDocumentsDto) {
    return this.ingestion.deleteDocuments(dto);
  }

  /**
   * DELETE /ingest/:documentId
   * Delete a single document by ID (all its chunks from the default workspace).
   */
  @Delete(':documentId')
  @HttpCode(HttpStatus.OK)
  async deleteDocument(@Param('documentId') documentId: string) {
    return this.ingestion.deleteDocuments({
      scope: DeleteScopeType.DOCUMENT,
      workspaceId: 'default',
      documentId,
    });
  }

  /**
   * POST /ingest/git-repo
   * Ingest a Git repository: clone, walk files with glob filters and max file
   * size, chunk code, create embeddings, and store in Qdrant.
   * Returns immediately with PENDING status; ingestion runs in the background.
   */
  @Post('git-repo')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestGitRepo(@Body() dto: IngestGitRepoDto) {
    this.logger.log(`Git repo ingest: ${dto.url} (branch: ${dto.branch ?? 'main'})`);
    return this.gitRepoIngestor.ingest({
      url: dto.url,
      branch: dto.branch,
      authToken: dto.authToken,
      workspaceId: dto.workspaceId,
      agentId: dto.agentId,
      filters: dto.filters,
      maxFileSize: dto.maxFileSize,
    });
  }

  /**
   * GET /ingest/info/:workspaceId
   * Return collection stats for a workspace.
   */
  @Get('info/:workspaceId')
  async getWorkspaceInfo(@Param('workspaceId') workspaceId: string) {
    const info = await this.ingestion.getDocumentInfo(workspaceId);
    if (!info) {
      return { workspaceId, exists: false };
    }
    return { workspaceId, exists: true, ...info };
  }
}
