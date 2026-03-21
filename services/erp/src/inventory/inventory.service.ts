import {
  Injectable, NotFoundException, ConflictException, BadRequestException, Logger,
} from '@nestjs/common';
import { Product, StockMovement } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { ERP_TOPICS } from '../events/event-types';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { RestockProductDto } from './dto/restock-product.dto';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';

type ProductRecord = Product;
type StockMovementRecord = StockMovement;

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async create(dto: CreateProductDto): Promise<ProductRecord & { quantity?: number }> {
    const existing = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (existing) throw new ConflictException(`Product with SKU ${dto.sku} already exists`);
    const product = await this.prisma.product.create({
      data: {
        sku: dto.sku, name: dto.name, description: dto.description,
        category: dto.category, unitPrice: dto.unitPrice,
        costPrice: dto.costPrice ?? 0,
        tags: dto.tags ?? [],
      },
    });

    // Auto-create inventory item when quantity is provided
    const qty = dto.quantity ?? 0;
    if (qty > 0) {
      const warehouse = await this.getOrCreateDefaultWarehouse();
      await this.prisma.inventoryItem.create({
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          quantityOnHand: qty,
          quantityReserved: dto.reservedQuantity ?? 0,
          quantityAvailable: qty - (dto.reservedQuantity ?? 0),
          reorderPoint: dto.lowStockThreshold ?? 10,
          reorderQty: dto.lowStockThreshold ? dto.lowStockThreshold * 2 : 20,
        },
      });
    }

    this.logger.log(`Product created: ${product.sku}${qty > 0 ? ` (qty: ${qty})` : ''}`);
    return { ...product, quantity: qty } as any;
  }

  private async getOrCreateDefaultWarehouse() {
    let warehouse = await this.prisma.warehouse.findFirst({ where: { isDefault: true } });
    if (!warehouse) {
      warehouse = await this.prisma.warehouse.create({
        data: { name: 'Main Warehouse', code: 'MAIN', isDefault: true, status: 'ACTIVE' },
      });
      this.logger.log('Created default warehouse: MAIN');
    }
    return warehouse;
  }

  async findAll(query: QueryProductsDto): Promise<PaginatedResult<ProductRecord>> {
    const { page = 1, limit = 20, search, category } = query;
    const skip = (page - 1) * limit;
    const where = {
      ...(category && { category }),
      ...(search && {
        OR: [
          { sku: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
          { category: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where, skip, take: limit, orderBy: { name: 'asc' },
        include: { inventoryItems: { select: { quantityOnHand: true, quantityReserved: true, quantityAvailable: true, reorderPoint: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);
    // Flatten inventory data onto product for frontend convenience
    const enriched = data.map((p: any) => {
      const inv = p.inventoryItems?.[0];
      return {
        ...p,
        quantity: inv?.quantityOnHand ?? 0,
        reservedQuantity: inv?.quantityReserved ?? 0,
        availableQuantity: inv?.quantityAvailable ?? 0,
        lowStockThreshold: inv?.reorderPoint ?? 10,
        inventoryItems: undefined,
      };
    });
    return paginate(enriched, total, page, limit);
  }

  async findOne(id: string): Promise<ProductRecord> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async findBySku(sku: string): Promise<ProductRecord> {
    const product = await this.prisma.product.findUnique({ where: { sku } });
    if (!product) throw new NotFoundException(`Product with SKU ${sku} not found`);
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductRecord> {
    await this.findOne(id);
    if (dto.sku) {
      const existing = await this.prisma.product.findFirst({ where: { sku: dto.sku, NOT: { id } } });
      if (existing) throw new ConflictException(`Product with SKU ${dto.sku} already exists`);
    }
    return this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.sku !== undefined && { sku: dto.sku }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.unitPrice !== undefined && { unitPrice: dto.unitPrice }),
        ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
      },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
    this.logger.log(`Product deleted: ${id}`);
  }

  async adjustStock(id: string, dto: AdjustStockDto): Promise<ProductRecord> {
    const product = await this.findOne(id);
    // Find the first inventory item for this product
    const inventoryItem = await this.prisma.inventoryItem.findFirst({ where: { productId: id } });
    if (!inventoryItem) {
      throw new BadRequestException(`No inventory record found for product ${product.sku}`);
    }
    const newQty = inventoryItem.quantityOnHand + dto.delta;
    if (newQty < 0) {
      throw new BadRequestException(`Stock adjustment would result in negative quantity for ${product.sku}`);
    }
    const movementType = dto.delta >= 0 ? 'ADJUSTMENT_ADD' as const : 'ADJUSTMENT_REMOVE' as const;
    await this.prisma.stockMovement.create({
      data: {
        productId: id, warehouseId: inventoryItem.warehouseId,
        type: movementType,
        quantity: dto.delta,
        balanceAfter: newQty,
        note: dto.reason,
        referenceId: dto.referenceId,
        createdById: dto.performedBy ?? '00000000-0000-0000-0000-000000000000',
      },
    });
    await this.prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { quantityOnHand: newQty, quantityAvailable: newQty - inventoryItem.quantityReserved },
    });
    if (newQty <= inventoryItem.reorderPoint && dto.delta < 0) {
      this.eventPublisher.publish(ERP_TOPICS.INVENTORY_LOW, {
        productId: id, productName: product.name, sku: product.sku,
        currentQuantity: newQty, threshold: inventoryItem.reorderPoint,
        warehouseId: inventoryItem.warehouseId,
      }, id).catch((err: unknown) => this.logger.error('Failed to publish inventory.low', err));
    }
    return product;
  }

  async restock(id: string, dto: RestockProductDto): Promise<ProductRecord> {
    const product = await this.findOne(id);
    const inventoryItem = await this.prisma.inventoryItem.findFirst({ where: { productId: id } });
    if (!inventoryItem) {
      throw new BadRequestException(`No inventory record found for product ${product.sku}`);
    }
    const newQty = inventoryItem.quantityOnHand + dto.quantity;
    await this.prisma.stockMovement.create({
      data: {
        productId: id, warehouseId: inventoryItem.warehouseId,
        type: 'PURCHASE',
        quantity: dto.quantity,
        balanceAfter: newQty,
        note: 'manual_restock',
        referenceId: dto.purchaseOrderId,
        createdById: dto.performedBy ?? '00000000-0000-0000-0000-000000000000',
      },
    });
    await this.prisma.inventoryItem.update({
      where: { id: inventoryItem.id },
      data: { quantityOnHand: newQty, quantityAvailable: newQty - inventoryItem.quantityReserved },
    });
    this.eventPublisher.publish(ERP_TOPICS.INVENTORY_RESTOCKED, {
      productId: id, productName: product.name, sku: product.sku,
      previousQuantity: inventoryItem.quantityOnHand, quantityAdded: dto.quantity, newQuantity: newQty,
      warehouseId: inventoryItem.warehouseId,
      purchaseOrderId: dto.purchaseOrderId,
    }, id).catch((err: unknown) => this.logger.error('Failed to publish inventory.restocked', err));
    this.logger.log(`Product restocked: ${product.sku} +${dto.quantity}`);
    return product;
  }

  async getStockMovements(productId: string, limit = 50): Promise<StockMovementRecord[]> {
    await this.findOne(productId);
    return this.prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getLowStockProducts(): Promise<ProductRecord[]> {
    // Use the PostgreSQL view for accurate low-stock detection (compares quantityAvailable <= reorderPoint)
    const alerts = await this.prisma.$queryRaw<Array<{ sku: string }>>`
      SELECT DISTINCT sku FROM "v_low_stock_alert"
    `.catch(() => [] as Array<{ sku: string }>);

    if (alerts.length > 0) {
      return this.prisma.product.findMany({
        where: { sku: { in: alerts.map(a => a.sku) } },
        orderBy: { name: 'asc' },
      });
    }

    // Fallback: raw query to compare columns within the same row
    const lowStockItems = await this.prisma.$queryRaw<Array<{ product_id: string }>>`
      SELECT DISTINCT "productId" as product_id
      FROM "InventoryItem"
      WHERE "quantityAvailable" <= "reorderPoint"
    `.catch(() => [] as Array<{ product_id: string }>);

    if (lowStockItems.length > 0) {
      return this.prisma.product.findMany({
        where: { id: { in: lowStockItems.map(item => item.product_id) } },
        orderBy: { name: 'asc' },
      });
    }

    return [];
  }
}
