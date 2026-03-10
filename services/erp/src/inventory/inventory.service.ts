import {
  Injectable, NotFoundException, ConflictException, BadRequestException, Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { ERP_TOPICS } from '../events/event-types';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { RestockProductDto } from './dto/restock-product.dto';
import { paginate, PaginatedResult } from '../common/dto/pagination.dto';

type ProductRecord = Prisma.ProductGetPayload<Record<string, never>>;
type StockMovementRecord = Prisma.StockMovementGetPayload<Record<string, never>>;

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async create(dto: CreateProductDto): Promise<ProductRecord> {
    const existing = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (existing) throw new ConflictException(`Product with SKU ${dto.sku} already exists`);
    const product = await this.prisma.product.create({
      data: {
        sku: dto.sku, name: dto.name, description: dto.description,
        category: dto.category, unitPrice: dto.unitPrice,
        costPrice: dto.costPrice ?? 0, quantity: dto.quantity ?? 0,
        reservedQuantity: dto.reservedQuantity ?? 0,
        lowStockThreshold: dto.lowStockThreshold ?? 10,
        warehouseId: dto.warehouseId, supplierId: dto.supplierId,
        tags: dto.tags ?? [],
      },
    });
    this.logger.log(`Product created: ${product.sku}`);
    return product;
  }

  async findAll(query: QueryProductsDto): Promise<PaginatedResult<ProductRecord>> {
    const { page = 1, limit = 20, search, category } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.ProductWhereInput = {
      ...(category && { category }),
      ...(search && {
        OR: [
          { sku: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { category: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, skip, take: limit, orderBy: { name: 'asc' } }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(data, total, page, limit);
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
        ...(dto.lowStockThreshold !== undefined && { lowStockThreshold: dto.lowStockThreshold }),
        ...(dto.warehouseId !== undefined && { warehouseId: dto.warehouseId }),
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
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
    const newQty = product.quantity + dto.delta;
    if (newQty < 0) {
      throw new BadRequestException(`Stock adjustment would result in negative quantity for ${product.sku}`);
    }
    await this.prisma.stockMovement.create({
      data: {
        productId: id, delta: dto.delta, reason: dto.reason,
        referenceId: dto.referenceId,
        quantityBefore: product.quantity, quantityAfter: newQty,
        performedBy: dto.performedBy,
      },
    });
    const updated = await this.prisma.product.update({ where: { id }, data: { quantity: newQty } });
    if (newQty <= product.lowStockThreshold && dto.delta < 0) {
      this.eventPublisher.publish(ERP_TOPICS.INVENTORY_LOW, {
        productId: id, productName: product.name, sku: product.sku,
        currentQuantity: newQty, threshold: product.lowStockThreshold,
        warehouseId: product.warehouseId ?? undefined,
        supplierId: product.supplierId ?? undefined,
      }, id).catch((err: unknown) => this.logger.error('Failed to publish inventory.low', err));
    }
    return updated;
  }

  async restock(id: string, dto: RestockProductDto): Promise<ProductRecord> {
    const product = await this.findOne(id);
    const newQty = product.quantity + dto.quantity;
    await this.prisma.stockMovement.create({
      data: {
        productId: id, delta: dto.quantity, reason: 'manual_restock',
        referenceId: dto.purchaseOrderId,
        quantityBefore: product.quantity, quantityAfter: newQty,
        performedBy: dto.performedBy,
      },
    });
    const updated = await this.prisma.product.update({ where: { id }, data: { quantity: newQty } });
    this.eventPublisher.publish(ERP_TOPICS.INVENTORY_RESTOCKED, {
      productId: id, productName: product.name, sku: product.sku,
      previousQuantity: product.quantity, quantityAdded: dto.quantity, newQuantity: newQty,
      warehouseId: product.warehouseId ?? undefined,
      purchaseOrderId: dto.purchaseOrderId,
    }, id).catch((err: unknown) => this.logger.error('Failed to publish inventory.restocked', err));
    this.logger.log(`Product restocked: ${product.sku} +${dto.quantity}`);
    return updated;
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
    return this.prisma.$queryRaw<ProductRecord[]>`
      SELECT * FROM "Product"
      WHERE quantity <= "lowStockThreshold"
      ORDER BY quantity ASC
    `;
  }
}
