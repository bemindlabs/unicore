import { NotFoundException } from '@nestjs/common';
import { PromptService } from './prompt.service';

// Prevent disk I/O during unit tests
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  readdirSync: jest.fn().mockReturnValue([]),
  readFileSync: jest.fn(),
}));

describe('PromptService', () => {
  let service: PromptService;

  beforeEach(() => {
    service = new PromptService();
    service.onModuleInit();
  });

  describe('register()', () => {
    it('creates a new template at version 1', () => {
      const tpl = service.register({
        key: 'test:greet',
        name: 'Greeting',
        content: 'Hello, {{name}}!',
      });

      expect(tpl.key).toBe('test:greet');
      expect(tpl.versions).toHaveLength(1);
      expect(tpl.activeVersion).toBe(1);
    });

    it('creates a new version when registering an existing key', () => {
      service.register({ key: 'test:v', name: 'V', content: 'v1' });
      const updated = service.register({ key: 'test:v', name: 'V', content: 'v2' });

      expect(updated.versions).toHaveLength(2);
      expect(updated.activeVersion).toBe(2);
    });
  });

  describe('render()', () => {
    it('interpolates Handlebars variables', () => {
      service.register({
        key: 'test:hello',
        name: 'Hello',
        content: 'Hello, {{name}}! You have {{count}} messages.',
      });

      const result = service.render('test:hello', { name: 'Alice', count: 3 });
      expect(result).toBe('Hello, Alice! You have 3 messages.');
    });

    it('renders a specific version when version option is supplied', () => {
      service.register({ key: 'test:ver', name: 'V', content: 'version one' });
      service.update('test:ver', { content: 'version two' });

      const v1 = service.render('test:ver', {}, { version: 1 });
      const v2 = service.render('test:ver', {}, { version: 2 });

      expect(v1).toBe('version one');
      expect(v2).toBe('version two');
    });

    it('throws NotFoundException for unknown template', () => {
      expect(() => service.render('does:not:exist')).toThrow(NotFoundException);
    });

    it('renders Handlebars #each blocks', () => {
      service.register({
        key: 'test:each',
        name: 'Each',
        content: '{{#each items}}- {{this}}\n{{/each}}',
      });

      const result = service.render('test:each', { items: ['a', 'b', 'c'] });
      expect(result).toContain('- a');
      expect(result).toContain('- b');
      expect(result).toContain('- c');
    });
  });

  describe('setActiveVersion()', () => {
    it('changes the active version', () => {
      service.register({ key: 'test:av', name: 'AV', content: 'v1' });
      service.update('test:av', { content: 'v2' });
      service.setActiveVersion('test:av', 1);

      const tpl = service.get('test:av');
      expect(tpl.activeVersion).toBe(1);
    });

    it('throws NotFoundException for invalid version number', () => {
      service.register({ key: 'test:av2', name: 'AV2', content: 'v1' });
      expect(() => service.setActiveVersion('test:av2', 99)).toThrow(
        NotFoundException,
      );
    });
  });

  describe('list()', () => {
    it('returns all templates when no tag filter is given', () => {
      const all = service.list();
      expect(all.length).toBeGreaterThan(0); // built-ins are seeded
    });

    it('filters templates by tag', () => {
      service.register({
        key: 'test:tagged',
        name: 'Tagged',
        content: 'hi',
        tags: ['my-tag'],
      });

      const tagged = service.list('my-tag');
      expect(tagged.every((t) => t.tags?.includes('my-tag'))).toBe(true);
    });
  });

  describe('built-in templates', () => {
    it('seeds system:base template', () => {
      expect(service.exists('system:base')).toBe(true);
    });

    it('seeds agent:summary template', () => {
      expect(service.exists('agent:summary')).toBe(true);
    });

    it('seeds agent:extract-tasks template', () => {
      expect(service.exists('agent:extract-tasks')).toBe(true);
    });

    it('seeds rag:context-inject template', () => {
      expect(service.exists('rag:context-inject')).toBe(true);
    });

    it('renders system:base with variables', () => {
      const rendered = service.render('system:base', {
        currentDate: '2026-03-10',
        language: 'English',
      });
      expect(rendered).toContain('2026-03-10');
      expect(rendered).toContain('English');
    });
  });

  describe('renderRaw()', () => {
    it('renders an inline template string', () => {
      const result = service.renderRaw('Hi {{who}}!', { who: 'World' });
      expect(result).toBe('Hi World!');
    });
  });
});
