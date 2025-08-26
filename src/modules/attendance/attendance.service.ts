import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Attendance } from './attendance.model';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { Employee } from '../employees/employees.model';

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function nowTime(): string {
  const d = new Date();
  return d.toTimeString().slice(0, 8); // HH:MM:SS
}

function diffHours(start: string, end: string): number {
  const [sh, sm, ss] = start.split(':').map(Number);
  const [eh, em, es] = end.split(':').map(Number);
  const startMin = sh * 60 + sm + (ss || 0) / 60;
  const endMin = eh * 60 + em + (es || 0) / 60;
  return Math.max(0, (endMin - startMin) / 60);
}

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance) private readonly attendanceModel: typeof Attendance,
    @InjectModel(Employee) private readonly employeeModel: typeof Employee,
  ) {}

  async checkIn(user: { id: string; email: string }, dto: CheckInDto) {
    const date = dto.date || toDateOnly(new Date());
    const checkInTime = dto.checkInTime || nowTime();

    // Try to link employee by email (optional)
    const employee = await this.employeeModel.findOne({ where: { email: user.email } });

    // Upsert attendance record for that date
    let record = await this.attendanceModel.findOne({ where: { userId: user.id, date } });
    if (!record) {
      record = await this.attendanceModel.create({
        userId: user.id,
        employeeId: employee?.id,
        date,
        checkIn: checkInTime,
        status: this.isLate(checkInTime) ? 'late' : 'present',
      } as any);
    } else {
      if (record.checkIn) {
        throw new BadRequestException('Already checked in');
      }
      await record.update({
        checkIn: checkInTime,
        status: this.isLate(checkInTime) ? 'late' : 'present',
      });
    }
    return record;
  }

  async checkOut(user: { id: string }, dto: CheckOutDto) {
    const date = dto.date || toDateOnly(new Date());
    const checkOutTime = dto.checkOutTime || nowTime();

    const record = await this.attendanceModel.findOne({ where: { userId: user.id, date } });
    if (!record) throw new NotFoundException('No check-in found for today');
    if (record.checkOut) throw new BadRequestException('Already checked out');
    const hoursWorked = record.checkIn ? diffHours(record.checkIn, checkOutTime) : null;
    await record.update({ checkOut: checkOutTime, hoursWorked });
    return record;
  }

  async myAttendance(user: { id: string }, from?: string, to?: string) {
    const where: any = { userId: user.id };
    if (from && to) where.date = { [Op.between]: [from, to] };
    else if (from) where.date = { [Op.gte]: from };
    else if (to) where.date = { [Op.lte]: to };

    const rows = await this.attendanceModel.findAll({ where, order: [['date', 'DESC']] });
    return rows;
  }

  async summary(user: { id: string }, range: 'week' | 'month') {
    const today = new Date();
    let start = new Date(today);
    let end = new Date(today);

    if (range === 'week') {
      const day = today.getDay(); // 0=Sun..6=Sat
      const diffToMonday = (day + 6) % 7; // Monday=0
      start.setDate(today.getDate() - diffToMonday);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    } else {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    const from = toDateOnly(start);
    const to = toDateOnly(end);

    const records = await this.attendanceModel.findAll({
      where: { userId: user.id, date: { [Op.between]: [from, to] } },
    });

    const present = records.filter(r => r.checkIn).length;
    const late = records.filter(r => r.status === 'late').length;

    // Approx working days Mon-Fri
    const workingDays = this.countWorkingDays(start, end);
    const absent = Math.max(0, workingDays - present);

    return { from, to, present, late, absent, workingDays };
  }

  private isLate(checkIn: string): boolean {
    // consider late if after 09:15:00
    return checkIn > '09:15:00';
  }

  private countWorkingDays(start: Date, end: Date) {
    const cur = new Date(start);
    let count = 0;
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  // Admin/HR: list all attendance with optional date range
  async listAll(from?: string, to?: string) {
    const where: any = {};
    if (from && to) where.date = { [Op.between]: [from, to] };
    else if (from) where.date = { [Op.gte]: from };
    else if (to) where.date = { [Op.lte]: to };

    const rows = await this.attendanceModel.findAll({
      where,
      include: [{
        model: Employee,
        attributes: ['id', 'name', 'email', 'employeeId', 'department', 'designation'],
      }],
      order: [['date', 'DESC']],
    });
    return rows;
  }

  // DEV ONLY: seed last N weeks with given present counts per week for current user
  async seedLastWeeks(user: { id: string; email?: string }, weeksCounts: number[] = [2, 4, 5, 3]) {
    if (process.env.NODE_ENV === 'production') {
      throw new BadRequestException('Seeding is disabled in production');
    }

    // Helper: get Monday of a week offset (0=current week, 1=last week, ...)
    const mondayOf = (weeksAgo: number) => {
      const today = new Date();
      const day = today.getDay(); // 0..6 Sun..Sat
      const diffToMonday = (day + 6) % 7; // Monday index
      const monday = new Date(today);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(today.getDate() - diffToMonday - weeksAgo * 7);
      return monday;
    };

    // For each target week, create `count` present days on random weekdays (Mon-Fri)
    for (let i = 0; i < Math.min(4, weeksCounts.length); i++) {
      const count = Math.max(0, Math.min(5, Math.floor(weeksCounts[i] || 0)));
      const weekMonday = mondayOf(i);
      const candidates: string[] = [];
      for (let d = 0; d < 5; d++) {
        const date = new Date(weekMonday);
        date.setDate(weekMonday.getDate() + d);
        candidates.push(toDateOnly(date));
      }
      // shuffle
      for (let j = candidates.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [candidates[j], candidates[k]] = [candidates[k], candidates[j]];
      }
      const chosen = candidates.slice(0, count);
      for (const date of chosen) {
        // avoid duplicate create if exists
        const existing = await this.attendanceModel.findOne({ where: { userId: user.id, date } });
        if (existing?.checkIn) continue;
        if (existing) {
          await existing.update({ checkIn: '09:10:00', status: this.isLate('09:10:00') ? 'late' : 'present' });
        } else {
          await this.attendanceModel.create({
            userId: user.id,
            date,
            checkIn: '09:10:00',
            status: this.isLate('09:10:00') ? 'late' : 'present',
          } as any);
        }
      }
    }

    // Return summary of what exists now for those weeks
    const from = toDateOnly(mondayOf(3));
    const to = toDateOnly(new Date());
    const rows = await this.attendanceModel.findAll({ where: { userId: user.id, date: { [Op.between]: [from, to] } }, order: [['date', 'ASC']] });
    return { from, to, count: rows.length, records: rows };
  }
}
