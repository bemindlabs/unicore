import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from '../src/inventory/inventory.service';
import { EventPublisherService } from '../src/kafka/event-publisher.service';
import { ERP_TOPICS } from '../src/events/event-types';
import type { InventoryLowEventDto, InventoryRestockedEventDto } from '../src/events/dto';

const mockPublisher = {
  publish: jest.fn().mockResolvedValue(undefined),
};

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: EventPublisherService, useValue: mockPublisher },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('notifyLowStock()', () => {
    const dto: InventoryLowEventDto = {
      productId: 'prod-001',
      productName: 'Widget',
      sku: 'WGT-001',
      currentQuantity: 3,
      threshold: 10,
    };

    it('publishes inventory.low event with productId as key', async () => {
      await service.notifyLowStock(dto);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        ERP_TOPICS.INVENTORY_LOW,
        dto,
        'prod-001',
      );
    });
  });

  describe('notifyRestocked()', () => {
    const dto: InventoryRestockedEventDto = {
      productId: 'prod-001',
      productName: 'Widget',
      sku: 'WGT-001',
      previousQuantity: 3,
      quantityAdded: 100,
      newQuantity: 103,
    };

    it('publishes inventory.restocked event with productId as key', async () => {
      await service.notifyRestocked(dto);

      expect(mockPublisher.publish).toHaveBeenCalledWith(
        ERP_TOPICS.INVENTORY_RESTOCKED,
        dto,
        'prod-001',
      );
    });
  });
});
