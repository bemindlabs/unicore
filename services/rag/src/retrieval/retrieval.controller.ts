import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { RetrievalService } from './retrieval.service';
import { RetrievalQueryDto } from '../common/dto/retrieval.dto';

@Controller('query')
export class RetrievalController {
  private readonly logger = new Logger(RetrievalController.name);

  constructor(private readonly retrieval: RetrievalService) {}

  /**
   * POST /query
   * Semantic search — find the most relevant document chunks for a query.
   *
   * Scoped by workspaceId (collection-level isolation) and optionally
   * agentId (payload-level filtering within the collection).
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async query(@Body() dto: RetrievalQueryDto) {
    this.logger.debug(
      `Query: "${dto.query.slice(0, 60)}..." workspace=${dto.workspaceId} agent=${dto.agentId ?? 'all'}`,
    );
    return this.retrieval.query(dto);
  }

  /**
   * GET /query/document/:workspaceId/:documentId
   * Retrieve all chunks for a specific document (ordered by chunkIndex).
   */
  @Get('document/:workspaceId/:documentId')
  async getDocumentChunks(
    @Param('workspaceId') workspaceId: string,
    @Param('documentId') documentId: string,
  ) {
    return this.retrieval.getDocumentChunks(workspaceId, documentId);
  }
}
