import { Injectable, Logger } from '@nestjs/common';
import { Op } from 'sequelize';
import { Holiday } from './holiday.model';
import { WeekendSetting } from './weekend-setting.model';
import { CreateHolidayDto, UpdateHolidayDto, UpdateWeekendsDto } from './dto/calendar.dto';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  // Tenant-aware weekend settings
  async getWeekends(tenantId?: string): Promise<number[]> {
    const whereClause = tenantId ? { tenantId } : {};
    const rec = await WeekendSetting.findOne({ where: whereClause });
    return rec?.weekends ?? [0, 6];
  }

  async updateWeekends(dto: UpdateWeekendsDto, tenantId: string): Promise<{ weekends: number[] }> {
    this.logger.log(`Updating weekends for tenant: ${tenantId}`);
    
    const existing = await WeekendSetting.findOne({ where: { tenantId } });
    if (existing) {
      existing.weekends = dto.weekends;
      await existing.save();
      return { weekends: existing.weekends };
    }
    
    const created = await WeekendSetting.create({ 
      weekends: dto.weekends,
      tenantId: tenantId 
    });
    return { weekends: created.weekends };
  }

  // Tenant-aware holiday listing
  async listHolidays(tenantId?: string, month?: string) {
    const whereClause: any = { isActive: true };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    if (!month) {
      return Holiday.findAll({ where: whereClause, order: [['date', 'ASC']] });
    }
    
    // month format: yyyy-mm
    const [y, m] = month.split('-').map((v) => parseInt(v, 10));
    const start = new Date(Date.UTC(y, (m - 1), 1));
    const end = new Date(Date.UTC(y, m, 1)); // exclusive next month
    
    whereClause.date = { [Op.gte]: start, [Op.lt]: end };
    
    return Holiday.findAll({
      where: whereClause,
      order: [['date', 'ASC']],
    });
  }

  // Tenant-aware holiday creation
  async createHoliday(dto: CreateHolidayDto, tenantId: string) {
    this.logger.log(`Creating holiday for tenant: ${tenantId}`);
    return Holiday.create({ 
      ...dto, 
      type: dto.type ?? 'public', 
      isActive: true,
      tenantId: tenantId 
    });
  }

  // Tenant-aware holiday update
  async updateHoliday(id: number, dto: UpdateHolidayDto, tenantId?: string) {
    const whereClause: any = { id };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    const h = await Holiday.findOne({ where: whereClause });
    if (!h) return null;
    
    if (dto.date !== undefined) h.date = dto.date as any;
    if (dto.name !== undefined) h.name = dto.name;
    if (dto.type !== undefined) h.type = dto.type as any;
    await h.save();
    return h;
  }

  // Tenant-aware holiday removal
  async removeHoliday(id: number, tenantId?: string) {
    const whereClause: any = { id };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    const h = await Holiday.findOne({ where: whereClause });
    if (!h) return null;
    await h.destroy();
    return { success: true };
  }

  // Tenant-aware working days calculation
  async workingDays(month: string, tenantId?: string): Promise<{ month: string; workingDays: number }> {
    const weekends = await this.getWeekends(tenantId);
    const [y, m] = month.split('-').map((v) => parseInt(v, 10));
    const start = new Date(Date.UTC(y, (m - 1), 1));
    const end = new Date(Date.UTC(y, m, 1));

    const whereClause: any = {
      isActive: true,
      date: { [Op.gte]: start, [Op.lt]: end },
    };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    const holidays = await Holiday.findAll({
      where: whereClause,
    });
    const holidaySet = new Set(holidays.map((h) => String(h.date)));

    let count = 0;
    for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = d.getUTCDay();
      const iso = d.toISOString().slice(0, 10);
      if (weekends.includes(day)) continue;
      if (holidaySet.has(iso)) continue;
      count += 1;
    }
    return { month, workingDays: count };
  }
}
