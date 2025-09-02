import { Injectable } from '@nestjs/common';
import { Op } from 'sequelize';
import { Holiday } from './holiday.model';
import { WeekendSetting } from './weekend-setting.model';
import { CreateHolidayDto, UpdateHolidayDto, UpdateWeekendsDto } from './dto/calendar.dto';

@Injectable()
export class CalendarService {
  async getWeekends(): Promise<number[]> {
    const rec = await WeekendSetting.findOne();
    return rec?.weekends ?? [0, 6];
  }

  async updateWeekends(dto: UpdateWeekendsDto): Promise<{ weekends: number[] }> {
    const existing = await WeekendSetting.findOne();
    if (existing) {
      existing.weekends = dto.weekends;
      await existing.save();
      return { weekends: existing.weekends };
    }
    const created = await WeekendSetting.create({ weekends: dto.weekends });
    return { weekends: created.weekends };
  }

  async listHolidays(month?: string) {
    if (!month) {
      return Holiday.findAll({ where: { isActive: true }, order: [['date', 'ASC']] });
    }
    // month format: yyyy-mm
    const [y, m] = month.split('-').map((v) => parseInt(v, 10));
    const start = new Date(Date.UTC(y, (m - 1), 1));
    const end = new Date(Date.UTC(y, m, 1)); // exclusive next month
    return Holiday.findAll({
      where: {
        isActive: true,
        date: { [Op.gte]: start, [Op.lt]: end },
      },
      order: [['date', 'ASC']],
    });
  }

  async createHoliday(dto: CreateHolidayDto) {
    return Holiday.create({ ...dto, type: dto.type ?? 'public', isActive: true });
  }

  async updateHoliday(id: number, dto: UpdateHolidayDto) {
    const h = await Holiday.findByPk(id);
    if (!h) return null;
    if (dto.date !== undefined) h.date = dto.date as any;
    if (dto.name !== undefined) h.name = dto.name;
    if (dto.type !== undefined) h.type = dto.type as any;
    await h.save();
    return h;
  }

  async removeHoliday(id: number) {
    const h = await Holiday.findByPk(id);
    if (!h) return null;
    await h.destroy();
    return { success: true };
  }

  async workingDays(month: string): Promise<{ month: string; workingDays: number }> {
    const weekends = await this.getWeekends();
    const [y, m] = month.split('-').map((v) => parseInt(v, 10));
    const start = new Date(Date.UTC(y, (m - 1), 1));
    const end = new Date(Date.UTC(y, m, 1));

    const holidays = await Holiday.findAll({
      where: {
        isActive: true,
        date: { [Op.gte]: start, [Op.lt]: end },
      },
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
