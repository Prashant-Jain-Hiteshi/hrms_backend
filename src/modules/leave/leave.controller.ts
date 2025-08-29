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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LeaveService } from './leave.service';
import { CreateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';

@ApiTags('Leave Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave')
export class LeaveController {
  private readonly logger = new Logger(LeaveController.name);
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  @ApiOperation({ summary: 'Apply for leave' })
  @ApiResponse({ status: 201, description: 'Leave request created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createLeaveRequest(@Request() req: any, @Body() createLeaveDto: CreateLeaveDto) {
    const user = req.user || {};
    this.logger.log(
      `POST /leave received | userId=${user.id} employeeId=${user.employeeId} | dto=${JSON.stringify({
        leaveType: createLeaveDto?.leaveType,
        startDate: createLeaveDto?.startDate,
        endDate: createLeaveDto?.endDate,
        toCount: createLeaveDto?.toEmployees?.length || 0,
        ccCount: createLeaveDto?.ccEmployees?.length || 0,
      })}`
    );
    try {
      const res = await this.leaveService.createLeaveRequest(user.employeeId, createLeaveDto);
      this.logger.log(`POST /leave success | id=${res?.id}`);
      return res;
    } catch (error) {
      this.logger.error(`POST /leave failed: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Get leave requests' })
  @ApiResponse({ status: 200, description: 'Leave requests retrieved successfully' })
  async getLeaveRequests(@Request() req: any) {
    return this.leaveService.getLeaveRequests(req.user.employeeId, req.user.role);
  }

  @Get('for-approval')
  @ApiOperation({ summary: 'Get leave requests for approval' })
  @ApiResponse({ status: 200, description: 'Leave requests for approval retrieved successfully' })
  async getLeaveRequestsForApproval(@Request() req: any) {
    return this.leaveService.getLeaveRequestsForApproval(req.user.employeeId);
  }

  @Get('cc-requests')
  @ApiOperation({ summary: 'Get leave requests where user is in CC' })
  @ApiResponse({ status: 200, description: 'CC leave requests retrieved successfully' })
  async getLeaveRequestsForCC(@Request() req: any) {
    return this.leaveService.getLeaveRequestsForCC(req.user.employeeId);
  }

  @Get('mentions')
  @ApiOperation({ summary: 'Get leave requests where user is mentioned (TO or CC)' })
  @ApiResponse({ status: 200, description: 'Mentioned leave requests retrieved successfully' })
  async getMentionedLeaveRequests(@Request() req: any) {
    return this.leaveService.getLeaveRequestsMentions(req.user.employeeId);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get leave balance for current user' })
  @ApiResponse({ status: 200, description: 'Leave balance retrieved successfully' })
  async getLeaveBalance(@Request() req: any) {
    return this.leaveService.getLeaveBalance(req.user.employeeId);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get leave statistics' })
  @ApiResponse({ status: 200, description: 'Leave statistics retrieved successfully' })
  async getLeaveStatistics(@Request() req: any, @Query('employeeId') employeeId?: string) {
    // Admin can get stats for any employee, others only for themselves
    const targetEmployeeId = req.user.role === 'admin' ? employeeId : req.user.employeeId;
    return this.leaveService.getLeaveStatistics(targetEmployeeId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get leave request by ID' })
  @ApiResponse({ status: 200, description: 'Leave request retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  async getLeaveRequestById(@Param('id') id: string) {
    return this.leaveService.getLeaveRequestById(id);
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Update leave request status (approve/reject)' })
  @ApiResponse({ status: 200, description: 'Leave request status updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized to approve this request' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  async updateLeaveStatus(
    @Param('id') id: string,
    @Request() req: any,
    @Body() updateStatusDto: UpdateLeaveStatusDto,
  ) {
    return this.leaveService.updateLeaveStatus(id, req.user.employeeId, updateStatusDto);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel own leave request (only when pending)' })
  @ApiResponse({ status: 200, description: 'Leave request cancelled successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only cancel own pending requests' })
  @ApiResponse({ status: 400, description: 'Bad request - Can only cancel pending requests' })
  async cancelLeave(
    @Param('id') id: string,
    @Request() req: any,
    @Body('comments') comments?: string,
  ) {
    return this.leaveService.cancelLeaveRequest(id, req.user.employeeId, comments);
  }

  @Put(':id/mark-read')
  @ApiOperation({ summary: 'Mark CC leave request as read' })
  @ApiResponse({ status: 200, description: 'Leave request marked as read' })
  @ApiResponse({ status: 404, description: 'CC entry not found' })
  @HttpCode(HttpStatus.OK)
  async markCCAsRead(@Param('id') id: string, @Request() req: any) {
    return this.leaveService.markCCAsRead(id, req.user.employeeId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete leave request' })
  @ApiResponse({ status: 200, description: 'Leave request deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Can only delete own requests' })
  @ApiResponse({ status: 400, description: 'Bad request - Can only delete pending requests' })
  @ApiResponse({ status: 404, description: 'Leave request not found' })
  async deleteLeaveRequest(@Param('id') id: string, @Request() req: any) {
    return this.leaveService.deleteLeaveRequest(id, req.user.employeeId, req.user.role);
  }

  // Admin-only endpoints
  @Get('admin/all')
  @Roles('admin')
  @ApiOperation({ summary: 'Get all leave requests (Admin only)' })
  @ApiResponse({ status: 200, description: 'All leave requests retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getAllLeaveRequests(@Request() req: any) {
    return this.leaveService.getLeaveRequests(req.user.employeeId, 'admin');
  }

  @Get('admin/statistics/all')
  @Roles('admin')
  @ApiOperation({ summary: 'Get overall leave statistics (Admin only)' })
  @ApiResponse({ status: 200, description: 'Overall leave statistics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getOverallStatistics() {
    return this.leaveService.getLeaveStatistics();
  }
}
