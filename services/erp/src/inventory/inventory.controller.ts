import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { RestockProductDto } from './dto/restock-product.dto';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  create(@Body() dto: CreateProductDto) { return this.inventoryService.create(dto); }

  @Get()
  findAll(@Query() query: QueryProductsDto) { return this.inventoryService.findAll(query); }

  @Get('low-stock')
  getLowStock() { return this.inventoryService.getLowStockProducts(); }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.inventoryService.findOne(id); }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.inventoryService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.inventoryService.remove(id); }

  @Post(':id/adjust-stock')
  @HttpCode(HttpStatus.OK)
  adjustStock(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdjustStockDto) {
    return this.inventoryService.adjustStock(id, dto);
  }

  @Post(':id/restock')
  @HttpCode(HttpStatus.OK)
  restock(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RestockProductDto) {
    return this.inventoryService.restock(id, dto);
  }

  @Get(':id/movements')
  getMovements(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.getStockMovements(id);
  }
}
