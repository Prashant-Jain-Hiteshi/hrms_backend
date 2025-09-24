import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Put,
  Patch,
  Delete,
  Request,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { Payroll } from './payroll.model';
import {
  ProcessDynamicPayrollDto,
  PayrollCalculationDto,
  PayrollCalculationResponseDto,
} from './dto/dynamic-payroll.dto';
import { CalculatePayrollBatchDto, AdjustPayrollDto, BulkApprovePayrollDto } from './dto/hr-payroll.dto';
import { HRPayrollCalculationService } from './services/hr-payroll-calculation.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { UserRole } from '../users/user-role.enum';

@ApiTags('payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payroll')
export class PayrollController {
  constructor(
    private readonly payrollService: PayrollService,
    private readonly hrPayrollService: HRPayrollCalculationService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Create a new payroll record' })
  @ApiResponse({
    status: 201,
    description: 'The payroll record has been successfully created.',
    type: Payroll,
  })
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
  @ApiResponse({
    status: 200,
    description: 'Return the payroll record.',
    type: Payroll,
  })
  findOne(@Param('id') id: string) {
    return this.payrollService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Update a payroll record' })
  @ApiResponse({
    status: 200,
    description: 'The payroll record has been successfully updated.',
    type: Payroll,
  })
  update(@Param('id') id: string, @Body() updatePayrollDto: UpdatePayrollDto) {
    return this.payrollService.update(id, updatePayrollDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Delete a payroll record' })
  @ApiResponse({
    status: 200,
    description: 'The payroll record has been successfully deleted.',
  })
  remove(@Param('id') id: string) {
    return this.payrollService.remove(id);
  }

  @Post('process')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Process payroll for multiple employees' })
  @ApiResponse({
    status: 201,
    description: 'Payroll processed successfully.',
    type: [Payroll],
  })
  processPayroll(
    @Body()
    body: {
      employeeIds: string[];
      periodStart: string;
      periodEnd: string;
    },
  ) {
    return this.payrollService.processPayroll(
      body.employeeIds,
      new Date(body.periodStart),
      new Date(body.periodEnd),
    );
  }

  // Dynamic payroll calculation endpoints
  @Post('calculate')
  @ApiOperation({
    summary: 'Calculate payroll for a single employee (real-time)',
  })
  @ApiResponse({
    status: 200,
    description: 'Payroll calculation completed.',
    type: PayrollCalculationResponseDto,
  })
  calculateEmployeePayroll(@Body() dto: PayrollCalculationDto) {
    return this.payrollService.calculatePayrollForEmployee(dto);
  }

  @Post('preview')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Preview payroll calculations before processing' })
  @ApiResponse({
    status: 200,
    description: 'Payroll preview generated.',
    type: [PayrollCalculationResponseDto],
  })
  previewPayroll(@Body() dto: ProcessDynamicPayrollDto) {
    return this.payrollService.getPayrollPreview(dto);
  }

  @Post('process-dynamic')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Process dynamic payroll with attendance and leave integration',
  })
  @ApiResponse({
    status: 201,
    description: 'Dynamic payroll processed successfully.',
    type: [Payroll],
  })
  processDynamicPayroll(@Body() dto: ProcessDynamicPayrollDto) {
    return this.payrollService.processDynamicPayroll(dto);
  }

  @Get('employee/:employeeId/history')
  @ApiOperation({ summary: 'Get payroll history for an employee' })
  @ApiResponse({
    status: 200,
    description: 'Employee payroll history retrieved.',
    type: [Payroll],
  })
  getEmployeePayrollHistory(
    @Param('employeeId') employeeId: string,
    @Query('limit') limit = 12,
  ) {
    return this.payrollService.getEmployeePayrollHistory(
      employeeId,
      Number(limit),
    );
  }

  @Get('summary')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get payroll summary for a period' })
  @ApiResponse({
    status: 200,
    description: 'Payroll summary retrieved.',
  })
  getPayrollSummary(
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    return this.payrollService.getPayrollSummary(periodStart, periodEnd);
  }

  // HR Payroll Management Endpoints
  @Post('hr/calculate-batch')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Calculate payroll for multiple employees' })
  @ApiResponse({
    status: 201,
    description: 'Payroll calculated successfully for batch of employees.',
  })
  async calculatePayrollBatch(
    @Body() calculateDto: CalculatePayrollBatchDto,
    @TenantId() tenantId: string,
    @Req() request: any,
  ) {
    console.log('🔍 DEBUG - Calculate Payroll Batch Request:', {
      calculateDto,
      tenantId,
      user: request.user,
    });
    
    // Get current user ID from JWT token
    const calculatedBy = request.user?.id || request.user?.userId;
    
    if (!calculatedBy) {
      throw new Error('Unable to determine user ID from JWT token');
    }
    
    console.log('🔍 DEBUG - Using calculatedBy from JWT:', calculatedBy);
    
    const result = await this.hrPayrollService.calculatePayrollBatch({
      ...calculateDto,
      calculatedBy,
      tenantId,
    });
    
    console.log('🔍 DEBUG - Calculate Payroll Batch Result:', result);
    
    return result;
  }

  @Get('hr/records/:month')
  @Roles(UserRole.HR, UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get payroll records for a specific month' })
  @ApiResponse({
    status: 200,
    description: 'Payroll records retrieved successfully.',
  })
  async getPayrollRecords(
    @Param('month') month: string,
    @TenantId() tenantId: string,
  ) {
    return this.hrPayrollService.getPayrollRecords(month, tenantId);
  }

  @Get('hr/summary/:month')
  @Roles(UserRole.HR, UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get payroll summary for a specific month' })
  @ApiResponse({
    status: 200,
    description: 'Payroll summary retrieved successfully.',
  })
  async getPayrollSummaryByMonth(
    @Param('month') month: string,
    @TenantId() tenantId: string,
  ) {
    return this.hrPayrollService.getPayrollSummary(month, tenantId);
  }

  @Put('hr/adjust/:recordId')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Adjust individual payroll record' })
  @ApiResponse({
    status: 200,
    description: 'Payroll record adjusted successfully.',
  })
  async adjustPayroll(
    @Param('recordId') recordId: string,
    @Body() adjustDto: AdjustPayrollDto,
    @TenantId() tenantId: string,
  ) {
    console.log('🔧 DEBUG - Adjust Payroll Request:', {
      recordId,
      adjustDto,
      tenantId,
    });
    
    return await this.hrPayrollService.adjustPayroll(recordId, adjustDto, tenantId);
  }

  @Get('hr/eligible-employees/:month')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get employees eligible for payroll calculation for specific month' })
  @ApiResponse({
    status: 200,
    description: 'Eligible employees retrieved successfully.',
  })
  async getEligibleEmployees(
    @Param('month') month: string, // Format: YYYY-MM
    @TenantId() tenantId: string,
  ) {
    return await this.hrPayrollService.getEligibleEmployees(month, tenantId);
  }

  @Put('hr/approve/:recordId')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve individual payroll record' })
  @ApiResponse({
    status: 200,
    description: 'Payroll record approved successfully.',
  })
  async approvePayroll(
    @Param('recordId') recordId: string,
    @Body() body: { approvalNotes?: string },
    @TenantId() tenantId: string,
    @Request() req: any,
  ) {
    console.log('🔧 DEBUG - Individual Approve Payroll Request:', {
      recordId,
      body,
      tenantId,
      userId: req.user?.id
    });
    
    return await this.hrPayrollService.bulkApprovePayroll(
      [recordId], // Single record as array
      body.approvalNotes || 'Approved by HR',
      req.user?.id, // approverId
      tenantId
    );
  }

  @Post('hr/approve-bulk')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk approve payroll records' })
  @ApiResponse({
    status: 200,
    description: 'Payroll records approved successfully.',
  })
  async bulkApprovePayroll(
    @Body() approveDto: BulkApprovePayrollDto,
    @TenantId() tenantId: string,
    @Request() req: any,
  ) {
    console.log('🔧 DEBUG - Bulk Approve Payroll Request:', {
      approveDto,
      tenantId,
      userId: req.user?.id
    });
    
    return await this.hrPayrollService.bulkApprovePayroll(
      approveDto.payrollRecordIds,
      approveDto.approvalNotes || 'Bulk approved by HR',
      req.user?.id, // approverId
      tenantId
    );
  }

  @Get('hr/dashboard-summary/:month')
  @Roles(UserRole.HR, UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get dashboard summary for HR/Finance overview' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary retrieved successfully.',
  })
  async getDashboardSummary(
    @Param('month') month: string,
    @TenantId() tenantId: string,
  ) {
    return await this.hrPayrollService.getDashboardSummary(month, tenantId);
  }

  @Get('hr/department-breakdown/:month')
  @Roles(UserRole.HR, UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get department-wise salary breakdown for HR/Finance' })
  @ApiResponse({
    status: 200,
    description: 'Department breakdown retrieved successfully.',
  })
  async getDepartmentBreakdown(
    @Param('month') month: string,
    @TenantId() tenantId: string,
  ) {
    return await this.hrPayrollService.getDepartmentBreakdown(month, tenantId);
  }
}
