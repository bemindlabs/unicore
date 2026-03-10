import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  ParseUUIDPipe, HttpCode, HttpStatus, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { ApproveExpenseDto } from './dto/approve-expense.dto';
import { RejectExpenseDto } from './dto/reject-expense.dto';

@Controller('erp/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(@Query() query: QueryExpensesDto) {
    return this.expensesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.expensesService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateExpenseDto) {
    return this.expensesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExpenseDto) {
    return this.expensesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.expensesService.remove(id);
  }

  @Post(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveExpenseDto) {
    return this.expensesService.approve(id, dto);
  }

  @Post(':id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectExpenseDto) {
    return this.expensesService.reject(id, dto);
  }

  @Post(':id/reimburse')
  reimburse(@Param('id', ParseUUIDPipe) id: string) {
    return this.expensesService.reimburse(id);
  }

  @Post(':id/receipt')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.expensesService.uploadReceipt(id, file);
  }
}
