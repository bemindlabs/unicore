import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

const mockOrdersService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  confirm: jest.fn(),
  startProcessing: jest.fn(),
  ship: jest.fn(),
  fulfill: jest.fn(),
  cancel: jest.fn(),
  deliver: jest.fn(),
  refund: jest.fn(),
};

describe('OrdersController', () => {
  let controller: OrdersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: mockOrdersService }],
    }).compile();
    controller = module.get<OrdersController>(OrdersController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create delegates to service', async () => {
    const dto = { contactId: 'c1', lineItems: [] };
    const result = { id: 'ord-1', status: 'DRAFT' };
    mockOrdersService.create.mockResolvedValue(result);
    expect(await controller.create(dto as any)).toBe(result);
    expect(mockOrdersService.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delegates to service', async () => {
    const query = { page: 1, limit: 20 };
    mockOrdersService.findAll.mockResolvedValue({ data: [], meta: {} });
    await controller.findAll(query as any);
    expect(mockOrdersService.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delegates to service', async () => {
    const order = { id: 'ord-1', status: 'DRAFT' };
    mockOrdersService.findOne.mockResolvedValue(order);
    expect(await controller.findOne('ord-1')).toBe(order);
    expect(mockOrdersService.findOne).toHaveBeenCalledWith('ord-1');
  });

  it('update delegates to service', async () => {
    const dto = { notes: 'Updated' };
    mockOrdersService.update.mockResolvedValue({ id: 'ord-1' });
    await controller.update('ord-1', dto as any);
    expect(mockOrdersService.update).toHaveBeenCalledWith('ord-1', dto);
  });

  it('confirm delegates to service', async () => {
    mockOrdersService.confirm.mockResolvedValue({ id: 'ord-1', status: 'CONFIRMED' });
    await controller.confirm('ord-1');
    expect(mockOrdersService.confirm).toHaveBeenCalledWith('ord-1');
  });

  it('startProcessing delegates to service', async () => {
    mockOrdersService.startProcessing.mockResolvedValue({ id: 'ord-1', status: 'PROCESSING' });
    await controller.startProcessing('ord-1');
    expect(mockOrdersService.startProcessing).toHaveBeenCalledWith('ord-1');
  });

  it('ship delegates to service', async () => {
    const dto = { trackingNumber: 'TRK123', carrier: 'DHL' };
    mockOrdersService.ship.mockResolvedValue({ id: 'ord-1', status: 'SHIPPED' });
    await controller.ship('ord-1', dto as any);
    expect(mockOrdersService.ship).toHaveBeenCalledWith('ord-1', dto);
  });

  it('fulfill delegates to service', async () => {
    const dto = { carrier: 'FedEx' };
    mockOrdersService.fulfill.mockResolvedValue({ id: 'ord-1', status: 'FULFILLED' });
    await controller.fulfill('ord-1', dto as any);
    expect(mockOrdersService.fulfill).toHaveBeenCalledWith('ord-1', dto);
  });

  it('cancel delegates to service', async () => {
    const dto = { reason: 'Customer request' };
    mockOrdersService.cancel.mockResolvedValue({ id: 'ord-1', status: 'CANCELLED' });
    await controller.cancel('ord-1', dto as any);
    expect(mockOrdersService.cancel).toHaveBeenCalledWith('ord-1', dto);
  });

  it('deliver delegates to service', async () => {
    mockOrdersService.deliver.mockResolvedValue({ id: 'ord-1', status: 'DELIVERED' });
    await controller.deliver('ord-1');
    expect(mockOrdersService.deliver).toHaveBeenCalledWith('ord-1');
  });

  it('refund delegates to service', async () => {
    mockOrdersService.refund.mockResolvedValue({ id: 'ord-1', status: 'REFUNDED' });
    await controller.refund('ord-1');
    expect(mockOrdersService.refund).toHaveBeenCalledWith('ord-1');
  });

  it('softCancel delegates to service.cancel with empty dto', async () => {
    mockOrdersService.cancel.mockResolvedValue({ id: 'ord-1', status: 'CANCELLED' });
    await controller.softCancel('ord-1');
    expect(mockOrdersService.cancel).toHaveBeenCalledWith('ord-1', {});
  });
});
