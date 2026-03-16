import type { IntentCategory } from '../interfaces/agent-base.interface';
import {
  buildClassificationSystemPrompt,
  buildClassificationUserPrompt,
  FALLBACK_RESPONSE_TEMPLATE,
  INTENT_DESCRIPTIONS,
} from './router.prompts';

describe('Router prompts', () => {
  describe('INTENT_DESCRIPTIONS', () => {
    const expectedIntents: IntentCategory[] = ['comms', 'finance', 'growth', 'ops', 'research', 'erp', 'builder', 'unknown'];

    it('defines descriptions for all 8 intent categories', () => {
      expectedIntents.forEach(function(intent) {
        expect(INTENT_DESCRIPTIONS).toHaveProperty(intent);
        const desc = INTENT_DESCRIPTIONS[intent];
        expect(typeof desc).toBe('string');
      });
    });

    it('descriptions are non-empty strings', () => {
      Object.values(INTENT_DESCRIPTIONS).forEach(function(desc) {
        expect(desc.length).toBeGreaterThan(10);
      });
    });
  });

  describe('buildClassificationSystemPrompt', () => {
    let prompt: string;

    beforeEach(function() {
      prompt = buildClassificationSystemPrompt();
    });

    it('returns a non-empty string', () => {
      expect(prompt.length).toBeGreaterThan(100);
    });

    it('includes all 7 specialist intent names (excluding unknown)', () => {
      const intents = ['comms', 'finance', 'growth', 'ops', 'research', 'erp', 'builder'];
      intents.forEach(function(intent) {
        expect(prompt).toContain(intent);
      });
    });

    it('includes "unknown" as a valid intent option', () => {
      expect(prompt).toContain('unknown');
    });

    it('instructs the model to return JSON', () => {
      expect(prompt.toLowerCase()).toMatch(/json/);
    });

    it('specifies the confidence range', () => {
      expect(prompt).toMatch(/0\.0|0\.0.1\.0/);
    });
  });

  describe('buildClassificationUserPrompt', () => {
    it('includes the user message verbatim', () => {
      const msg = 'Can you send an email to Alice?';
      const result = buildClassificationUserPrompt(msg);
      expect(result).toContain(msg);
    });

    it('is not empty', () => {
      expect(buildClassificationUserPrompt('test').length).toBeGreaterThan(0);
    });
  });

  describe('FALLBACK_RESPONSE_TEMPLATE', () => {
    it('mentions each specialist agent domain', () => {
      const domains = ['Comms Agent', 'Finance Agent', 'Ops Agent', 'ERP Agent', 'Research Agent', 'Growth Agent', 'Builder Agent'];
      domains.forEach(function(domain) {
        expect(FALLBACK_RESPONSE_TEMPLATE).toContain(domain);
      });
    });

    it('is a non-empty string', () => {
      expect(FALLBACK_RESPONSE_TEMPLATE.length).toBeGreaterThan(50);
    });
  });
});
