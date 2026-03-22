import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

const mockInvoicesService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  send: jest.fn(),
  recordPayment: jest.fn(),
  cancel: jest.fn(),
  remove: jest.fn(),
  markOverdue: jest.fn(),
};

describe('InvoicesController', () => {
  let controller: InvoicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [{ provide: InvoicesService, useValue: mockInvoicesService }],
    }).compile();
    controller = module.get<InvoicesController>(InvoicesController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create delegates to service', async () => {
    const dto = { contactId: 'c1', lineItems: [] };
    const result = { id: 'inv-1', status: 'DRAFT' };
    mockInvoicesService.create.mockResolvedValue(result);
    expect(await controller.create(dto as any)).toBe(result);
    expect(mockInvoicesService.create).toHaveBeenCalledWith(dto);
  });

  it('markOverdue delegates to service', async () => {
    mockInvoicesService.markOverdue.mockResolvedValue({ updated: 2 });
    const result = await controller.markOverdue();
    expect(result).toEqual({ updated: 2 });
    expect(mockInvoicesService.markOverdue).toHaveBeenCalled();
  });

  it('findAll delegates to service', async () => {
    const query = { page: 1, limit: 20 };
    mockInvoicesService.findAll.mockResolvedValue({ data: [], meta: {} });
    await controller.findAll(query as any);
    expect(mockInvoicesService.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delegates to service', async () => {
    const invoice = { id: 'inv-1', status: 'DRAFT' };
    mockInvoicesService.findOne.mockResolvedValue(invoice);
    expect(await controller.findOne('inv-1')).toBe(invoice);
    expect(mockInvoicesService.findOne).toHaveBeenCalledWith('inv-1');
  });

  it('update delegates to service', async () => {
    const dto = { notes: 'Updated' };
    mockInvoicesService.update.mockResolvedValue({ id: 'inv-1' });
    await controller.update('inv-1', dto as any);
    expect(mockInvoicesService.update).toHaveBeenCalledWith('inv-1', dto);
  });

  it('send delegates to service', async () => {
    mockInvoicesService.send.mockResolvedValue({ id: 'inv-1', status: 'SENT' });
    await controller.send('inv-1');
    expect(mockInvoicesService.send).toHaveBeenCalledWith('inv-1');
  });

  it('recordPayment delegates to service', async () => {
    const dto = { amount: 100, method: 'CASH' };
    mockInvoicesService.recordPayment.mockResolvedValue({ id: 'inv-1' });
    await controller.recordPayment('inv-1', dto as any);
    expect(mockInvoicesService.recordPayment).toHaveBeenCalledWith('inv-1', dto);
  });

  it('cancel delegates to service', async () => {
    mockInvoicesService.cancel.mockResolvedValue({ id: 'inv-1', status: 'VOID' });
    await controller.cancel('inv-1');
    expect(mockInvoicesService.cancel).toHaveBeenCalledWith('inv-1');
  });

  it('remove delegates to service', async () => {
    mockInvoicesService.remove.mockResolvedValue(undefined);
    await controller.remove('inv-1');
    expect(mockInvoicesService.remove).toHaveBeenCalledWith('inv-1');
  });
});
