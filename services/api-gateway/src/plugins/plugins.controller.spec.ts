import { Test, TestingModule } from '@nestjs/testing';
import { PluginsController } from './plugins.controller';
import { PluginsService } from './plugins.service';

describe('PluginsController', () => {
  let controller: PluginsController;

  const mockPluginsService = {
    submit: jest.fn(),
    getMyPlugins: jest.fn(),
  };

  const currentUser = { id: 'user-1', email: 'dev@test.com', role: 'OPERATOR' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PluginsController],
      providers: [{ provide: PluginsService, useValue: mockPluginsService }],
    }).compile();

    controller = module.get<PluginsController>(PluginsController);
    jest.clearAllMocks();
  });

  describe('submit', () => {
    it('delegates to service and returns result', async () => {
      const dto = { name: 'Test', slug: 'test', type: 'integration', description: 'desc', version: '1.0.0', author: 'dev' };
      const created = { id: 'p1', ...dto, status: 'draft' };
      mockPluginsService.submit.mockResolvedValue(created);

      const result = await controller.submit(dto as any, currentUser);

      expect(result).toEqual(created);
      expect(mockPluginsService.submit).toHaveBeenCalledWith(dto, currentUser.id);
    });
  });

  describe('myPlugins', () => {
    it('returns plugins for current user', async () => {
      const plugins = [{ id: 'p1' }, { id: 'p2' }];
      mockPluginsService.getMyPlugins.mockResolvedValue(plugins);

      const result = await controller.myPlugins(currentUser);

      expect(result).toEqual(plugins);
      expect(mockPluginsService.getMyPlugins).toHaveBeenCalledWith(currentUser.id);
    });
  });
});
