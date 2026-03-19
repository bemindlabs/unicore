import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AiEngineModule } from '../src/ai-engine.module';

/**
 * E2E tests for the AI Engine REST API.
 *
 * These tests use a fully bootstrapped NestJS application but do NOT call
 * real LLM APIs — provider calls are mocked at the provider-factory level.
 */
describe('AiEngine (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Disable failover so tests don't require real provider keys
    process.env.LLM_FAILOVER_ENABLED = 'false';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AiEngineModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/prompts', () => {
    it('returns the seeded built-in templates', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/prompts')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/prompts?tag=builtin', () => {
    it('filters templates by tag', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/prompts?tag=builtin')
        .expect(200);

      expect(res.body.every((t: { tags: string[] }) => t.tags?.includes('builtin'))).toBe(true);
    });
  });

  describe('POST /api/v1/prompts', () => {
    it('registers a new template', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/prompts')
        .send({ key: 'e2e:test', name: 'E2E Test', content: 'Hello {{name}}!' })
        .expect(201);

      expect(res.body.key).toBe('e2e:test');
      expect(res.body.activeVersion).toBe(1);
    });
  });

  describe('POST /api/v1/prompts/:key/render', () => {
    it('renders a template with variables', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/prompts/e2e:test/render')
        .send({ variables: { name: 'World' } })
        .expect(200);

      expect(res.body.rendered).toBe('Hello World!');
    });
  });

  describe('GET /api/v1/usage/stats', () => {
    it('returns usage stats structure', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/usage/stats')
        .expect(200);

      expect(res.body).toHaveProperty('totalRequests');
      expect(res.body).toHaveProperty('totalTokens');
      expect(res.body).toHaveProperty('byProvider');
    });
  });

  describe('GET /api/v1/llm/health', () => {
    it('returns health status for all providers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/llm/health')
        .expect(200);

      expect(res.body).toHaveProperty('providers');
      expect(Array.isArray(res.body.providers)).toBe(true);
    });
  });
});
