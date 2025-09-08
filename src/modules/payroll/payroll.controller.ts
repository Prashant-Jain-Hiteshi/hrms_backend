import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { Payroll } from './payroll.model';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/user-role.enum';

@ApiTags('payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Create a new payroll record' })
  @ApiResponse({ status: 201, description: 'The payroll record has been successfully created.', type: Payroll })
  create(@Body() createPayrollDto: CreatePayrollDto) {
    return this.payrollService.create(createPayrollDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all payroll records with pagination' })
  @ApiResponse({ status: 200, description: 'Return all payroll records.' })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.payrollService.findAll(
      Number(page),
      Number(limit),
      search,
      status as any,
      month,
      year,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a payroll record by ID' })
  @ApiResponse({ status: 200, description: 'Return the payroll record.', type: Payroll })
  findOne(@Param('id') id: string) {
    return this.payrollService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Update a payroll record' })
  @ApiResponse({ status: 200, description: 'The payroll record has been successfully updated.', type: Payroll })
  update(@Param('id') id: string, @Body() updatePayrollDto: UpdatePayrollDto) {
    return this.payrollService.update(id, updatePayrollDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Delete a payroll record' })
  @ApiResponse({ status: 200, description: 'The payroll record has been successfully deleted.' })
  remove(@Param('id') id: string) {
    return this.payrollService.remove(id);
  }

  @Post('process')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Process payroll for multiple employees' })
  @ApiResponse({ status: 201, description: 'Payroll processed successfully.', type: [Payroll] })
  processPayroll(
    @Body() body: { employeeIds: string[]; periodStart: string; periodEnd: string },
  ) {
    return this.payrollService.processPayroll(
      body.employeeIds,
      new Date(body.periodStart),
      new Date(body.periodEnd),
    );
  }
}
