import { Controller, Post, Get, Body, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('check-in')
  @ApiOperation({ summary: 'Check-in for the current user' })
  async checkIn(@Req() req: any, @Body() dto: CheckInDto) {
    const user = req.user as { id: string; email: string; role: string };
    return this.attendanceService.checkIn(user, dto);
    }

  @Post('check-out')
  @ApiOperation({ summary: 'Check-out for the current user' })
  async checkOut(@Req() req: any, @Body() dto: CheckOutDto) {
    const user = req.user as { id: string; email: string; role: string };
    return this.attendanceService.checkOut(user, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'List my attendance records within a date range' })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2025-08-01' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2025-08-31' })
  async myAttendance(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    const user = req.user as { id: string };
    return this.attendanceService.myAttendance(user, from, to);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get my attendance summary (week or month)' })
  @ApiQuery({ name: 'range', required: true, enum: ['week', 'month'] })
  async summary(@Req() req: any, @Query('range') range?: 'week' | 'month') {
    const user = req.user as { id: string };
    if (range !== 'week' && range !== 'month') throw new BadRequestException('range must be week|month');
    return this.attendanceService.summary(user, range);
  }

  @Get()
  @ApiOperation({ summary: 'List all attendance (admin/hr)' })
  @ApiQuery({ name: 'from', required: false, type: String, example: '2025-08-01' })
  @ApiQuery({ name: 'to', required: false, type: String, example: '2025-08-31' })
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.HR)
  async listAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.attendanceService.listAll(from, to);
  }

  // DEV ONLY: seed last 4 weeks data for current user. Disabled in production.
  @Post('seed-weeks')
  @ApiOperation({ summary: '[DEV] Seed last weeks attendance for current user (e.g., counts=2,4,5,3)' })
  async seedWeeks(@Req() req: any, @Query('counts') counts?: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Seeding is disabled in production');
    }
    const user = req.user as { id: string; email?: string };
    const arr = (counts || '2,4,5,3')
      .split(',')
      .map(s => parseInt(s.trim(), 10))
      .filter(n => Number.isFinite(n));
    return this.attendanceService.seedLastWeeks(user, arr);
  }
}
