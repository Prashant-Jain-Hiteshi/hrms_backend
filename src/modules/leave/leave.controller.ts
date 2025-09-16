import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LeaveService } from './leave.service';
import { CreateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';

type AuthUser = {
  id: string;
  email?: string;
  role: 'admin' | 'hr' | 'employee' | 'finance';
  employeeId: string;
};

@ApiTags('Leave Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave')
export class LeaveController {
  private readonly logger = new Logger(LeaveController.name);
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @ApiOperation({ summary: 'Apply for leave' })
  @ApiResponse({
    status: 201,
    description: 'Leave request created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createLeaveRequest(
    @Request() req: { user: AuthUser },
    @Body() createLeaveDto: CreateLeaveDto,
  ) {
    const user = req.user;
    this.logger.log(
      `POST /leave received | userId=${user.id} employeeId=${user.employeeId} | dto=${JSON.stringify(
        {
          leaveType: createLeaveDto?.leaveType,
          startDate: createLeaveDto?.startDate,
          endDate: createLeaveDto?.endDate,
          toCount: createLeaveDto?.toEmployees?.length || 0,
          ccCount: createLeaveDto?.ccEmployees?.length || 0,
        },
      )}`,
    );
    try {
      const res = await this.leaveService.createLeaveRequest(
        user.employeeId,
        createLeaveDto,
      );
      this.logger.log(`POST /leave success | id=${res?.id}`);
      return res;
    } catch (err: unknown) {
      const e = err as Error;
      this.logger.error(`POST /leave failed: ${e.message}`, e.stack);
      throw err;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get leave requests' })
  @ApiResponse({
    status: 200,
    description: 'Leave requests retrieved successfully',
  })
  async getLeaveRequests(@Request() req: { user: AuthUser }) {
    return this.leaveService.getLeaveRequests(
      req.user.employeeId,
      req.user.role,
    );
  }

  @Get('for-approval')
  @ApiOperation({ summary: 'Get leave requests for approval' })
  @ApiResponse({
    status: 200,
    description: 'Leave requests for approval retrieved successfully',
  })
  async getLeaveRequestsForApproval(@Request() req: { user: AuthUser }) {
    return this.leaveService.getLeaveRequestsForApproval(req.user.employeeId);
  }

  @Get('cc-requests')
  @ApiOperation({ summary: 'Get leave requests where user is in CC' })
  @ApiResponse({
    status: 200,
    description: 'CC leave requests retrieved successfully',
  })
  async getLeaveRequestsForCC(@Request() req: { user: AuthUser }) {
    return this.leaveService.getLeaveRequestsForCC(req.user.employeeId);
  }

  @Get('mentions')
  @ApiOperation({
    summary: 'Get leave requests where user is mentioned (TO or CC)',
  })
  @ApiResponse({
    status: 200,
    description: 'Mentioned leave requests retrieved successfully',
  })
  async getMentionedLeaveRequests(@Request() req: { user: AuthUser }) {
    return this.leaveService.getLeaveRequestsMentions(req.user.employeeId);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get leave balance for current user' })
  @ApiResponse({
    status: 200,
    description: 'Leave balance retrieved successfully',
  })
  async getLeaveBalance(@Request() req: { user: AuthUser }) {
    return this.leaveService.getLeaveBalance(req.user.employeeId);
  }

  // Admin: Configure monthly leave credits
  @Post('credit-config')
  @Roles('admin')
  @ApiOperation({ summary: 'Configure monthly leave credits (Admin only)' })
  @ApiResponse({ status: 201, description: 'Leave credit configuration created successfully' })
  async configureLeaveCreditConfig(@Body() configData: any) {
    return this.leaveService.configureLeaveCreditConfig(configData);
  }

  @Get('credit-config')
  @Roles('admin', 'hr', 'employee')
  @ApiOperation({ summary: 'Get leave credit configurations' })
  @ApiResponse({ status: 200, description: 'Leave credit configurations retrieved successfully' })
  async getLeaveCreditConfigs() {
    return this.leaveService.getLeaveCreditConfigs();
  }

  @Put('credit-config/:leaveType')
  @Roles('admin')
  @ApiOperation({ summary: 'Update leave credit configuration (Admin only)' })
  @ApiResponse({ status: 200, description: 'Leave credit configuration updated successfully' })
  async updateLeaveCreditConfig(
    @Param('leaveType') leaveType: string,
    @Body() updateData: any
  ) {
    return this.leaveService.updateLeaveCreditConfig(leaveType, updateData);
  }

  // Admin: Manual credit leave
  @Post('manual-credit')
  @Roles('admin')
  @ApiOperation({ summary: 'Manually credit leave to employee (Admin only)' })
  @ApiResponse({ status: 201, description: 'Leave credited successfully' })
  async manualCreditLeave(@Body() creditData: any) {
    return this.leaveService.manualCreditLeave(creditData);
  }

  // Admin: Trigger monthly credits
  @Post('trigger-monthly-credits')
  @Roles('admin')
  @ApiOperation({ summary: 'Trigger monthly credit processing (Admin only)' })
  @ApiResponse({ status: 200, description: 'Monthly credit processing triggered' })
  async triggerMonthlyCredits() {
    return this.leaveService.triggerMonthlyCredits();
  }

  // Get employee's credit history
  @Get('credit-history/:employeeId')
  @Roles('admin', 'hr')
  @ApiOperation({ summary: 'Get employee leave credit history' })
  @ApiResponse({ status: 200, description: 'Employee credit history retrieved successfully' })
  async getEmployeeCreditHistory(
    @Param('employeeId') employeeId: string,
    @Query('year') year?: number
  ) {
    return this.leaveService.getEmployeeCreditHistory(employeeId, year);
  }

  // Get my credit history
  @Get('my-credit-history')
  @ApiOperation({ summary: 'Get current user leave credit history' })
  @ApiResponse({ status: 200, description: 'User credit history retrieved successfully' })
  async getMyCreditHistory(@Request() req: any, @Query('year') year?: number) {
    return this.leaveService.getEmployeeCreditHistory(req.user.employeeId, year);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get leave statistics' })
  @ApiResponse({
    status: 200,
    description: 'Leave statistics retrieved successfully',
  })
  async getLeaveStatistics(
    @Request() req: { user: AuthUser },
    @Query('employeeId') employeeId?: string,
  ) {
    // Admin can get stats for any employee, others only for themselves
    const targetEmployeeId =
      req.user.role === 'admin' ? employeeId : req.user.employeeId;
    return this.leaveService.getLeaveStatistics(targetEmployeeId);
  }

  // Monthly ledger (deducted days) for a date range
  @Get('monthly-ledger')
  @Roles('admin', 'hr', 'employee')
  @ApiOperation({ summary: 'Get monthly deducted leave days for a date range' })
  @ApiResponse({ status: 200, description: 'Monthly ledger retrieved successfully' })
  async getMonthlyLedger(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    // Admin can query any employeeId; others default to self
    const targetEmployeeId = req.user.role === 'admin' && employeeId ? employeeId : req.user.employeeId;
    return this.leaveService.getMonthlyLedger(targetEmployeeId, from, to);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get leave request by ID' })
  @ApiResponse({
    status: 200,
    description: 'Leave request retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  async getLeaveRequestById(@Param('id') id: string) {
    return this.leaveService.getLeaveRequestById(id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update leave request status (approve/reject)' })
  @ApiResponse({
    status: 200,
    description: 'Leave request status updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Not authorized to approve this request',
  })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  async updateLeaveStatus(
    @Param('id') id: string,
    @Request() req: { user: AuthUser },
    @Body() updateStatusDto: UpdateLeaveStatusDto,
  ) {
    return this.leaveService.updateLeaveStatus(
      id,
      req.user.employeeId,
      updateStatusDto,
    );
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel own leave request (only when pending)' })
  @ApiResponse({
    status: 200,
    description: 'Leave request cancelled successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only cancel own pending requests',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Can only cancel pending requests',
  })
  async cancelLeave(
    @Param('id') id: string,
    @Request() req: { user: AuthUser },
    @Body('comments') comments?: string,
  ) {
    return this.leaveService.cancelLeaveRequest(
      id,
      req.user.employeeId,
      comments,
    );
  }

  @Put(':id/mark-read')
  @ApiOperation({ summary: 'Mark CC leave request as read' })
  @ApiResponse({ status: 200, description: 'Leave request marked as read' })
  @ApiResponse({ status: 404, description: 'CC entry not found' })
  @HttpCode(HttpStatus.OK)
  async markCCAsRead(
    @Param('id') id: string,
    @Request() req: { user: AuthUser },
  ) {
    return this.leaveService.markCCAsRead(id, req.user.employeeId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete leave request' })
  @ApiResponse({
    status: 200,
    description: 'Leave request deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Can only delete own requests',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Can only delete pending requests',
  })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  async deleteLeaveRequest(
    @Param('id') id: string,
    @Request() req: { user: AuthUser },
  ) {
    return this.leaveService.deleteLeaveRequest(
      id,
      req.user.employeeId,
      req.user.role,
    );
  }

  // Admin-only endpoints
  @Get('admin/all')
  @Roles('admin')
  @ApiOperation({ summary: 'Get all leave requests (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'All leave requests retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getAllLeaveRequests(@Request() req: { user: AuthUser }) {
    return this.leaveService.getLeaveRequests(req.user.employeeId, 'admin');
  }

  @Get('admin/statistics/all')
  @Roles('admin')
  @ApiOperation({ summary: 'Get overall leave statistics (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Overall leave statistics retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getOverallStatistics() {
    return this.leaveService.getLeaveStatistics();
  }
}
