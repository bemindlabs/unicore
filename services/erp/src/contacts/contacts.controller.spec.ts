import { Test, TestingModule } from '@nestjs/testing';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

const mockContactsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  updateLeadScore: jest.fn(),
  getTopLeads: jest.fn(),
};

describe('ContactsController', () => {
  let controller: ContactsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [{ provide: ContactsService, useValue: mockContactsService }],
    }).compile();
    controller = module.get<ContactsController>(ContactsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(controller).toBeDefined());

  it('create delegates to service', async () => {
    const dto = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' };
    const result = { id: '1', name: 'Jane Doe' };
    mockContactsService.create.mockResolvedValue(result);
    expect(await controller.create(dto as any)).toBe(result);
    expect(mockContactsService.create).toHaveBeenCalledWith(dto);
  });

  it('findAll delegates to service', async () => {
    const query = { page: 1, limit: 20 };
    const result = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    mockContactsService.findAll.mockResolvedValue(result);
    expect(await controller.findAll(query as any)).toBe(result);
    expect(mockContactsService.findAll).toHaveBeenCalledWith(query);
  });

  it('findOne delegates to service', async () => {
    const contact = { id: '1', name: 'Jane Doe' };
    mockContactsService.findOne.mockResolvedValue(contact);
    expect(await controller.findOne('1')).toBe(contact);
    expect(mockContactsService.findOne).toHaveBeenCalledWith('1');
  });

  it('update delegates to service', async () => {
    const dto = { firstName: 'Updated' };
    const updated = { id: '1', name: 'Updated' };
    mockContactsService.update.mockResolvedValue(updated);
    expect(await controller.update('1', dto as any)).toBe(updated);
    expect(mockContactsService.update).toHaveBeenCalledWith('1', dto);
  });

  it('updateLeadScore delegates to service', async () => {
    const updated = { id: '1', leadScore: 80 };
    mockContactsService.updateLeadScore.mockResolvedValue(updated);
    expect(await controller.updateLeadScore('1', 80)).toBe(updated);
    expect(mockContactsService.updateLeadScore).toHaveBeenCalledWith('1', 80);
  });

  it('remove delegates to service', async () => {
    mockContactsService.remove.mockResolvedValue(undefined);
    await controller.remove('1');
    expect(mockContactsService.remove).toHaveBeenCalledWith('1');
  });

  it('getTopLeads delegates to service with defaults', async () => {
    mockContactsService.getTopLeads.mockResolvedValue([]);
    await controller.getTopLeads(50, 20);
    expect(mockContactsService.getTopLeads).toHaveBeenCalledWith(50, 20);
  });
});
