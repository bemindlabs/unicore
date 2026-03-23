import { MentionParserService } from './mention-parser.service';

describe('MentionParserService', () => {
  let service: MentionParserService;

  beforeEach(() => {
    service = new MentionParserService();
  });

  describe('parse — no mention', () => {
    it('returns null mention for plain text', () => {
      const result = service.parse('what is the sales pipeline?');
      expect(result.mention).toBeNull();
      expect(result.allMentions).toEqual([]);
    });

    it('preserves content unchanged when no mention present', () => {
      const text = 'show me the dashboard';
      const result = service.parse(text);
      expect(result.strippedContent).toBe(text);
    });

    it('ignores @mentions not matching a valid agent type', () => {
      const result = service.parse('@unknown what is this?');
      expect(result.mention).toBeNull();
      expect(result.allMentions).toEqual([]);
    });
  });

  describe('parse — single mention', () => {
    it('detects @comms mention', () => {
      const result = service.parse('@comms draft an email to John');
      expect(result.mention).toBe('comms');
    });

    it('detects @finance mention', () => {
      const result = service.parse('@finance what is Q3 burn rate?');
      expect(result.mention).toBe('finance');
    });

    it('detects @growth mention', () => {
      const result = service.parse('@growth analyse our funnel');
      expect(result.mention).toBe('growth');
    });

    it('detects @ops mention', () => {
      const result = service.parse('@ops check server health');
      expect(result.mention).toBe('ops');
    });

    it('detects @research mention', () => {
      const result = service.parse('@research market trends for AI');
      expect(result.mention).toBe('research');
    });

    it('detects @erp mention', () => {
      const result = service.parse('@erp show low stock alerts');
      expect(result.mention).toBe('erp');
    });

    it('detects @builder mention', () => {
      const result = service.parse('@builder create a new workflow');
      expect(result.mention).toBe('builder');
    });

    it('detects @sentinel mention', () => {
      const result = service.parse('@sentinel check for anomalies');
      expect(result.mention).toBe('sentinel');
    });

    it('is case-insensitive for mention resolution', () => {
      const result = service.parse('@Finance show P&L');
      expect(result.mention).toBe('finance');
    });

    it('strips the @mention from strippedContent', () => {
      const result = service.parse('@finance show me Q3 burn rate');
      expect(result.strippedContent).toBe('show me Q3 burn rate');
    });

    it('strips mid-sentence mention and normalises spaces', () => {
      const result = service.parse('hey @comms send an update');
      expect(result.strippedContent).toBe('hey send an update');
    });

    it('returns single-element allMentions array', () => {
      const result = service.parse('@erp list all invoices');
      expect(result.allMentions).toEqual(['erp']);
    });
  });

  describe('parse — multiple mentions', () => {
    it('uses first valid mention as primary', () => {
      const result = service.parse('@comms and @finance discuss the budget');
      expect(result.mention).toBe('comms');
    });

    it('captures all valid mentions in allMentions', () => {
      const result = service.parse('@ops and @sentinel check health');
      expect(result.allMentions).toEqual(['ops', 'sentinel']);
    });

    it('strips only the first mention from strippedContent', () => {
      const result = service.parse('@comms and @finance review');
      expect(result.strippedContent).toBe('and @finance review');
    });
  });

  describe('parse — edge cases', () => {
    it('handles empty string', () => {
      const result = service.parse('');
      expect(result.mention).toBeNull();
      expect(result.strippedContent).toBe('');
    });

    it('handles message that is only an @mention', () => {
      const result = service.parse('@erp');
      expect(result.mention).toBe('erp');
      expect(result.strippedContent).toBe('');
    });

    it('handles email-like addresses without confusion', () => {
      const result = service.parse('send to user@example.com');
      // "example" is not a valid agent type
      expect(result.mention).toBeNull();
    });
  });
});
