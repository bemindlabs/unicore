import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class IndexRepoDto {
  @IsString()
  @IsNotEmpty()
  repoUrl!: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  authToken?: string;

  @IsString()
  @IsNotEmpty()
  workspaceId!: string;

  @IsOptional()
  @IsString()
  agentId?: string;
}

export enum GitIndexStatus {
  PENDING = 'pending',
  INDEXING = 'indexing',
  DONE = 'done',
  FAILED = 'failed',
}

export interface GitRepoState {
  repoId: string;
  repoUrl: string;
  branch: string;
  workspaceId: string;
  agentId?: string;
  status: GitIndexStatus;
  lastCommitSha?: string;
  indexedFiles: number;
  totalChunks: number;
  /** Internal: tracks document IDs for cleanup on re-index/delete */
  documentIds: string[];
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface GitRepoStatusResponse {
  repoId: string;
  repoUrl: string;
  branch: string;
  workspaceId: string;
  agentId?: string;
  status: GitIndexStatus;
  lastCommitSha?: string;
  indexedFiles: number;
  totalChunks: number;
  error?: string;
  startedAt: string;
  completedAt?: string;
}
