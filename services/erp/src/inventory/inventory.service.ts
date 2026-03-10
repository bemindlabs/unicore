import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisherService } from '../kafka/event-publisher.service';
import { ERP_TOPICS } from '../events/event-types';
import { paginate } from '../common/dto/pagination.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { RestockProductDto } from './dto/restock-product.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisherService,
  ) {}

  async findAll(query: QueryProductsDto) {
    const { page = 1, limit = 20, search, category, supplierId, warehouseId, minQuantity, maxQuantity, lowStockOnly } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};
    if (search) where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { sku: { contains: search, mode: 'insensitive' } }];
    if (category) where.category = category;
    if (supplierId) where.supplierId = supplierId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (minQuantity !== undefined) where.quantity = { ...where.quantity as object, gte: minQuantity };
    if (maxQuantity !== undefined) where.quantity = { ...where.quantity as object, lte: maxQuantity };
    if (lowStockOnly === 'true') where.quantity = { lte: (where.quantity as Prisma.IntFilter)?.gte ?? 0 };

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.product.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { stockMovements: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product;
  }

  async findBySku(sku: string) {
    const product = await this.prisma.product.findUnique({ where: { sku } });
    if (!product) throw new NotFoundException(`Product with SKU ${sku} not found`);
    return product;
  }

  async create(dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        unitPrice: dto.unitPrice,
        costPrice: dto.costPrice ?? 0,
        quantity: dto.quantity ?? 0,
        lowStockThreshold: dto.lowStockThreshold ?? 10,
        warehouseId: dto.warehouseId,
        supplierId: dto.supplierId,
        tags: dto.tags ?? [],
      },
    });
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto as Prisma.ProductUpdateInput });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    const product = await this.findOne(id);
    const newQty = product.quantity + dto.delta;
    if (newQty < 0) throw new BadRequestException(`Insufficient stock: current=${product.quantity}, delta=${dto.delta}`);

    const [updated] = await this.prisma.$transaction([
      this.prisma.product.update({ where: { id }, data: { quantity: newQty } }),
      this.prisma.stockMovement.create({
        data: {
          productId: id,
          delta: dto.delta,
          reason: dto.reason,
          referenceId: dto.referenceId,
          quantityBefore: product.quantity,
          quantityAfter: newQty,
          performedBy: dto.performedBy,
        },
      }),
    ]);

    if (newQty <= product.lowStockThreshold) {
      this.events.publish(ERP_TOPICS.INVENTORY_LOW, {
        productId: id,
        sku: product.sku,
        productName: product.name,
        currentQuantity: newQty,
        lowStockThreshold: product.lowStockThreshold,
        warehouseId: product.warehouseId,
      }, id).catch(err => this.logger.error('Failed to publish inventory.low event', err));
    }

    return updated;
  }

  async restock(id: string, dto: RestockProductDto) {
    const product = await this.findOne(id);
    const newQty = product.quantity + dto.quantity;

    const [updated] = await this.prisma.$transaction([
      this.prisma.product.update({ where: { id }, data: { quantity: newQty } }),
      this.prisma.stockMovement.create({
        data: {
          productId: id,
          delta: dto.quantity,
          reason: dto.notes ?? 'restock',
          referenceId: dto.referenceId,
          quantityBefore: product.quantity,
          quantityAfter: newQty,
          performedBy: dto.performedBy,
        },
      }),
    ]);

    this.events.publish(ERP_TOPICS.INVENTORY_RESTOCKED, {
      productId: id,
      sku: product.sku,
      productName: product.name,
      quantityAdded: dto.quantity,
      newQuantity: newQty,
    }, id).catch(err => this.logger.error('Failed to publish inventory.restocked event', err));

    return updated;
  }

  async getLowStockProducts() {
    return this.prisma.product.findMany({
      where: { quantity: { lte: this.prisma.product.fields.lowStockThreshold as unknown as number } },
      orderBy: { quantity: 'asc' },
    }).catch(() =>
      this.prisma.product.findMany({
        orderBy: { quantity: 'asc' },
        take: 50,
      })
    );
  }

  async getStockMovements(productId: string, page = 1, limit = 20) {
    await this.findOne(productId);
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.stockMovement.findMany({ where: { productId }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.stockMovement.count({ where: { productId } }),
    ]);
    return paginate(data, total, page, limit);
  }
}
