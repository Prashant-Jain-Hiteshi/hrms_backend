import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AddEmployeeAttendanceDto } from './dto/add-employee-attendance.dto';
import { TenantId } from '../../common/decorators/tenant.decorator';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @ApiOperation({ summary: 'Check-in for the current user' })
  async checkIn(@Req() req: any, @Body() dto: CheckInDto, @TenantId() tenantId: string) {
    const user = req.user as { id: string; email: string; role: string };
    return this.attendanceService.checkIn(user, dto, tenantId);
  }

  @Post('check-out')
  @ApiOperation({ summary: 'Check-out for the current user' })
  async checkOut(@Req() req: any, @Body() dto: CheckOutDto, @TenantId() tenantId: string) {
    const user = req.user as { id: string; email: string; role: string };
    return this.attendanceService.checkOut(user, dto, tenantId);
  }

  @Get('me')
  @ApiOperation({ summary: 'List my attendance records within a date range' })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    example: '2025-08-01',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    example: '2025-08-31',
  })
  async myAttendance(
    @Req() req: any,
    @TenantId() tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const user = req.user as { id: string; email: string };
    return this.attendanceService.myAttendance(user, from, to, tenantId);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get my attendance summary (week or month)' })
  @ApiQuery({ name: 'range', required: true, enum: ['week', 'month'] })
  async summary(@Req() req: any, @Query('range') range?: 'week' | 'month') {
    const user = req.user as { id: string };
    if (range !== 'week' && range !== 'month')
      throw new BadRequestException('range must be week|month');
    return this.attendanceService.summary(user, range);
  }

  @Get('status')
  @ApiOperation({
    summary:
      'Get attendance status and sessions for a date (defaults to today)',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2025-08-26',
  })
  async status(@Req() req: any, @Query('date') date?: string) {
    const user = req.user as { id: string };
    return this.attendanceService.status(user, date);
  }

  @Get('admin-status')
  @ApiOperation({
    summary: 'ADMIN/HR: Get attendance status and sessions for a user and date',
  })
  @ApiQuery({ name: 'userId', required: true, type: String })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2025-08-26',
  })
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  async adminStatus(
    @TenantId() tenantId: string,
    @Query('userId') userId: string,
    @Query('date') date?: string,
  ) {
    return this.attendanceService.adminStatus(userId, date, tenantId);
  }

  @Put('admin-session')
  @ApiOperation({
    summary: 'ADMIN/HR: Update a session check-in/check-out time',
  })
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  async adminUpdateSession(
    @Body('sessionId') sessionId: string,
    @Body('startTime') startTime?: string,
    @Body('endTime') endTime?: string,
  ) {
    if (!sessionId) throw new BadRequestException('sessionId is required');
    return this.attendanceService.adminUpdateSession(sessionId, {
      startTime,
      endTime,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List all attendance (admin/hr)' })
  @ApiQuery({ name: 'type', required: false, enum: ['monthly', 'daily'] })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2025-08-26',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    example: '2025-08-01',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    example: '2025-08-31',
  })
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  async listAll(
    @TenantId() tenantId: string,
    @Query('type') type?: 'monthly' | 'daily',
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: 'present' | 'late' | 'absent',
  ) {
    // If type/date provided, derive from/to to cover the range
    if (type && date) {
      if (type === 'daily') {
        from = date;
        to = date;
      } else if (type === 'monthly') {
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
          const start = new Date(d.getFullYear(), d.getMonth(), 1);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          from = start.toISOString().slice(0, 10);
          to = end.toISOString().slice(0, 10);
        }
      }
    }
    // Special case: absent only supported for a single day (type=daily or from=to)
    if (status === 'absent') {
      const day =
        type === 'daily' && date
          ? date
          : from && to && from === to
            ? from
            : undefined;
      if (!day) {
        throw new BadRequestException(
          'status=absent requires type=daily&date or from=to',
        );
      }
      return this.attendanceService.listAllByStatus(day, 'absent', tenantId);
    }
    return this.attendanceService.listAll(from, to, status, tenantId);
  }

  @Get('report')
  @ApiOperation({
    summary: 'ADMIN/HR: Export attendance report as CSV (Excel-compatible)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['daily', 'monthly', 'range'],
  })
  @ApiQuery({
    name: 'date',
    required: false,
    type: String,
    example: '2025-08-26 or 2025-08',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    example: '2025-08-01',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    example: '2025-08-31',
  })
  @ApiQuery({ name: 'format', required: false, enum: ['excel', 'pdf'] })
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  async exportReport(
    @Res() res: any,
    @Query('type') type: 'daily' | 'monthly' | 'range' = 'daily',
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('format') format: 'excel' | 'pdf' = 'excel',
  ) {
    // Derive from/to based on type/date if provided
    if (type && date) {
      if (type === 'daily') {
        from = date;
        to = date;
      } else if (type === 'monthly') {
        // Support yyyy-mm or yyyy-mm-dd
        const isMonth = date.length === 7; // Check if date is in yyyy-mm format
        const d = isMonth ? new Date(`${date}-01`) : new Date(date);
        if (!isNaN(d.getTime())) {
          const start = new Date(d.getFullYear(), d.getMonth(), 1);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
          from = start.toISOString().slice(0, 10);
          to = end.toISOString().slice(0, 10);
        }
      }
    }

    const { buffer, filename, contentType } =
      await this.attendanceService.generateReport({ from, to, format });
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  }

  @Get('weekly')
  @ApiOperation({
    summary: 'ADMIN/HR: Get current week attendance overview (Mon–Fri)',
  })
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  async weekly(@TenantId() tenantId: string) {
    return this.attendanceService.weeklyOverview(tenantId);
  }

  @Get('employee-summary')
  @ApiOperation({
    summary: 'Get attendance summary for an employee (total present/absent days)',
  })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    type: String,
    description: 'Employee ID (defaults to current user)',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    example: '2025-01-31',
  })
  async getEmployeeAttendanceSummary(
    @Req() req: any,
    @TenantId() tenantId: string,
    @Query('employeeId') employeeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const user = req.user as { id: string; role: string; employeeId?: string };
    
    let targetEmployeeId = employeeId;
    if (!targetEmployeeId) {
      if (!user.employeeId) {
        throw new BadRequestException('Employee ID is required');
      }
      targetEmployeeId = user.employeeId;
    } else if (user.role !== 'admin' && user.role !== 'hr' && targetEmployeeId !== user.employeeId) {
      throw new BadRequestException('You can only view your own attendance summary');
    }

    return this.attendanceService.getEmployeeAttendanceSummary(
      targetEmployeeId,
      from,
      to,
      tenantId,
    );
  }

  @Get('overall-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  async getOverallAttendanceStats(
    @TenantId() tenantId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.getOverallAttendanceStats(from, to, tenantId);
  }

  @Get('stats-by-range')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  async getAttendanceStatsByRange(
    @TenantId() tenantId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.attendanceService.getAttendanceStatsByDateRange(from, to, tenantId);
  }

  @Post('add-employee-attendance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  async addEmployeeAttendance(
    @TenantId() tenantId: string,
    @Body() attendanceData: AddEmployeeAttendanceDto,
    @Req() req: any,
  ) {
    const user = req.user as { id: string; role: string };
    return this.attendanceService.addEmployeeAttendance(attendanceData, user, tenantId);
  }

  @Get('date-details')
  @ApiOperation({ summary: 'Get attendance details for a specific date' })
  async getAttendanceForDate(
    @Req() req: any,
    @TenantId() tenantId: string,
    @Query('date') date: string,
  ) {
    const user = req.user as { id: string; email: string; role: string };
    return this.attendanceService.getAttendanceForDate(user, date, tenantId);
  }



  // DEV ONLY: seed last 4 weeks data for current user. Disabled in production.
  @Post('seed-weeks')
  @ApiOperation({
    summary:
      '[DEV] Seed last weeks attendance for current user (e.g., counts=2,4,5,3)',
  })
  async seedWeeks(@Req() req: any, @Query('counts') counts?: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Seeding is disabled in production');
    }
    const user = req.user as { id: string; email?: string };
    const arr = (counts || '2,4,5,3')
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));
    return this.attendanceService.seedLastWeeks(user, arr);
  }
}
