import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GitIngestionService } from './git-ingestion.service';
import { IndexRepoDto } from '../git-ingestion/dto/git-ingestion.dto';

@Controller('git')
export class GitController {
  constructor(private readonly gitIngestion: GitIngestionService) {}

  /**
   * POST /api/v1/git/index
   * Start indexing a Git repository.
   * Returns immediately with PENDING status; indexing runs in the background.
   */
  @Post('index')
  @HttpCode(HttpStatus.ACCEPTED)
  indexRepo(@Body() dto: IndexRepoDto) {
    return this.gitIngestion.indexRepo(dto);
  }

  /**
   * GET /api/v1/git/status/:workspaceId
   * Get the current indexing status for a workspace's repo.
   */
  @Get('status/:workspaceId')
  getStatus(@Param('workspaceId') workspaceId: string) {
    return this.gitIngestion.getStatus(workspaceId);
  }

  /**
   * DELETE /api/v1/git/index/:workspaceId
   * Remove the indexed repo vectors and clean up the cloned directory.
   */
  @Delete('index/:workspaceId')
  deleteIndex(@Param('workspaceId') workspaceId: string) {
    return this.gitIngestion.deleteIndex(workspaceId);
  }
}
