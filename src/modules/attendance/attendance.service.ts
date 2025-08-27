import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Attendance } from './attendance.model';
import { AttendanceSession } from './attendance-session.model';
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
    @InjectModel(AttendanceSession) private readonly sessionModel: typeof AttendanceSession,
    @InjectModel(Employee) private readonly employeeModel: typeof Employee,
  ) {}

  async checkIn(user: { id: string; email: string }, dto: CheckInDto) {
    const date = dto.date || toDateOnly(new Date());
    const checkInTime = dto.checkInTime || nowTime();

    // Try to link employee by email (optional)
    const employee = await this.employeeModel.findOne({ where: { email: user.email } });

    // Upsert parent attendance record
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
      // update earliest checkIn if this is earlier
      if (!record.checkIn || checkInTime < (record.checkIn as string)) {
        await record.update({ checkIn: checkInTime, status: this.isLate(checkInTime) ? 'late' : (record.status || 'present') });
      }
    }

    // Ensure no open session exists for today
    const open = await this.sessionModel.findOne({ where: { userId: user.id, date, endTime: { [Op.is]: null } } });
    if (open) throw new BadRequestException('You already have an active session. Please check out first.');

    // Create a new session
    await this.sessionModel.create({ attendanceId: record.id, userId: user.id, date, startTime: checkInTime } as any);
    return record;
  }

  async checkOut(user: { id: string }, dto: CheckOutDto) {
    const date = dto.date || toDateOnly(new Date());
    const checkOutTime = dto.checkOutTime || nowTime();

    const record = await this.attendanceModel.findOne({ where: { userId: user.id, date } });
    if (!record) throw new NotFoundException('No attendance record for today');

    // Find open session
    const session = await this.sessionModel.findOne({ where: { userId: user.id, date, endTime: { [Op.is]: null } }, order: [['createdAt', 'DESC']] });
    if (!session) throw new BadRequestException('No active session to check out');

    const start = session.startTime as string;
    const duration = diffHours(start, checkOutTime);
    await session.update({ endTime: checkOutTime, hours: duration });

    // Re-aggregate hours from all sessions for today
    const sessions = await this.sessionModel.findAll({ where: { userId: user.id, date } });
    const totalHours = sessions.reduce((sum, s: any) => sum + (Number(s.hours) || 0), 0);
    const lastEnd = sessions.reduce((max, s: any) => (s.endTime && s.endTime > max ? s.endTime : max), record.checkOut || '00:00:00');
    await record.update({ hoursWorked: Number(totalHours.toFixed(2)), checkOut: lastEnd || checkOutTime });
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

  // Build an Excel-compatible CSV report for Admin/HR
  async generateReport(params: { from?: string; to?: string; format?: 'excel' | 'pdf' }) {
    const { from, to, format = 'excel' } = params || {};
    const rows = await this.listAll(from, to);

    const headers = [
      'Employee ID',
      'Name',
      'Department',
      'Date',
      'Check In',
      'Check Out',
      'Status',
      'Hours',
    ];

    const safe = (v: any) => (v === null || v === undefined ? '' : String(v));

    // If PDF requested, generate a paginated table PDF using pdfkit
    if (format === 'pdf') {
      // Lazy require to avoid type issues
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });

      const chunks: Buffer[] = [];
      const stream: NodeJS.WritableStream = doc as any;
      doc.on('data', (c: Buffer) => chunks.push(c));
      const endPromise = new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      // Title
      doc.fontSize(16).text('Attendance Report', { align: 'center' });
      const rangeText = from && to ? `${from} to ${to}` : (from || to || 'All Dates');
      doc.moveDown(0.5).fontSize(10).text(`Range: ${rangeText}`, { align: 'center' });
      doc.moveDown(1);

      // Table layout
      const startX = (doc as any).page.margins?.left ?? 36;
      const startY = 100;
      const rowHeight = 22;
      // Base widths which we will scale to fit page
      const baseWidths = [120, 140, 100, 70, 60, 60, 90, 50]; // ID, Name, Dept, Date, In, Out, Status, Hours
      const pageRightMargin = (doc as any).page.margins?.right ?? 36;
      const pageBottom = doc.page.height - ((doc as any).page.margins?.bottom ?? 36);
      const availableWidth = doc.page.width - startX - pageRightMargin;
      const totalBase = baseWidths.reduce((a, b) => a + b, 0);
      const scale = availableWidth / totalBase;
      const colWidths = baseWidths.map((w) => Math.floor(w * scale));

      const padX = 6;
      const padY = 6;

      // Helper to measure wrapped text height for a cell
      const measureCellHeight = (text: string, width: number, fontSize: number, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
        const h = doc.heightOfString(text || '', { width, align: 'left' });
        return Math.max(h, 10);
      };

      const drawRow = (y: number, cols: string[], opts?: { header?: boolean; zebra?: boolean; index?: number }) => {
        const isHeader = !!opts?.header;
        const rowIndex = opts?.index ?? 0;
        let x = startX;

        // Background fill (header or zebra rows)
        if (isHeader) {
          // compute header height (allow wrapping headers if needed)
          const headerHeights = cols.map((t, i) => measureCellHeight(String(t ?? ''), colWidths[i] - padX * 2, 10, true));
          const rh = Math.max(rowHeight, Math.max(...headerHeights) + padY * 2);
          doc.save().fillColor('#F2F2F2').rect(startX, y - 2, colWidths.reduce((a,b)=>a+b,0), rh).fill().restore();
          // Text
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#111111');
          x = startX;
          cols.forEach((text, idx) => {
            const w = colWidths[idx];
            const available = w - padX * 2;
            doc.text(String(text ?? ''), x + padX, y + padY, { width: available, align: 'left' });
            x += w;
          });
          // Borders
          x = startX;
          doc.strokeColor('#DDDDDD');
          doc.moveTo(x, y - 2).lineTo(x + colWidths.reduce((a,b)=>a+b,0), y - 2).stroke();
          doc.moveTo(x, y - 2 + rh).lineTo(x + colWidths.reduce((a,b)=>a+b,0), y - 2 + rh).stroke();
          for (const w of colWidths) { doc.moveTo(x, y - 2).lineTo(x, y - 2 + rh).stroke(); x += w; }
          return rh;
        } else if (opts?.zebra && rowIndex % 2 === 1) {
          // background will be drawn after height calc
        }

        // Measure dynamic row height based on wrapped content
        const aligns: ('left'|'center'|'right')[] = ['left','left','left','left','center','center','center','right'];
        const heights = cols.map((t, i) => measureCellHeight(String(t ?? ''), colWidths[i] - padX * 2, 9));
        const rh = Math.max(rowHeight, Math.max(...heights) + padY * 2);

        // Background for zebra rows
        if (opts?.zebra && rowIndex % 2 === 1) {
          doc.save().fillColor('#FCFCFC').rect(startX, y - 2, colWidths.reduce((a,b)=>a+b,0), rh).fill().restore();
        }

        // Text
        doc.fontSize(9).font('Helvetica');
        x = startX;
        cols.forEach((text, idx) => {
          const w = colWidths[idx];
          const available = w - padX * 2;
          doc.fillColor('#111111');
          doc.text(String(text ?? ''), x + padX, y + padY, { width: available, align: aligns[idx] });
          x += w;
        });

        // Borders
        x = startX;
        doc.strokeColor('#DDDDDD');
        doc.moveTo(x, y - 2).lineTo(x + colWidths.reduce((a,b)=>a+b,0), y - 2).stroke();
        doc.moveTo(x, y - 2 + rh).lineTo(x + colWidths.reduce((a,b)=>a+b,0), y - 2 + rh).stroke();
        for (const w of colWidths) { doc.moveTo(x, y - 2).lineTo(x, y - 2 + rh).stroke(); x += w; }
        return rh;
      };

      // Header
      let y = startY;
      const headerHeight = drawRow(y, headers, { header: true });
      y += headerHeight;

      // Rows with pagination
      let idx = 0;
      for (const r of rows as any[]) {
        const employee = r.Employee || r.employee || {};
        // Prefer human-readable employeeId; fallback to any internal id; shorten UUID-like only
        let id = safe(employee.employeeId || r.employeeId || employee.id || r.userId || '');
        if (id.length > 12 && /[0-9a-fA-F-]{20,}/.test(id)) id = id.replace(/-/g, '').slice(0, 8);
        const name = safe(employee.name || r.name || '');
        const dept = safe(employee.department || r.department || '');
        const date = safe(r.date || '');
        const checkIn = safe(r.checkIn || '');
        const checkOut = safe(r.checkOut || '');
        const status = safe(r.status || (r.checkIn ? 'present' : 'absent'));
        const hours = safe(r.hoursWorked ?? '');

        // compute height of this row to decide page break
        const probeHeight = ((): number => {
          const heights = [id, name, dept, date, checkIn, checkOut, status, hours].map((t, i) => measureCellHeight(String(t ?? ''), colWidths[i] - padX * 2, 9));
          return Math.max(rowHeight, Math.max(...heights) + padY * 2);
        })();
        if (y + probeHeight > pageBottom) {
          doc.addPage();
          y = startY;
          const hh = drawRow(y, headers, { header: true });
          y += hh;
        }
        const rh = drawRow(y, [id, name, dept, date, checkIn, checkOut, status, hours], { zebra: true, index: idx });
        y += rh;
        idx += 1;
      }

      doc.end();
      const buffer = await endPromise;
      const rangeLabel = from && to ? `${from}_to_${to}` : (from || to || new Date().toISOString().slice(0, 10));
      const filename = `attendance_${rangeLabel}.pdf`;
      const contentType = 'application/pdf';
      return { buffer, filename, contentType };
    }

    // Default: CSV for Excel
    const toCSVRow = (arr: string[]) => arr.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
    const lines: string[] = [];
    lines.push(toCSVRow(headers));
    for (const r of rows as any[]) {
      const employee = r.Employee || r.employee || {};
      const id = safe(employee.employeeId || r.employeeId || employee.id || '');
      const name = safe(employee.name || r.name || '');
      const dept = safe(employee.department || r.department || '');
      const date = safe(r.date || '');
      const checkIn = safe(r.checkIn || '');
      const checkOut = safe(r.checkOut || '');
      const status = safe(r.status || (r.checkIn ? 'present' : 'absent'));
      const hours = safe(r.hoursWorked ?? '');
      lines.push(toCSVRow([id, name, dept, date, checkIn, checkOut, status, hours]));
    }

    const csv = lines.join('\n');
    const buffer = Buffer.from(csv, 'utf-8');
    const rangeLabel = from && to ? `${from}_to_${to}` : (from || to || new Date().toISOString().slice(0, 10));
    const filename = `attendance_${rangeLabel}.csv`;
    const contentType = 'text/csv; charset=utf-8';

    return { buffer, filename, contentType };
  }

  async status(user: { id: string }, date?: string) {
    const day = date || toDateOnly(new Date());
    const [record, openSession, sessions] = await Promise.all([
      this.attendanceModel.findOne({ where: { userId: user.id, date: day } }),
      this.sessionModel.findOne({ where: { userId: user.id, date: day, endTime: { [Op.is]: null } } }),
      this.sessionModel.findAll({ where: { userId: user.id, date: day }, order: [['createdAt', 'ASC']] }),
    ]);
    const activeSession = !!openSession;
    return {
      date: day,
      activeSession,
      sessionStartTime: openSession?.startTime || null,
      attendance: record,
      sessions,
    };
  }

  // Admin/HR: update a specific session's start/end time and re-aggregate parent attendance
  async adminUpdateSession(sessionId: string, data: { startTime?: string; endTime?: string }) {
    if (!sessionId) throw new BadRequestException('sessionId is required');
    const session = await this.sessionModel.findByPk(sessionId);
    if (!session) throw new NotFoundException('Session not found');

    const startTime = data.startTime ?? (session.startTime as string);
    const endTime = data.endTime ?? (session.endTime as string | null);

    // Validate time format HH:MM:SS (basic)
    const isTime = (t?: string | null) => !t || /^\d{2}:\d{2}:\d{2}$/.test(t);
    if (!isTime(startTime) || !isTime(endTime || undefined)) {
      throw new BadRequestException('Time must be HH:MM:SS');
    }

    // Recompute session hours if end exists
    let hours = Number(session.hours) || 0;
    if (endTime) {
      const [sh, sm, ss] = startTime.split(':').map(Number);
      const [eh, em, es] = endTime.split(':').map(Number);
      const startMin = sh * 60 + sm + (ss || 0) / 60;
      const endMin = eh * 60 + em + (es || 0) / 60;
      const diff = Math.max(0, endMin - startMin);
      hours = Number((diff / 60).toFixed(2));
    } else {
      hours = 0;
    }

    await session.update({ startTime, endTime: endTime ?? null, hours });

    // Re-aggregate parent attendance record
    const date = session.date as string;
    const userId = session.userId as string;
    const record = await this.attendanceModel.findOne({ where: { userId, date } });
    if (record) {
      const sessions = await this.sessionModel.findAll({ where: { userId, date } });
      const totalHours = sessions.reduce((sum, s: any) => sum + (Number(s.hours) || 0), 0);
      const firstStart = sessions.reduce((min: string | null, s: any) => {
        const st = s.startTime as string | null;
        if (!st) return min;
        if (!min) return st;
        return st < min ? st : min;
      }, null);
      const lastEnd = sessions.reduce((max: string | null, s: any) => {
        const et = s.endTime as string | null;
        if (!et) return max;
        if (!max) return et;
        return et > max ? et : max;
      }, null);
      await record.update({ hoursWorked: Number(totalHours.toFixed(2)), checkIn: firstStart || record.checkIn, checkOut: lastEnd || record.checkOut });
    }

    return { session, updatedHours: hours };
  }

  // Admin/HR: get status and sessions for a specific user on a date
  async adminStatus(targetUserId: string, date?: string) {
    if (!targetUserId) throw new BadRequestException('userId is required');
    const day = date || toDateOnly(new Date());
    const [record, openSession, sessions] = await Promise.all([
      this.attendanceModel.findOne({ where: { userId: targetUserId, date: day } }),
      this.sessionModel.findOne({ where: { userId: targetUserId, date: day, endTime: { [Op.is]: null } } }),
      this.sessionModel.findAll({ where: { userId: targetUserId, date: day }, order: [['createdAt', 'ASC']] }),
    ]);
    const activeSession = !!openSession;
    return {
      date: day,
      activeSession,
      sessionStartTime: openSession?.startTime || null,
      attendance: record,
      sessions,
    };
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
    cur.setHours(0, 0, 0, 0);
    const last = new Date(end);
    last.setHours(0, 0, 0, 0);
    let count = 0;
    while (cur <= last) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  // Admin/HR: list all attendance with optional date range and status filter (present|late)
  async listAll(from?: string, to?: string, status?: 'present' | 'late') {
    const where: any = {};
    if (from && to) where.date = { [Op.between]: [from, to] };
    else if (from) where.date = { [Op.gte]: from };
    else if (to) where.date = { [Op.lte]: to };

    if (status === 'late') {
      where.status = 'late';
    } else if (status === 'present') {
      where.checkIn = { [Op.not]: null } as any;
      where.status = { [Op.ne]: 'late' } as any;
    }

    const rows = await this.attendanceModel.findAll({
      where,
      include: [{ model: Employee, attributes: ['id', 'name', 'email', 'employeeId', 'department', 'designation'] }],
      order: [['date', 'DESC']],
    });
    return rows;
  }

  // Admin/HR: list all ABSENT employees for a single day by synthesizing rows
  async listAllByStatus(day: string, status: 'absent') {
    if (!day) throw new BadRequestException('day is required');
    // Fetch all employees
    const emps = await this.employeeModel.findAll({ attributes: ['id', 'name', 'email', 'employeeId', 'department', 'designation'] });
    // Fetch any attendance records for that day
    const todays = await this.attendanceModel.findAll({ where: { date: day }, attributes: ['employeeId', 'checkIn'] });
    const presentEmployeeIds = new Set<string>();
    for (const r of todays as any[]) {
      if ((r as any).checkIn) presentEmployeeIds.add(String((r as any).employeeId));
    }

    // Build synthetic absent rows for employees without a check-in
    const rows = (emps as any[])
      .filter((e) => !presentEmployeeIds.has(String(e.id)))
      .map((e) => ({
        id: `abs-${e.id}-${day}`,
        userId: null,
        employeeId: e.id,
        date: day,
        checkIn: null,
        checkOut: null,
        status: 'absent',
        hoursWorked: 0,
        Employee: e,
      }));
    rows.sort((a: any, b: any) => String(a.Employee?.name || '').localeCompare(String(b.Employee?.name || '')));
    return rows as any[];
  }

  // Admin/HR: aggregate current week's attendance per weekday (Mon–Fri)
  async weeklyOverview() {
    // Compute current week's Monday to Sunday range, but only output Mon–Fri
    const today = new Date();
    const day = today.getDay(); // 0..6 (Sun..Sat)
    const diffToMonday = (day + 6) % 7; // Monday index
    const monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(today.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const ymd = (d: Date) => {
      const pad2 = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    };
    const from = ymd(monday);
    const to = ymd(sunday);

    // Determine active employees count; fallback to total if status column unavailable
    let activeEmployees = 0;
    const normalizeCount = (val: any): number => {
      if (Array.isArray(val)) {
        // GroupedCountResultItem[] -> sum counts
        return val.reduce((sum: number, item: any) => sum + Number(item?.count || 0), 0);
      }
      const n = Number(val);
      return Number.isFinite(n) ? n : 0;
    };
    try {
      const c1 = await (this.employeeModel as any).count({ where: { status: 'active' } });
      activeEmployees = normalizeCount(c1);
      if (activeEmployees <= 0) {
        const c2 = await (this.employeeModel as any).count();
        activeEmployees = normalizeCount(c2);
      }
    } catch {
      const c2 = await (this.employeeModel as any).count();
      activeEmployees = normalizeCount(c2);
    }

    // Fetch all attendance records for this week
    const rows = await this.attendanceModel.findAll({
      where: { date: { [Op.between]: [from, to] } },
      attributes: ['userId', 'employeeId', 'date', 'checkIn', 'status'],
      order: [['date', 'ASC']],
    });

    // Helper: label for weekday (server local)
    const dayLabel = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short' });

    // Build Mon–Fri list
    const days: { date: string; name: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      days.push({ date: ymd(dd), name: dayLabel(dd) });
    }

    // Index rows by date
    const byDate = new Map<string, any[]>();
    for (const r of rows as any[]) {
      const key = String((r as any).date);
      const arr = byDate.get(key) || [];
      arr.push(r);
      byDate.set(key, arr);
    }

    const lateCutoff = (process.env.LATE_CUTOFF || '09:15:00').trim();
    const data = days.map(({ date, name }) => {
      const records = byDate.get(date) || [];
      // group records by canonical person id
      const byPerson = new Map<string, any[]>();
      for (const rec of records as any[]) {
        const pid = String(rec.userId || rec.employeeId || '');
        if (!pid) continue;
        const arr = byPerson.get(pid) || [];
        arr.push(rec);
        byPerson.set(pid, arr);
      }

      let present = 0;
      let late = 0;
      for (const [, arr] of byPerson) {
        // present if any row has a checkIn
        const anyCheckIn = arr.some(r => !!r.checkIn);
        if (anyCheckIn) present += 1;
        // late if earliest check-in time is after cutoff (HH:MM:SS)
        const withCheckIn = arr.filter(r => !!r.checkIn);
        if (withCheckIn.length > 0) {
          withCheckIn.sort((a, b) => String(a.checkIn).localeCompare(String(b.checkIn)));
          const first = String(withCheckIn[0].checkIn);
          if (first && first > lateCutoff) late += 1;
        }
      }
      const absent = Math.max(0, activeEmployees - present);
      return { date, name, present, late, absent };
    });

    return { from, to, totalEmployees: activeEmployees, days: data };
  }

  // DEV ONLY: seed last up to 4 weeks with present days according to counts array (length <= 4)
  async seedLastWeeks(user: { id: string; email?: string }, weeksCounts: number[]) {
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    const mondayOf = (weeksAgo: number) => {
      const today = new Date();
      const day = today.getDay(); // 0..6 Sun..Sat
      const diffToMonday = (day + 6) % 7; // Monday index
      const monday = new Date(today);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(today.getDate() - diffToMonday - weeksAgo * 7);
      return monday;
    };

    const maxWeeks = Math.min(4, weeksCounts?.length || 0);
    for (let i = 0; i < maxWeeks; i++) {
      const count = clamp(Math.floor(weeksCounts[i] || 0), 0, 5);
      const weekMonday = mondayOf(i);
      const candidates: string[] = [];
      for (let d = 0; d < 5; d++) {
        const date = new Date(weekMonday);
        date.setDate(weekMonday.getDate() + d);
        candidates.push(toDateOnly(date));
      }
      // shuffle candidates
      for (let j = candidates.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [candidates[j], candidates[k]] = [candidates[k], candidates[j]];
      }
      const chosen = candidates.slice(0, count);
      for (const date of chosen) {
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

    const from = toDateOnly(mondayOf(maxWeeks - 1 >= 0 ? maxWeeks - 1 : 0));
    const to = toDateOnly(new Date());
    const rows = await this.attendanceModel.findAll({ where: { userId: user.id, date: { [Op.between]: [from, to] } }, order: [['date', 'ASC']] });
    return { from, to, count: rows.length };
  }
}
