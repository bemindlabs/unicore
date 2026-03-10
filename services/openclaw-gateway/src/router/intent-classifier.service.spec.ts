import { Test, TestingModule } from '@nestjs/testing';
import { IntentClassifierService } from './intent-classifier.service';
import { LLM_CLIENT, ILlmClient } from '../common/llm-client.interface';
import type { ClassificationResult } from '../interfaces/classification.interface';

const makeValidResponse = (
  intent: string,
  confidence: number,
  reasoning = 'test reason',
  alternates: Array<{ intent: string; confidence: number }> = [],
): string =>
  JSON.stringify({ intent, confidence, reasoning, alternates });

describe('IntentClassifierService', () => {
  let service: IntentClassifierService;
  let mockLlm: jest.Mocked<ILlmClient>;

  beforeEach(async () => {
    mockLlm = {
      complete: jest.fn(),
    } as jest.Mocked<ILlmClient>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentClassifierService,
        { provide: LLM_CLIENT, useValue: mockLlm },
      ],
    }).compile();

    service = module.get<IntentClassifierService>(IntentClassifierService);
  });

  describe('classify — successful paths', () => {
    it('returns parsed classification for a valid LLM response', async () => {
      mockLlm.complete.mockResolvedValue({
        content: makeValidResponse('comms', 0.92, 'Email-related keywords found'),
        model: 'test-model',
      });

      const result: ClassificationResult = await service.classify('Can you send an email to the client?');

      expect(result.intent).toBe('comms');
      expect(result.confidence).toBe(0.92);
      expect(result.reasoning).toBe('Email-related keywords found');
    });

    it('passes temperature 0.1 and maxTokens 256 to the LLM', async () => {
      mockLlm.complete.mockResolvedValue({
        content: makeValidResponse('finance', 0.88),
        model: 'test-model',
      });

      await service.classify('Generate an invoice for client X');

      expect(mockLlm.complete).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ temperature: 0.1, maxTokens: 256 }),
      );
    });

    it('includes both system and user messages in the LLM call', async () => {
      mockLlm.complete.mockResolvedValue({
        content: makeValidResponse('ops', 0.75),
        model: 'test-model',
      });

      await service.classify('Schedule a meeting for tomorrow');

      const [messages] = mockLlm.complete.mock.calls[0];
      expect(messages.some((m) => m.role === 'system')).toBe(true);
      expect(messages.some((m) => m.role === 'user')).toBe(true);
    });

    it('strips markdown code fences from LLM response', async () => {
      const fenced = '```json\n' + makeValidResponse('research', 0.81) + '\n```';
      mockLlm.complete.mockResolvedValue({ content: fenced, model: 'test-model' });

      const result = await service.classify('Tell me about competitors in the market');
      expect(result.intent).toBe('research');
    });

    it('parses alternates correctly', async () => {
      const raw = makeValidResponse('growth', 0.79, 'Ad campaign keywords', [
        { intent: 'comms', confidence: 0.3 },
      ]);
      mockLlm.complete.mockResolvedValue({ content: raw, model: 'test-model' });

      const result = await service.classify('Improve our Facebook ad performance');
      expect(result.alternates).toHaveLength(1);
      expect(result.alternates![0].intent).toBe('comms');
    });

    it('returns unknown when confidence is below threshold', async () => {
      mockLlm.complete.mockResolvedValue({
        content: makeValidResponse('erp', 0.2, 'Low confidence'),
        model: 'test-model',
      });

      const result = await service.classify('something vague');
      expect(result.intent).toBe('unknown');
    });
  });

  describe('classify — error recovery', () => {
    it('returns unknown classification when LLM throws', async () => {
      mockLlm.complete.mockRejectedValue(new Error('Network timeout'));

      const result = await service.classify('any message');
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe(0);
    });

    it('returns unknown when LLM response is invalid JSON', async () => {
      mockLlm.complete.mockResolvedValue({
        content: 'not json at all',
        model: 'test-model',
      });

      const result = await service.classify('any message');
      expect(result.intent).toBe('unknown');
    });

    it('returns unknown when intent is not a valid category', async () => {
      mockLlm.complete.mockResolvedValue({
        content: JSON.stringify({ intent: 'INVALID_CATEGORY', confidence: 0.9, reasoning: 'bad' }),
        model: 'test-model',
      });

      const result = await service.classify('any message');
      expect(result.intent).toBe('unknown');
    });

    it('coerces missing confidence to 0.5 and does not downgrade valid intent', async () => {
      mockLlm.complete.mockResolvedValue({
        content: JSON.stringify({ intent: 'ops', reasoning: 'task related' }),
        model: 'test-model',
      });

      const result = await service.classify('assign task to team');
      // confidence defaults to 0.5 which is above CONFIDENCE_THRESHOLD
      expect(result.intent).toBe('ops');
      expect(result.confidence).toBe(0.5);
    });
  });
});
