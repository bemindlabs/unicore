import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

const mockExpensesService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  reimburse: jest.fn(),
  uploadReceipt: jest.fn(),
};

describe('ExpensesController', () => {
  let controller: ExpensesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [{ provide: ExpensesService, useValue: mockExpensesService }],
    }).compile();
    controller = module.get<ExpensesController>(ExpensesController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create delegates to service', async () => {
    const dto = { title: 'Office Supplies', category: 'OFFICE_SUPPLIES', amount: 50 };
    const result = { id: 'exp-1', status: 'DRAFT' };
    mockExpensesService.create.mockResolvedValue(result);
    expect(await controller.create(dto as any)).toBe(result);
    expect(mockExpensesService.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delegates to service', async () => {
    const query = { page: 1, limit: 20 };
    mockExpensesService.findAll.mockResolvedValue({ data: [], meta: {} });
    await controller.findAll(query as any);
    expect(mockExpensesService.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delegates to service', async () => {
    const expense = { id: 'exp-1', status: 'DRAFT' };
    mockExpensesService.findOne.mockResolvedValue(expense);
    expect(await controller.findOne('exp-1')).toBe(expense);
    expect(mockExpensesService.findOne).toHaveBeenCalledWith('exp-1');
  });

  it('update delegates to service', async () => {
    const dto = { title: 'Updated' };
    mockExpensesService.update.mockResolvedValue({ id: 'exp-1' });
    await controller.update('exp-1', dto as any);
    expect(mockExpensesService.update).toHaveBeenCalledWith('exp-1', dto);
  });

  it('remove delegates to service', async () => {
    mockExpensesService.remove.mockResolvedValue(undefined);
    await controller.remove('exp-1');
    expect(mockExpensesService.remove).toHaveBeenCalledWith('exp-1');
  });

  it('approve delegates to service', async () => {
    const dto = { approvedBy: 'manager-1' };
    mockExpensesService.approve.mockResolvedValue({ id: 'exp-1', status: 'APPROVED' });
    await controller.approve('exp-1', dto as any);
    expect(mockExpensesService.approve).toHaveBeenCalledWith('exp-1', dto);
  });

  it('reject delegates to service', async () => {
    const dto = { approvedBy: 'manager-1', reason: 'No receipt' };
    mockExpensesService.reject.mockResolvedValue({ id: 'exp-1', status: 'REJECTED' });
    await controller.reject('exp-1', dto as any);
    expect(mockExpensesService.reject).toHaveBeenCalledWith('exp-1', dto);
  });

  it('reimburse delegates to service', async () => {
    mockExpensesService.reimburse.mockResolvedValue({ id: 'exp-1', status: 'REIMBURSED' });
    await controller.reimburse('exp-1');
    expect(mockExpensesService.reimburse).toHaveBeenCalledWith('exp-1');
  });

  it('uploadReceipt throws BadRequestException when no file provided', async () => {
    await expect(controller.uploadReceipt('exp-1', undefined as any))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(mockExpensesService.uploadReceipt).not.toHaveBeenCalled();
  });

  it('uploadReceipt delegates to service when file provided', async () => {
    const file = { originalname: 'receipt.pdf' } as Express.Multer.File;
    mockExpensesService.uploadReceipt.mockResolvedValue({ id: 'exp-1', receiptUrl: '/uploads/receipts/exp-1/receipt.pdf' });
    const result = await controller.uploadReceipt('exp-1', file);
    expect(mockExpensesService.uploadReceipt).toHaveBeenCalledWith('exp-1', '/uploads/receipts/exp-1/receipt.pdf');
    expect(result).toEqual(expect.objectContaining({ receiptUrl: '/uploads/receipts/exp-1/receipt.pdf' }));
  });
});
