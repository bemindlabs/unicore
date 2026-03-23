import { Test, TestingModule } from '@nestjs/testing';
import { AdminPluginsController } from './admin-plugins.controller';
import { PluginsService } from './plugins.service';

describe('AdminPluginsController', () => {
  let controller: AdminPluginsController;

  const mockPluginsService = {
    getPending: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
  };

  const adminUser = { id: 'admin-1', email: 'admin@test.com', role: 'OWNER' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminPluginsController],
      providers: [{ provide: PluginsService, useValue: mockPluginsService }],
    }).compile();

    controller = module.get<AdminPluginsController>(AdminPluginsController);
    jest.clearAllMocks();
  });

  describe('getPending', () => {
    it('returns pending plugins', async () => {
      const plugins = [{ id: 'p1', status: 'pending' }];
      mockPluginsService.getPending.mockResolvedValue(plugins);

      const result = await controller.getPending();

      expect(result).toEqual(plugins);
      expect(mockPluginsService.getPending).toHaveBeenCalled();
    });
  });

  describe('approve', () => {
    it('approves plugin and returns updated record', async () => {
      const approved = { id: 'p1', status: 'approved' };
      mockPluginsService.approve.mockResolvedValue(approved);

      const result = await controller.approve('p1', adminUser);

      expect(result).toEqual(approved);
      expect(mockPluginsService.approve).toHaveBeenCalledWith('p1', adminUser.id);
    });
  });

  describe('reject', () => {
    it('rejects plugin with reason and returns updated record', async () => {
      const rejected = { id: 'p1', status: 'rejected', rejectionReason: 'Policy violation' };
      mockPluginsService.reject.mockResolvedValue(rejected);

      const result = await controller.reject('p1', { reason: 'Policy violation' }, adminUser);

      expect(result).toEqual(rejected);
      expect(mockPluginsService.reject).toHaveBeenCalledWith('p1', adminUser.id, 'Policy violation');
    });
  });
});
