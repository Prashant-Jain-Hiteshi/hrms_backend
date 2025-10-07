import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ValidationPipe,
  UploadedFiles,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ExpenseReimbursementService } from '../services/expense-reimbursement.service';
import { CreateExpenseReimbursementDto } from '../dto/create-expense-reimbursement.dto';
import { UpdateReimbursementStatusDto } from '../dto/update-reimbursement-status.dto';
import { CalculateAmountDto } from '../dto/calculate-amount.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { UserRole } from '../../users/user-role.enum';
import { MultipleFilesUpload } from '../../../common/decorators/file-upload.decorator';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

@ApiTags('Expense Reimbursements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/expense/reimbursements')
export class ExpenseReimbursementController {
  constructor(private readonly reimbursementService: ExpenseReimbursementService) {}

  @Post()
  @Roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN)
  @MultipleFilesUpload('receipts', 'expenses', 5, 'Upload receipt files (optional)')
  @ApiOperation({ summary: 'Submit expense reimbursement request' })
  @ApiResponse({ status: 201, description: 'Reimbursement request submitted successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body(ValidationPipe) createDto: CreateExpenseReimbursementDto,
    @UploadedFiles() receiptFiles: Express.Multer.File[],
    @Request() req: any,
    @TenantId() tenantId: string,
  ) {
    try {
      const employeeId = req.user.id; // Assuming user ID is employee ID
      const reimbursement = await this.reimbursementService.create(
        createDto,
        employeeId,
        tenantId,
        receiptFiles
      );
      
      return {
        success: true,
        message: 'Expense reimbursement submitted successfully',
        data: reimbursement,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to submit expense reimbursement');
    }
  }

  @Get('my-requests')
  @Roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get employee\'s own reimbursement requests' })
  @ApiResponse({ status: 200, description: 'Employee reimbursements retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyRequests(
    @Request() req: any,
    @TenantId() tenantId: string,
  ) {
    try {
      const employeeId = req.user.id;
      const reimbursements = await this.reimbursementService.findByEmployee(employeeId, tenantId);
      
      return {
        success: true,
        message: 'Employee reimbursements retrieved successfully',
        data: reimbursements,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch employee reimbursements');
    }
  }

  @Get()
  @Roles(UserRole.FINANCE, UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get all reimbursement requests with filters' })
  @ApiQuery({ name: 'status', required: false, enum: ['submitted', 'approved', 'rejected', 'paid'] })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Reimbursements retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Finance or Admin role required' })
  async findAll(
    @Query() filters: any,
    @TenantId() tenantId: string,
  ) {
    try {
      const result = await this.reimbursementService.findAll(tenantId, filters);
      
      return {
        success: true,
        message: 'Reimbursements retrieved successfully',
        data: result.data,
        total: result.total,
        filters: filters,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch reimbursements');
    }
  }

  @Get('pending')
  @Roles(UserRole.HR, UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get pending reimbursements for approval' })
  @ApiResponse({ status: 200, description: 'Pending reimbursements retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - HR, Admin or Finance role required' })
  async findPending(@TenantId() tenantId: string) {
    try {
      const reimbursements = await this.reimbursementService.findPending(tenantId);
      
      return {
        success: true,
        message: 'Pending reimbursements retrieved successfully',
        data: reimbursements,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch pending reimbursements');
    }
  }

  @Get('approved')
  @Roles(UserRole.FINANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get approved reimbursements ready for payment (Finance only)' })
  @ApiResponse({ status: 200, description: 'Approved reimbursements retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Finance or Admin role required' })
  async findApproved(@TenantId() tenantId: string) {
    try {
      const reimbursements = await this.reimbursementService.findApproved(tenantId);
      
      return {
        success: true,
        message: 'Approved reimbursements retrieved successfully',
        data: reimbursements,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch approved reimbursements');
    }
  }

  @Get('statistics')
  @Roles(UserRole.FINANCE, UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get reimbursement statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStatistics(@TenantId() tenantId: string) {
    try {
      const statistics = await this.reimbursementService.getStatistics(tenantId);
      
      return {
        success: true,
        message: 'Statistics retrieved successfully',
        data: statistics,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch statistics');
    }
  }

  @Post('calculate')
  @Roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Calculate approved amount for expense' })
  @ApiResponse({ status: 200, description: 'Amount calculated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid category' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async calculateAmount(
    @Body(ValidationPipe) calculateDto: CalculateAmountDto,
    @TenantId() tenantId: string,
  ) {
    try {
      const result = await this.reimbursementService.calculateApprovedAmount(calculateDto, tenantId);
      
      return {
        success: true,
        message: 'Amount calculated successfully',
        data: result,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to calculate amount');
    }
  }

  @Put(':id/mark-paid')
  @Roles(UserRole.FINANCE, UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark approved reimbursement as paid (Finance only)' })
  @ApiResponse({ status: 200, description: 'Reimbursement marked as paid successfully' })
  @ApiResponse({ status: 404, description: 'Reimbursement not found' })
  @ApiResponse({ status: 400, description: 'Bad request - reimbursement not approved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Finance or Admin role required' })
  async markAsPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { comments?: string },
    @Request() req: any,
    @TenantId() tenantId: string,
  ) {
    try {
      const financeUserId = req.user.id;
      
      const reimbursement = await this.reimbursementService.markAsPaid(
        id,
        financeUserId,
        tenantId,
        body.comments
      );
      
      return {
        success: true,
        message: 'Reimbursement marked as paid successfully',
        data: reimbursement,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to mark reimbursement as paid');
    }
  }

  @Get(':id')
  @Roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN, UserRole.FINANCE)
  @ApiOperation({ summary: 'Get reimbursement by ID' })
  @ApiResponse({ status: 200, description: 'Reimbursement retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Reimbursement not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
  ) {
    try {
      const reimbursement = await this.reimbursementService.findOne(id, tenantId);
      
      return {
        success: true,
        message: 'Reimbursement retrieved successfully',
        data: reimbursement,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch reimbursement');
    }
  }

  @Put(':id/status')
  @Roles(UserRole.FINANCE, UserRole.ADMIN,UserRole.HR)
  @ApiOperation({ summary: 'Update reimbursement status (approve/reject/pay)' })
  @ApiResponse({ status: 200, description: 'Reimbursement status updated successfully' })
  @ApiResponse({ status: 404, description: 'Reimbursement not found' })
  @ApiResponse({ status: 400, description: 'Bad request - invalid status transition' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Finance or Admin role required' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(ValidationPipe) updateDto: UpdateReimbursementStatusDto,
    @Request() req: any,
    @TenantId() tenantId: string,
  ) {
    try {
      const approverId = req.user.id;
      
      const reimbursement = await this.reimbursementService.updateStatus(
        id,
        updateDto,
        approverId,
        tenantId
      );
      
      return {
        success: true,
        message: `Reimbursement ${updateDto.status} successfully`,
        data: reimbursement,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to update reimbursement status');
    }
  }


  @Delete(':id')
  @Roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Cancel reimbursement request (employee only, submitted status only)' })
  @ApiResponse({ status: 200, description: 'Reimbursement cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Reimbursement not found' })
  @ApiResponse({ status: 400, description: 'Bad request - cannot cancel this reimbursement' })
  @ApiResponse({ status: 403, description: 'Forbidden - can only cancel own reimbursements' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
    @TenantId() tenantId: string,
  ) {
    try {
      const employeeId = req.user.id;
      await this.reimbursementService.cancel(id, employeeId, tenantId);
      
      return {
        success: true,
        message: 'Reimbursement cancelled successfully',
      };
    } catch (error) {
      
      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        console.log(error)
        throw error;
      }
      console.log(error)
      throw new BadRequestException('Failed to cancel reimbursement');
    }
  }
}
