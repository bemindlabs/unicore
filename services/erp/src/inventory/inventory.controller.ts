import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { RestockProductDto } from './dto/restock-product.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('erp/products')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(@Query() query: QueryProductsDto) {
    return this.inventoryService.findAll(query);
  }

  @Get('low-stock')
  getLowStock() {
    return this.inventoryService.getLowStockProducts();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findOne(id);
  }

  @Get('sku/:sku')
  findBySku(@Param('sku') sku: string) {
    return this.inventoryService.findBySku(sku);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.inventoryService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.inventoryService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.remove(id);
  }

  @Post(':id/adjust')
  adjustStock(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(id, dto);
  }

  @Post(':id/restock')
  restock(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RestockProductDto) {
    return this.inventoryService.restock(id, dto);
  }

  @Get(':id/movements')
  getMovements(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.inventoryService.getStockMovements(id, query.page, query.limit);
  }
}
