import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe,
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
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto) { return this.ordersService.create(dto); }

  @Get()
  findAll(@Query() query: QueryOrdersDto) { return this.ordersService.findAll(query); }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.ordersService.findOne(id); }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrderDto) {
    return this.ordersService.update(id, dto);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Param('id', ParseUUIDPipe) id: string) { return this.ordersService.confirm(id); }

  @Post(':id/process')
  @HttpCode(HttpStatus.OK)
  startProcessing(@Param('id', ParseUUIDPipe) id: string) { return this.ordersService.startProcessing(id); }

  @Post(':id/ship')
  @HttpCode(HttpStatus.OK)
  ship(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ShipOrderDto) {
    return this.ordersService.ship(id, dto);
  }

  @Post(':id/fulfill')
  @HttpCode(HttpStatus.OK)
  fulfill(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FulfillOrderDto) {
    return this.ordersService.fulfill(id, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelOrderDto) {
    return this.ordersService.cancel(id, dto);
  }

  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  refund(@Param('id', ParseUUIDPipe) id: string) { return this.ordersService.refund(id); }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  softCancel(@Param('id', ParseUUIDPipe) id: string) { return this.ordersService.cancel(id, {}); }
}
