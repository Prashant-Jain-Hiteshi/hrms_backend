import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { CompensatoryLeaveService } from './compensatory-leave.service';
import {
  CreateCompensatoryLeaveDto,
  UpdateCompensatoryLeaveDto,
  CompensatoryLeaveQueryDto,
  CompensatoryLeaveResponseDto,
  CompensatoryCreditsSummaryDto,
} from './dto/compensatory-leave.dto';
import { CompensatoryLeaveStatus } from './compensatory-leave.model';

@ApiTags('Compensatory Leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('compensatory-leave')
export class CompensatoryLeaveController {
  constructor(private readonly compensatoryLeaveService: CompensatoryLeaveService) {}

  @Post()
  @Roles(Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Create compensatory leave assignment (HR/Admin only)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Compensatory leave created successfully',
    type: CompensatoryLeaveResponseDto,
  })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  async create(@Body() createDto: CreateCompensatoryLeaveDto, @Request() req: any) {
    return this.compensatoryLeaveService.create(createDto, req.user.id);
  }

  @Get()
  @Roles(Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Get all compensatory leave records (HR/Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of compensatory leave records',
    type: [CompensatoryLeaveResponseDto],
  })
  @ApiQuery({ name: 'employeeId', required: false, description: 'Filter by employee ID' })
  @ApiQuery({ name: 'userId', required: false, description: 'Filter by user ID' })
  @ApiQuery({ name: 'status', required: false, enum: CompensatoryLeaveStatus, description: 'Filter by status' })
  @ApiQuery({ name: 'department', required: false, description: 'Filter by department' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (YYYY-MM-DD)' })
  async findAll(@Query() query: CompensatoryLeaveQueryDto) {
    return this.compensatoryLeaveService.findAll(query);
  }

  @Get('summary')
  @Roles(Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Get compensatory leave summary statistics (HR/Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compensatory leave summary',
    type: CompensatoryCreditsSummaryDto,
  })
  async getSummary() {
    return this.compensatoryLeaveService.getSummary();
  }

  @Get('my-credits')
  @ApiOperation({ summary: 'Get current user compensatory leave credits' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User compensatory leave records',
    type: [CompensatoryLeaveResponseDto],
  })
  async getMyCredits(@Request() req: any, @Query('status') status?: CompensatoryLeaveStatus) {
    return this.compensatoryLeaveService.findByUserId(req.user.id, status);
  }

  @Get('my-credits/total')
  @ApiOperation({ summary: 'Get total active compensatory credits for current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Total active credits',
    schema: { type: 'object', properties: { totalCredits: { type: 'number' } } },
  })
  async getMyTotalCredits(@Request() req: any) {
    const totalCredits = await this.compensatoryLeaveService.getActiveCreditsForUser(req.user.id);
    return { totalCredits };
  }

  @Get('my-credits/by-month')
  @ApiOperation({ summary: 'Get compensatory credits by month for current user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Credits grouped by month',
    schema: {
      type: 'object',
      additionalProperties: { type: 'number' },
      example: { '2025-08': 2, '2025-09': 1 },
    },
  })
  async getMyCreditsByMonth(@Request() req: any) {
    return this.compensatoryLeaveService.getActiveCreditsForUserByMonth(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get compensatory leave record by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compensatory leave record',
    type: CompensatoryLeaveResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    const record = await this.compensatoryLeaveService.findOne(id);
    
    // Allow HR/Admin to view any record, employees can only view their own
    const userRole = req.user.role?.toLowerCase();
    if (userRole !== 'hr' && userRole !== 'admin' && record.userId !== req.user.id) {
      throw new Error('Access denied');
    }
    
    return record;
  }

  @Patch(':id')
  @Roles(Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Update compensatory leave record (HR/Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compensatory leave updated successfully',
    type: CompensatoryLeaveResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateCompensatoryLeaveDto,
    @Request() req: any,
  ) {
    return this.compensatoryLeaveService.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  @Roles(Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Delete compensatory leave record (HR/Admin only)' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Record deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Access denied' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.compensatoryLeaveService.remove(id);
  }

  @Post('expire-old')
  @Roles(Role.HR, Role.ADMIN)
  @ApiOperation({ summary: 'Expire old compensatory leave credits (HR/Admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Number of expired records',
    schema: { type: 'object', properties: { expiredCount: { type: 'number' } } },
  })
  async expireOldCredits() {
    const expiredCount = await this.compensatoryLeaveService.expireOldCredits();
    return { expiredCount };
  }
}
