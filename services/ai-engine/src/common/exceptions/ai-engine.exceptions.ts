import { HttpException, HttpStatus } from '@nestjs/common';

export class ProviderFailoverException extends HttpException {
  constructor(attemptedProviders: string[], errors: string[]) {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'ProviderUnavailable',
        message: 'All LLM providers are unavailable',
        attemptedProviders,
        errors,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

export class TemplateNotFoundException extends HttpException {
  constructor(key: string) {
    super(
      {
        statusCode: HttpStatus.NOT_FOUND,
        error: 'TemplateNotFound',
        message: `Prompt template "${key}" not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
