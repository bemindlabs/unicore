import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

const mockInventoryService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  adjustStock: jest.fn(),
  restock: jest.fn(),
  getStockMovements: jest.fn(),
  getLowStockProducts: jest.fn(),
};

describe('InventoryController', () => {
  let controller: InventoryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: InventoryService, useValue: mockInventoryService }],
    }).compile();
    controller = module.get<InventoryController>(InventoryController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create delegates to service', async () => {
    const dto = { sku: 'SKU1', name: 'Widget', unitPrice: 10 };
    const result = { id: 'p1', sku: 'SKU1' };
    mockInventoryService.create.mockResolvedValue(result);
    expect(await controller.create(dto as any)).toBe(result);
    expect(mockInventoryService.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delegates to service', async () => {
    const query = { page: 1, limit: 20 };
    mockInventoryService.findAll.mockResolvedValue({ data: [], meta: {} });
    await controller.findAll(query as any);
    expect(mockInventoryService.findAll).toHaveBeenCalledWith(query);
  });

  it('getLowStock delegates to service', async () => {
    mockInventoryService.getLowStockProducts.mockResolvedValue([]);
    await controller.getLowStock();
    expect(mockInventoryService.getLowStockProducts).toHaveBeenCalled();
  });

  it('findOne delegates to service', async () => {
    const product = { id: 'p1', sku: 'SKU1' };
    mockInventoryService.findOne.mockResolvedValue(product);
    expect(await controller.findOne('p1')).toBe(product);
    expect(mockInventoryService.findOne).toHaveBeenCalledWith('p1');
  });

  it('update delegates to service', async () => {
    const dto = { name: 'Updated Widget' };
    mockInventoryService.update.mockResolvedValue({ id: 'p1' });
    await controller.update('p1', dto as any);
    expect(mockInventoryService.update).toHaveBeenCalledWith('p1', dto);
  });

  it('remove delegates to service', async () => {
    mockInventoryService.remove.mockResolvedValue(undefined);
    await controller.remove('p1');
    expect(mockInventoryService.remove).toHaveBeenCalledWith('p1');
  });

  it('adjustStock delegates to service', async () => {
    const dto = { delta: 10, reason: 'Recount' };
    mockInventoryService.adjustStock.mockResolvedValue({ id: 'p1' });
    await controller.adjustStock('p1', dto as any);
    expect(mockInventoryService.adjustStock).toHaveBeenCalledWith('p1', dto);
  });

  it('restock delegates to service', async () => {
    const dto = { quantity: 50 };
    mockInventoryService.restock.mockResolvedValue({ id: 'p1' });
    await controller.restock('p1', dto as any);
    expect(mockInventoryService.restock).toHaveBeenCalledWith('p1', dto);
  });

  it('getMovements delegates to service', async () => {
    mockInventoryService.getStockMovements.mockResolvedValue([]);
    await controller.getMovements('p1');
    expect(mockInventoryService.getStockMovements).toHaveBeenCalledWith('p1');
  });
});
