import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
  Query,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { LlmService } from './llm.service';
import {
  CompleteRequestDto,
  EmbedRequestDto,
} from '../common/dto/complete-request.dto';
import { ProviderUnavailableError } from './factory/provider-factory.service';
import { ProviderFailoverException } from '../common/exceptions/ai-engine.exceptions';

@Controller('llm')
export class LlmController {
  private readonly logger = new Logger(LlmController.name);

  constructor(private readonly llmService: LlmService) {}

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  async complete(@Body() dto: CompleteRequestDto) {
    try {
      return await this.llmService.complete(
        dto.messages,
        {
          model: dto.model,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
        {
          preferredProvider: dto.provider,
          tenantId: dto.tenantId,
          agentId: dto.agentId,
        },
      );
    } catch (err) {
      if (err instanceof ProviderUnavailableError) {
        throw new ProviderFailoverException(
          err.attemptedProviders,
          err.underlyingErrors,
        );
      }
      throw err;
    }
  }

  @Post('stream')
  async stream(@Body() dto: CompleteRequestDto, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const gen = this.llmService.stream(
        dto.messages,
        {
          model: dto.model,
          temperature: dto.temperature,
          maxTokens: dto.maxTokens,
        },
        {
          preferredProvider: dto.provider,
          tenantId: dto.tenantId,
          agentId: dto.agentId,
        },
      );

      for await (const chunk of gen) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if (chunk.done) break;
      }
    } catch (err) {
      const SAFE_FALLBACK = 'Stream processing error';
      const raw = err instanceof Error ? err.message : SAFE_FALLBACK;
      const message = raw
        .replace(/[<>]/g, '')
        .slice(0, 200) || SAFE_FALLBACK;
      res.write(`data: ${JSON.stringify({ error: message, done: true })}\n\n`);
      this.logger.error(`Stream error: ${raw}`);
    } finally {
      res.end();
    }
  }

  @Post('embed')
  @HttpCode(HttpStatus.OK)
  async embed(@Body() dto: EmbedRequestDto) {
    try {
      return await this.llmService.embed(
        dto.text,
        { model: dto.model },
        {
          preferredProvider: dto.provider,
          tenantId: dto.tenantId,
          agentId: dto.agentId,
        },
      );
    } catch (err) {
      if (err instanceof ProviderUnavailableError) {
        throw new ProviderFailoverException(
          err.attemptedProviders,
          err.underlyingErrors,
        );
      }
      throw err;
    }
  }

  @Get('health')
  async health() {
    return { providers: await this.llmService.healthCheck() };
  }

  @Get('models')
  async models() {
    return { models: await this.llmService.listModels() };
  }

  @Post('reload')
  @HttpCode(HttpStatus.OK)
  async reload() {
    const providers = await this.llmService.reloadProviders();
    return { reloaded: true, providers };
  }
}
