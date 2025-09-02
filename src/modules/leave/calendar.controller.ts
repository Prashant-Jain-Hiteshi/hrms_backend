import { Controller, Get, Put, Post, Delete, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CalendarService } from './calendar.service';
import { CreateHolidayDto, UpdateHolidayDto, UpdateWeekendsDto } from './dto/calendar.dto';

@ApiTags('Leave Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave/calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  // Weekends
  @Get('weekends')
  @ApiOperation({ summary: 'Get weekend days (0=Sun..6=Sat)' })
  async getWeekends() {
    const weekends = await this.calendarService.getWeekends();
    return { weekends };
  }

  @Put('weekends')
  @Roles('admin')
  @ApiOperation({ summary: 'Update weekend days (Admin only)' })
  async updateWeekends(@Body() dto: UpdateWeekendsDto) {
    return this.calendarService.updateWeekends(dto);
  }

  // Holidays
  @Get('holidays')
  @ApiOperation({ summary: 'List holidays (optionally filter by month yyyy-mm)' })
  @ApiQuery({ name: 'month', required: false, description: 'yyyy-mm' })
  async listHolidays(@Query('month') month?: string) {
    return this.calendarService.listHolidays(month);
  }

  @Post('holidays')
  @Roles('admin')
  @ApiOperation({ summary: 'Create a holiday (Admin only)' })
  async createHoliday(@Body() dto: CreateHolidayDto) {
    return this.calendarService.createHoliday(dto);
  }

  @Put('holidays/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update a holiday (Admin only)' })
  async updateHoliday(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHolidayDto) {
    return this.calendarService.updateHoliday(id, dto);
  }

  @Delete('holidays/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a holiday (Admin only)' })
  async removeHoliday(@Param('id', ParseIntPipe) id: number) {
    return this.calendarService.removeHoliday(id);
  }

  // Working days
  @Get('working-days')
  @ApiOperation({ summary: 'Get effective working days for a month' })
  @ApiQuery({ name: 'month', required: true, description: 'yyyy-mm' })
  async workingDays(@Query('month') month: string) {
    return this.calendarService.workingDays(month);
  }
}
