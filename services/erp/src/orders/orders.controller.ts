import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { FulfillOrderDto } from './dto/fulfill-order.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';

@Controller('erp/orders')
export class OrdersController {
  constructor(private readonly svc: OrdersService) {}
  @Post() create(@Body() dto: CreateOrderDto) { return this.svc.create(dto); }
  @Get() findAll(@Query() q: QueryOrdersDto) { return this.svc.findAll(q); }
  @Get(':id') findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }
  @Patch(':id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrderDto) { return this.svc.update(id, dto); }
  @Post(':id/confirm') @HttpCode(HttpStatus.OK) confirm(@Param('id', ParseUUIDPipe) id: string) { return this.svc.confirm(id); }
  @Post(':id/process') @HttpCode(HttpStatus.OK) process(@Param('id', ParseUUIDPipe) id: string) { return this.svc.startProcessing(id); }
  @Post(':id/ship') @HttpCode(HttpStatus.OK) ship(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ShipOrderDto) { return this.svc.ship(id, dto); }
  @Post(':id/fulfill') @HttpCode(HttpStatus.OK) fulfill(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FulfillOrderDto) { return this.svc.fulfill(id, dto); }
  @Post(':id/cancel') @HttpCode(HttpStatus.OK) cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelOrderDto) { return this.svc.cancel(id, dto); }
  @Post(':id/refund') @HttpCode(HttpStatus.OK) refund(@Param('id', ParseUUIDPipe) id: string) { return this.svc.refund(id); }
  @Delete(':id') @HttpCode(HttpStatus.OK) delete(@Param('id', ParseUUIDPipe) id: string) { return this.svc.cancel(id, {}); }
}
