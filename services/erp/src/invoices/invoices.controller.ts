import {
  Controller, Get, Post, Patch, Body, Param, Query,
  HttpCode, HttpStatus, ParseUUIDPipe,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { QueryInvoicesDto } from './dto/query-invoices.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

@Controller('erp/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  create(@Body() dto: CreateInvoiceDto) { return this.invoicesService.create(dto); }

  @Get()
  findAll(@Query() query: QueryInvoicesDto) { return this.invoicesService.findAll(query); }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.invoicesService.findOne(id); }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoicesService.update(id, dto);
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  send(@Param('id', ParseUUIDPipe) id: string) { return this.invoicesService.send(id); }

  @Post(':id/payments')
  @HttpCode(HttpStatus.OK)
  recordPayment(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordPaymentDto) {
    return this.invoicesService.recordPayment(id, dto);
  }

  @Post(':id/overdue')
  @HttpCode(HttpStatus.OK)
  markOverdue(@Param('id', ParseUUIDPipe) id: string) { return this.invoicesService.markOverdue(id); }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseUUIDPipe) id: string) { return this.invoicesService.cancel(id); }
}
