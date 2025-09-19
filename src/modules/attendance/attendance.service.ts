import { InjectModel } from '@nestjs/sequelize';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
import { Attendance } from './attendance.model';
import { AttendanceSession } from './attendance-session.model';
import { User } from '../users/users.model';
import { Employee } from '../employees/employees.model';
import { AddEmployeeAttendanceDto } from './dto/add-employee-attendance.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';

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
    @InjectModel(Attendance)
    private readonly attendanceModel: typeof Attendance,
    @InjectModel(AttendanceSession)
    private readonly sessionModel: typeof AttendanceSession,
    @InjectModel(Employee) private readonly employeeModel: typeof Employee,
  ) {}

  async checkIn(user: { id: string; email: string }, dto: CheckInDto, tenantId: string) {
    const date = dto.date || toDateOnly(new Date());
    const checkInTime = dto.checkInTime || nowTime();

    // Try to link employee by email (tenant-scoped)
    const employee = await this.employeeModel.findOne({
      where: { 
        email: user.email,
        tenantId: tenantId 
      },
    });

    // Upsert parent attendance record (tenant-scoped)
    let record = await this.attendanceModel.findOne({
      where: { 
        userId: user.id, 
        date,
        tenantId: tenantId 
      },
    });
    if (!record) {
      record = await this.attendanceModel.create({
        userId: user.id,
        employeeId: employee?.id,
        date,
        checkIn: checkInTime,
        status: this.isLate(checkInTime) ? 'late' : 'present',
        tenantId: tenantId,
      } as any);
    } else {
      // update earliest checkIn if this is earlier
      if (!record.checkIn || checkInTime < record.checkIn) {
        await record.update({
          checkIn: checkInTime,
          status: this.isLate(checkInTime)
            ? 'late'
            : record.status || 'present',
        });
      }
    }

    // Ensure no open session exists for today (tenant-scoped)
    const open = await this.sessionModel.findOne({
      where: { 
        userId: user.id, 
        date, 
        endTime: { [Op.is]: null },
        tenantId: tenantId 
      },
    });
    if (open)
      throw new BadRequestException(
        'You already have an active session. Please check out first.',
      );

    // Create a new session (with tenantId)
    await this.sessionModel.create({
      attendanceId: record.id,
      userId: user.id,
      date,
      startTime: checkInTime,
      tenantId: tenantId,
    } as any);
    return record;
  }

  async checkOut(user: { id: string }, dto: CheckOutDto, tenantId: string) {
    const date = dto.date || toDateOnly(new Date());
    const checkOutTime = dto.checkOutTime || nowTime();

    const record = await this.attendanceModel.findOne({
      where: { 
        userId: user.id, 
        date,
        tenantId: tenantId 
      },
    });
    if (!record) throw new NotFoundException('No attendance record for today');

    // Find open session (tenant-scoped)
    const session = await this.sessionModel.findOne({
      where: { 
        userId: user.id, 
        date, 
        endTime: { [Op.is]: null },
        tenantId: tenantId 
      },
      order: [['createdAt', 'DESC']],
    });
    if (!session)
      throw new BadRequestException('No active session to check out');

    const start = session.startTime;
    const duration = diffHours(start, checkOutTime);
    await session.update({ endTime: checkOutTime, hours: duration });

    // Re-aggregate hours from all sessions for today
    const sessions = await this.sessionModel.findAll({
      where: { userId: user.id, date },
    });
    const totalHours = sessions.reduce(
      (sum, s: any) => sum + (Number(s.hours) || 0),
      0,
    );
    const lastEnd = sessions.reduce(
      (max, s: any) => (s.endTime && s.endTime > max ? s.endTime : max),
      record.checkOut || '00:00:00',
    );
    await record.update({
      hoursWorked: Number(totalHours.toFixed(2)),
      checkOut: lastEnd || checkOutTime,
    });
    return record;
  }

  async myAttendance(user: { id: string; email?: string }, from?: string, to?: string, tenantId?: string) {
    // First, find the employee record for this user (tenant-scoped)
    const employeeWhere: any = { email: user.email };
    if (tenantId) {
      employeeWhere.tenantId = tenantId;
    }
    
    const employee = await this.employeeModel.findOne({
      where: employeeWhere
    });

    // Build date filter
    const dateFilter: any = {};
    if (from && to) dateFilter.date = { [Op.between]: [from, to] };
    else if (from) dateFilter.date = { [Op.gte]: from };
    else if (to) dateFilter.date = { [Op.lte]: to };

    // Add tenant filter to date filter
    if (tenantId) {
      dateFilter.tenantId = tenantId;
    }

    // Build where clause to include both self-created and HR/Admin-created records
    const where: any = {
      [Op.or]: [
        { userId: user.id, ...dateFilter },
        ...(employee ? [{ employeeId: employee.id, ...dateFilter }] : [])
      ]
    };

    const rows = await this.attendanceModel.findAll({
      where,
      order: [['date', 'DESC']],
      include: [
        {
          model: this.employeeModel,
          as: 'employee',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });
    return rows;
  }

  // Build an Excel-compatible CSV report for Admin/HR
  async generateReport(params: {
    from?: string;
    to?: string;
    format?: 'excel' | 'pdf';
  }) {
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

      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 36,
      });

      const chunks: Buffer[] = [];
      const stream: NodeJS.WritableStream = doc;
      doc.on('data', (c: Buffer) => chunks.push(c));
      const endPromise = new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      // Title
      doc.fontSize(16).text('Attendance Report', { align: 'center' });
      const rangeText =
        from && to ? `${from} to ${to}` : from || to || 'All Dates';
      doc
        .moveDown(0.5)
        .fontSize(10)
        .text(`Range: ${rangeText}`, { align: 'center' });
      doc.moveDown(1);

      // Table layout
      const startX = doc.page.margins?.left ?? 36;
      const startY = 100;
      const rowHeight = 22;
      // Base widths which we will scale to fit page
      const baseWidths = [120, 140, 100, 70, 60, 60, 90, 50]; // ID, Name, Dept, Date, In, Out, Status, Hours
      const pageRightMargin = doc.page.margins?.right ?? 36;
      const pageBottom = doc.page.height - (doc.page.margins?.bottom ?? 36);
      const availableWidth = doc.page.width - startX - pageRightMargin;
      const totalBase = baseWidths.reduce((a, b) => a + b, 0);
      const scale = availableWidth / totalBase;
      const colWidths = baseWidths.map((w) => Math.floor(w * scale));

      const padX = 6;
      const padY = 6;

      // Helper to measure wrapped text height for a cell
      const measureCellHeight = (
        text: string,
        width: number,
        fontSize: number,
        bold = false,
      ) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
        const h = doc.heightOfString(text || '', { width, align: 'left' });
        return Math.max(h, 10);
      };

      const drawRow = (
        y: number,
        cols: string[],
        opts?: { header?: boolean; zebra?: boolean; index?: number },
      ) => {
        const isHeader = !!opts?.header;
        const rowIndex = opts?.index ?? 0;
        let x = startX;

        // Background fill (header or zebra rows)
        if (isHeader) {
          // compute header height (allow wrapping headers if needed)
          const headerHeights = cols.map((t, i) =>
            measureCellHeight(
              String(t ?? ''),
              colWidths[i] - padX * 2,
              10,
              true,
            ),
          );
          const rh = Math.max(rowHeight, Math.max(...headerHeights) + padY * 2);
          doc
            .save()
            .fillColor('#F2F2F2')
            .rect(
              startX,
              y - 2,
              colWidths.reduce((a, b) => a + b, 0),
              rh,
            )
            .fill()
            .restore();
          // Text
          doc.fontSize(10).font('Helvetica-Bold').fillColor('#111111');
          x = startX;
          cols.forEach((text, idx) => {
            const w = colWidths[idx];
            const available = w - padX * 2;
            doc.text(String(text ?? ''), x + padX, y + padY, {
              width: available,
              align: 'left',
            });
            x += w;
          });
          // Borders
          x = startX;
          doc.strokeColor('#DDDDDD');
          doc
            .moveTo(x, y - 2)
            .lineTo(x + colWidths.reduce((a, b) => a + b, 0), y - 2)
            .stroke();
          doc
            .moveTo(x, y - 2 + rh)
            .lineTo(x + colWidths.reduce((a, b) => a + b, 0), y - 2 + rh)
            .stroke();
          for (const w of colWidths) {
            doc
              .moveTo(x, y - 2)
              .lineTo(x, y - 2 + rh)
              .stroke();
            x += w;
          }
          return rh;
        } else if (opts?.zebra && rowIndex % 2 === 1) {
          // background will be drawn after height calc
        }

        // Measure dynamic row height based on wrapped content
        const aligns: ('left' | 'center' | 'right')[] = [
          'left',
          'left',
          'left',
          'left',
          'center',
          'center',
          'center',
          'right',
        ];
        const heights = cols.map((t, i) =>
          measureCellHeight(String(t ?? ''), colWidths[i] - padX * 2, 9),
        );
        const rh = Math.max(rowHeight, Math.max(...heights) + padY * 2);

        // Background for zebra rows
        if (opts?.zebra && rowIndex % 2 === 1) {
          doc
            .save()
            .fillColor('#FCFCFC')
            .rect(
              startX,
              y - 2,
              colWidths.reduce((a, b) => a + b, 0),
              rh,
            )
            .fill()
            .restore();
        }

        // Text
        doc.fontSize(9).font('Helvetica');
        x = startX;
        cols.forEach((text, idx) => {
          const w = colWidths[idx];
          const available = w - padX * 2;
          doc.fillColor('#111111');
          doc.text(String(text ?? ''), x + padX, y + padY, {
            width: available,
            align: aligns[idx],
          });
          x += w;
        });

        // Borders
        x = startX;
        doc.strokeColor('#DDDDDD');
        doc
          .moveTo(x, y - 2)
          .lineTo(x + colWidths.reduce((a, b) => a + b, 0), y - 2)
          .stroke();
        doc
          .moveTo(x, y - 2 + rh)
          .lineTo(x + colWidths.reduce((a, b) => a + b, 0), y - 2 + rh)
          .stroke();
        for (const w of colWidths) {
          doc
            .moveTo(x, y - 2)
            .lineTo(x, y - 2 + rh)
            .stroke();
          x += w;
        }
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
        let id = safe(
          employee.employeeId || r.employeeId || employee.id || r.userId || '',
        );
        if (id.length > 12 && /[0-9a-fA-F-]{20,}/.test(id))
          id = id.replace(/-/g, '').slice(0, 8);
        const name = safe(employee.name || r.name || '');
        const dept = safe(employee.department || r.department || '');
        const date = safe(r.date || '');
        const checkIn = safe(r.checkIn || '');
        const checkOut = safe(r.checkOut || '');
        const status = safe(r.status || (r.checkIn ? 'present' : 'absent'));
        const hours = safe(r.hoursWorked ?? '');

        // compute height of this row to decide page break
        const probeHeight = ((): number => {
          const heights = [
            id,
            name,
            dept,
            date,
            checkIn,
            checkOut,
            status,
            hours,
          ].map((t, i) =>
            measureCellHeight(String(t ?? ''), colWidths[i] - padX * 2, 9),
          );
          return Math.max(rowHeight, Math.max(...heights) + padY * 2);
        })();
        if (y + probeHeight > pageBottom) {
          doc.addPage();
          y = startY;
          const hh = drawRow(y, headers, { header: true });
          y += hh;
        }
        const rh = drawRow(
          y,
          [id, name, dept, date, checkIn, checkOut, status, hours],
          { zebra: true, index: idx },
        );
        y += rh;
        idx += 1;
      }

      doc.end();
      const buffer = await endPromise;
      const rangeLabel =
        from && to
          ? `${from}_to_${to}`
          : from || to || new Date().toISOString().slice(0, 10);
      const filename = `attendance_${rangeLabel}.pdf`;
      const contentType = 'application/pdf';
      return { buffer, filename, contentType };
    }

    // Default: CSV for Excel
    const toCSVRow = (arr: string[]) =>
      arr.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
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
      lines.push(
        toCSVRow([id, name, dept, date, checkIn, checkOut, status, hours]),
      );
    }

    const csv = lines.join('\n');
    const buffer = Buffer.from(csv, 'utf-8');
    const rangeLabel =
      from && to
        ? `${from}_to_${to}`
        : from || to || new Date().toISOString().slice(0, 10);
    const filename = `attendance_${rangeLabel}.csv`;
    const contentType = 'text/csv; charset=utf-8';

    return { buffer, filename, contentType };
  }

  async status(user: { id: string }, date?: string) {
    const day = date || toDateOnly(new Date());
    
    // Find the employee record to get employeeId for HR/Admin added attendance
    const employee = await this.employeeModel.findOne({
      where: { id: user.id }
    });

    // Build where clauses to handle both employee self-punched and HR/Admin added attendance
    const attendanceWhere = {
      [Op.or]: [
        { userId: user.id, date: day },
        ...(employee ? [{ employeeId: employee.id, date: day }] : [])
      ]
    };

    // Find the attendance record first
    const record = await this.attendanceModel.findOne({
      where: attendanceWhere,
    });

    let openSession: any = null;
    let sessions: any[] = [];

    if (record) {
      // If we found an attendance record, find sessions linked to it
      const sessionWhere = {
        [Op.and]: [
          { date: day },
          {
            [Op.or]: [
              { userId: user.id }, // Employee self-punched sessions
              { attendanceId: record.id }, // Sessions linked to this attendance record
              ...(employee ? [{ userId: employee.id }] : []) // HR/Admin added sessions
            ]
          }
        ]
      };

      [openSession, sessions] = await Promise.all([
        this.sessionModel.findOne({
          where: {
            ...sessionWhere,
            endTime: { [Op.is]: null }
          },
        }),
        this.sessionModel.findAll({
          where: sessionWhere,
          order: [['createdAt', 'ASC']],
        }),
      ]);
    }

    const activeSession = !!openSession;
    
    // If there's no active session but there are completed sessions or attendance record,
    // the employee should still be able to check out (for cases where HR/Admin added attendance)
    const hasAttendanceToday = !!record;
    const hasCompletedSessions = sessions.length > 0 && sessions.some(s => s.endTime);
    
    return {
      date: day,
      activeSession,
      sessionStartTime: openSession?.startTime || (sessions.length > 0 ? sessions[0].startTime : null),
      attendance: record,
      sessions,
      hasAttendanceToday, // New field to indicate if employee has attendance for today
      hasCompletedSessions, // New field to indicate if there are completed sessions
    };
  }

  // Admin/HR: update a specific session's start/end time and re-aggregate parent attendance
  async adminUpdateSession(
    sessionId: string,
    data: { startTime?: string; endTime?: string },
  ) {
    if (!sessionId) throw new BadRequestException('sessionId is required');
    const session = await this.sessionModel.findByPk(sessionId);
    if (!session) throw new NotFoundException('Session not found');

    const startTime = data.startTime ?? session.startTime;
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
    const date = session.date;
    const userId = session.userId;
    const record = await this.attendanceModel.findOne({
      where: { userId, date },
    });
    if (record) {
      const sessions = await this.sessionModel.findAll({
        where: { userId, date },
      });
      const totalHours = sessions.reduce(
        (sum, s: any) => sum + (Number(s.hours) || 0),
        0,
      );
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
      await record.update({
        hoursWorked: Number(totalHours.toFixed(2)),
        checkIn: firstStart || record.checkIn,
        checkOut: lastEnd || record.checkOut,
      });
    }

    return { session, updatedHours: hours };
  }

  // Admin/HR: get status and sessions for a specific user on a date
  async adminStatus(targetUserId: string, date?: string, tenantId?: string) {
    if (!targetUserId) throw new BadRequestException('userId is required');
    const day = date || toDateOnly(new Date());
    
    console.log(`🔍 DEBUG adminStatus: targetUserId=${targetUserId}, date=${day}, tenantId=${tenantId}`);
    
    // First, find the employee record to get employeeId (tenant-scoped)
    const employeeWhere: any = { id: targetUserId };
    if (tenantId) {
      employeeWhere.tenantId = tenantId;
    }
    
    const employee = await this.employeeModel.findOne({
      where: employeeWhere
    });
    
    console.log(`🔍 DEBUG employee found:`, employee?.id);

    // Build where clauses to handle both employee self-punched and HR/Admin added attendance (tenant-scoped)
    const baseFilter = tenantId ? { tenantId } : {};
    const attendanceWhere = {
      [Op.or]: [
        { userId: targetUserId, date: day, ...baseFilter },
        ...(employee ? [{ employeeId: employee.id, date: day, ...baseFilter }] : [])
      ]
    };
    
    console.log(`🔍 DEBUG attendanceWhere:`, JSON.stringify(attendanceWhere, null, 2));

    // Find the attendance record first
    const record = await this.attendanceModel.findOne({
      where: attendanceWhere,
    });
    
    console.log(`🔍 DEBUG attendance record found:`, record?.id, record?.employeeId, record?.userId);

    let openSession: any = null;
    let sessions: any[] = [];

    if (record) {
      // If we found an attendance record, find sessions linked to it (tenant-scoped)
      // This handles both employee self-punched and HR/Admin added attendance
      const sessionWhere = {
        [Op.and]: [
          { date: day, ...baseFilter }, // Include tenant filter
          {
            [Op.or]: [
              { userId: targetUserId }, // Employee self-punched sessions
              { attendanceId: record.id }, // Sessions linked to this attendance record
              ...(employee ? [{ userId: employee.id }] : []) // HR/Admin added sessions
            ]
          }
        ]
      };
      
      console.log(`🔍 DEBUG sessionWhere:`, JSON.stringify(sessionWhere, null, 2));

      [openSession, sessions] = await Promise.all([
        this.sessionModel.findOne({
          where: {
            ...sessionWhere,
            endTime: { [Op.is]: null }
          },
        }),
        this.sessionModel.findAll({
          where: sessionWhere,
          order: [['createdAt', 'ASC']],
        }),
      ]);
      
      console.log(`🔍 DEBUG sessions found:`, sessions.length, sessions.map(s => ({ id: s.id, userId: s.userId, attendanceId: s.attendanceId })));
    }
    
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

    const present = records.filter((r) => r.checkIn).length;
    const late = records.filter((r) => r.status === 'late').length;

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
  async listAll(from?: string, to?: string, status?: 'present' | 'late', tenantId?: string) {
    const where: any = {};
    
    // Add tenant filtering
    if (tenantId) {
      where.tenantId = tenantId;
    }
    
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
      include: [
        {
          model: Employee,
          attributes: [
            'id',
            'name',
            'email',
            'employeeId',
            'department',
            'designation',
          ],
          where: tenantId ? { tenantId } : undefined, // Filter employees by tenant too
        },
      ],
      order: [['date', 'DESC']],
    });
    return rows;
  }

  // Admin/HR: list all ABSENT employees for a single day by synthesizing rows
  async listAllByStatus(day: string, status: 'absent', tenantId?: string) {
    if (!day) throw new BadRequestException('day is required');
    
    // Fetch all employees (tenant-scoped)
    const employeeWhere: any = {};
    if (tenantId) {
      employeeWhere.tenantId = tenantId;
    }
    
    const emps = await this.employeeModel.findAll({
      where: employeeWhere,
      attributes: [
        'id',
        'name',
        'email',
        'employeeId',
        'department',
        'designation',
      ],
    });
    
    // Fetch any attendance records for that day (tenant-scoped)
    const attendanceWhere: any = { date: day };
    if (tenantId) {
      attendanceWhere.tenantId = tenantId;
    }
    
    const todays = await this.attendanceModel.findAll({
      where: attendanceWhere,
      attributes: ['employeeId', 'checkIn'],
    });
    const presentEmployeeIds = new Set<string>();
    for (const r of todays as any[]) {
      if (r.checkIn) presentEmployeeIds.add(String(r.employeeId));
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
    rows.sort((a: any, b: any) =>
      String(a.Employee?.name || '').localeCompare(
        String(b.Employee?.name || ''),
      ),
    );
    return rows as any[];
  }

  // Admin/HR: aggregate current week's attendance per weekday (Mon–Fri)
  async weeklyOverview(tenantId?: string) {
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
        return val.reduce(
          (sum: number, item: any) => sum + Number(item?.count || 0),
          0,
        );
      }
      const n = Number(val);
      return Number.isFinite(n) ? n : 0;
    };
    try {
      const employeeWhere: any = { status: 'active' };
      if (tenantId) {
        employeeWhere.tenantId = tenantId;
      }
      
      const c1 = await (this.employeeModel as any).count({
        where: employeeWhere,
      });
      activeEmployees = normalizeCount(c1);
      if (activeEmployees <= 0) {
        const fallbackWhere = tenantId ? { tenantId } : {};
        const c2 = await (this.employeeModel as any).count({
          where: fallbackWhere,
        });
        activeEmployees = normalizeCount(c2);
      }
    } catch {
      const fallbackWhere = tenantId ? { tenantId } : {};
      const c2 = await (this.employeeModel as any).count({
        where: fallbackWhere,
      });
      activeEmployees = normalizeCount(c2);
    }

    // Fetch all attendance records for this week (tenant-scoped)
    const attendanceWhere: any = { date: { [Op.between]: [from, to] } };
    if (tenantId) {
      attendanceWhere.tenantId = tenantId;
    }
    
    const rows = await this.attendanceModel.findAll({
      where: attendanceWhere,
      attributes: ['userId', 'employeeId', 'date', 'checkIn', 'status'],
      order: [['date', 'ASC']],
    });

    // Helper: label for weekday (server local)
    const dayLabel = (d: Date) =>
      d.toLocaleDateString('en-US', { weekday: 'short' });

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
      const key = String(r.date);
      const arr = byDate.get(key) || [];
      arr.push(r);
      byDate.set(key, arr);
    }

    const lateCutoff = (process.env.LATE_CUTOFF || '09:15:00').trim();
    const data = days.map(({ date, name }) => {
      const records = byDate.get(date) || [];
      // group records by canonical person id
      const byPerson = new Map<string, any[]>();
      for (const rec of records) {
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
        const anyCheckIn = arr.some((r) => !!r.checkIn);
        if (anyCheckIn) present += 1;
        // late if earliest check-in time is after cutoff (HH:MM:SS)
        const withCheckIn = arr.filter((r) => !!r.checkIn);
        if (withCheckIn.length > 0) {
          withCheckIn.sort((a, b) =>
            String(a.checkIn).localeCompare(String(b.checkIn)),
          );
          const first = String(withCheckIn[0].checkIn);
          if (first && first > lateCutoff) late += 1;
        }
      }
      const absent = Math.max(0, activeEmployees - present);
      return { date, name, present, late, absent };
    });

    return { from, to, totalEmployees: activeEmployees, days: data };
  }

  // Get total present and absent days for a specific employee
  async getEmployeeAttendanceSummary(
    employeeId: string,
    from?: string,
    to?: string,
    tenantId?: string,
  ) {
    console.log('🔍 DEBUG getEmployeeAttendanceSummary - targetEmployeeId:', employeeId);
    
    // Find employee to get associated user (same pattern as leave service)
    let employee;
    try {
      // Try to find by employeeId (string) first (tenant-scoped)
      employee = await this.employeeModel.findOne({
        where: { 
          employeeId,
          tenantId: tenantId 
        },
        include: [{ model: User, as: 'user' }]
      });
    } catch (error) {
      console.error('🚨 ERROR finding employee by employeeId:', error);
    }

    if (!employee) {
      // Fallback: try to find by UUID if the employeeId looks like a UUID (tenant-scoped)
      try {
        employee = await this.employeeModel.findOne({
          where: { 
            id: employeeId,
            tenantId: tenantId 
          },
          include: [{ model: User, as: 'user' }]
        });
      } catch (error) {
        console.error('🚨 ERROR finding employee by UUID:', error);
      }
    }

    if (!employee) {
      throw new NotFoundException(`Employee not found with ID: ${employeeId}`);
    }

    console.log('🔍 DEBUG - Employee found:', {
      employeeId: employee.employeeId,
      employeeName: employee.name,
      userId: employee.user?.id,
      userEmail: employee.user?.email
    });

    // Build date filter
    const dateFilter: any = {};
    if (from && to) {
      dateFilter.date = { [Op.between]: [from, to] };
    } else if (from) {
      dateFilter.date = { [Op.gte]: from };
    } else if (to) {
      dateFilter.date = { [Op.lte]: to };
    }

    // Query attendance using userId (UUID) instead of employeeId (string) (tenant-scoped)
    const whereClause: any = {
      userId: employee.user?.id,
      ...dateFilter
    };
    
    // Add tenant filtering
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    console.log('🔍 DEBUG - Query whereClause:', whereClause);

    // Get all attendance records for the employee
    const attendanceRecords = await this.attendanceModel.findAll({
      where: whereClause,
      attributes: ['date', 'status', 'checkIn'],
    });

    console.log('🔍 DEBUG - Attendance records found:', attendanceRecords.length);

    // Count present days (including late)
    const presentDays = attendanceRecords.filter(
      record => record.checkIn && (record.status === 'present' || record.status === 'late')
    ).length;

    // Calculate total working days in the period
    let totalWorkingDays = 0;
    if (from && to) {
      totalWorkingDays = this.countWorkingDays(new Date(from), new Date(to));
    } else {
      // If no date range specified, use current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      totalWorkingDays = this.countWorkingDays(startOfMonth, endOfMonth);
    }

    const absentDays = Math.max(0, totalWorkingDays - presentDays);
    const lateDays = attendanceRecords.filter(record => record.status === 'late').length;

    return {
      employeeId,
      period: { from: from || 'current_month', to: to || 'current_month' },
      totalWorkingDays,
      presentDays,
      absentDays,
      lateDays,
      attendancePercentage: totalWorkingDays > 0 ? ((presentDays / totalWorkingDays) * 100).toFixed(2) : '0.00'
    };
  }

  // Get overall company attendance statistics
  async getOverallAttendanceStats(from?: string, to?: string, tenantId?: string) {
    const whereClause: any = {};
    
    if (from && to) {
      whereClause.date = { [Op.between]: [from, to] };
    } else if (from) {
      whereClause.date = { [Op.gte]: from };
    } else if (to) {
      whereClause.date = { [Op.lte]: to };
    }
    
    // Add tenant filtering
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    // Get all employees (tenant-scoped)
    const employeeWhere = tenantId ? { tenantId } : {};
    const totalEmployees = await this.employeeModel.count({
      where: employeeWhere,
    });

    // Get attendance records (tenant-scoped)
    const attendanceRecords = await this.attendanceModel.findAll({
      where: whereClause,
      attributes: ['employeeId', 'date', 'status', 'checkIn'],
    });

    // Group by date to calculate daily statistics
    const dailyStats = new Map<string, { present: Set<string>, late: Set<string> }>();
    
    attendanceRecords.forEach(record => {
      if (!record.checkIn) return; // Skip records without check-in
      
      const date = record.date;
      if (!dailyStats.has(date)) {
        dailyStats.set(date, { present: new Set(), late: new Set() });
      }
      
      const dayStats = dailyStats.get(date)!;
      if (record.employeeId) {
        dayStats.present.add(record.employeeId);
        
        if (record.status === 'late') {
          dayStats.late.add(record.employeeId);
        }
      }
    });

    // Calculate averages
    let totalPresentDays = 0;
    let totalLateDays = 0;
    let totalAbsentDays = 0;
    let workingDaysCount = 0;

    dailyStats.forEach((dayStats, date) => {
      const presentCount = dayStats.present.size;
      const lateCount = dayStats.late.size;
      const absentCount = Math.max(0, totalEmployees - presentCount);
      
      totalPresentDays += presentCount;
      totalLateDays += lateCount;
      totalAbsentDays += absentCount;
      workingDaysCount++;
    });

    const avgPresentPerDay = workingDaysCount > 0 ? (totalPresentDays / workingDaysCount).toFixed(2) : '0.00';
    const avgAbsentPerDay = workingDaysCount > 0 ? (totalAbsentDays / workingDaysCount).toFixed(2) : '0.00';
    const avgLatePerDay = workingDaysCount > 0 ? (totalLateDays / workingDaysCount).toFixed(2) : '0.00';

    return {
      period: { from: from || 'all_time', to: to || 'current_date' },
      totalEmployees,
      workingDaysAnalyzed: workingDaysCount,
      totalPresentDays,
      totalAbsentDays,
      totalLateDays,
      averages: {
        presentPerDay: parseFloat(avgPresentPerDay),
        absentPerDay: parseFloat(avgAbsentPerDay),
        latePerDay: parseFloat(avgLatePerDay)
      },
      attendanceRate: totalEmployees > 0 && workingDaysCount > 0 
        ? ((totalPresentDays / (totalEmployees * workingDaysCount)) * 100).toFixed(2) 
        : '0.00'
    };
  }

  // Get attendance statistics by date range with daily breakdown
  async getAttendanceStatsByDateRange(from: string, to: string, tenantId?: string) {
    const whereClause: any = {
      date: { [Op.between]: [from, to] }
    };
    
    // Add tenant filtering
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    
    const attendanceRecords = await this.attendanceModel.findAll({
      where: whereClause,
      include: [{
        model: this.employeeModel,
        attributes: ['id', 'firstName', 'lastName', 'email'],
        where: tenantId ? { tenantId } : undefined, // Filter employees by tenant too
      }],
      attributes: ['employeeId', 'date', 'status', 'checkIn', 'checkOut', 'hoursWorked'],
      order: [['date', 'ASC']]
    });

    // Get total active employees (tenant-scoped)
    const employeeWhere = tenantId ? { tenantId } : {};
    const totalEmployees = await this.employeeModel.count({
      where: employeeWhere,
    });

    // Group by date
    const dailyBreakdown = new Map<string, {
      date: string,
      present: number,
      absent: number,
      late: number,
      presentEmployees: any[],
      absentEmployees: string[]
    }>();

    // Initialize all dates in range
    const startDate = new Date(from);
    const endDate = new Date(to);
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = toDateOnly(d);
      // Skip weekends (assuming Monday-Friday work week)
      if (d.getDay() !== 0 && d.getDay() !== 6) {
        dailyBreakdown.set(dateStr, {
          date: dateStr,
          present: 0,
          absent: totalEmployees,
          late: 0,
          presentEmployees: [],
          absentEmployees: []
        });
      }
    }

    // Process attendance records
    const presentEmployeesByDate = new Map<string, Set<string>>();
    
    attendanceRecords.forEach(record => {
      if (!record.checkIn || !record.employeeId) return;
      
      const date = record.date;
      if (!presentEmployeesByDate.has(date)) {
        presentEmployeesByDate.set(date, new Set());
      }
      presentEmployeesByDate.get(date)!.add(record.employeeId);
      
      const dayData = dailyBreakdown.get(date);
      if (dayData) {
        const totalHours = record.hoursWorked || 0;
        const weeklyHours = 40; // Assuming 40 hours per week
        const averageHours = totalHours / weeklyHours;
        const overtimeHours = totalHours > weeklyHours ? totalHours - weeklyHours : 0;

        dayData.presentEmployees.push({
          employeeId: record.employeeId,
          status: record.status,
          checkIn: record.checkIn,
          checkOut: record.checkOut,
          totalHours: totalHours.toFixed(2),
          weeklyHours: weeklyHours.toFixed(2),
          averageHours: averageHours.toFixed(2),
          overtimeHours: overtimeHours > 0 ? overtimeHours.toFixed(2) : '0.00',
        });
        
        if (record.status === 'late') {
          dayData.late++;
        }
      }
    });

    // Convert map to array
    const dailyArray = Array.from(dailyBreakdown.values());

    return {
      period: { from, to },
      totalEmployees,
      dailyBreakdown: dailyArray
    };
  }

  // DEV ONLY: seed last up to 4 weeks with present days according to counts array (length <= 4)
  async seedLastWeeks(
    user: { id: string; email?: string },
    weeksCounts: number[],
  ) {
    const clamp = (n: number, min: number, max: number) =>
      Math.max(min, Math.min(max, n));
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
        const existing = await this.attendanceModel.findOne({
          where: { userId: user.id, date },
        });
        if (existing?.checkIn) continue;
        if (existing) {
          await existing.update({
            checkIn: '09:10:00',
            status: this.isLate('09:10:00') ? 'late' : 'present',
          });
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
    const rows = await this.attendanceModel.findAll({
      where: { userId: user.id, date: { [Op.between]: [from, to] } },
      order: [['date', 'ASC']],
    });
    return { from, to, count: rows.length };
  }

  async addEmployeeAttendance(
    attendanceData: AddEmployeeAttendanceDto,
    user: { id: string; role: string },
    tenantId: string,
  ) {
    try {
      console.log('🔍 DEBUG: addEmployeeAttendance called with:', { attendanceData, user });
      const { employeeId, date, checkIn, checkOut, description } = attendanceData;

      // Validate employee exists - handle both string employeeId and UUID lookups
      console.log('🔍 DEBUG: Looking for employee with ID:', employeeId);
      let employee;
      try {
        // Try to find by employeeId (string) first
        employee = await this.employeeModel.findOne({
          where: { employeeId },
          include: [{ model: User, as: 'user' }]
        });
      } catch (error) {
        console.error('🚨 ERROR finding employee by employeeId:', error);
      }

      if (!employee) {
        // Fallback: try to find by UUID if the employeeId looks like a UUID
        try {
          employee = await this.employeeModel.findOne({
            where: { id: employeeId },
            include: [{ model: User, as: 'user' }]
          });
        } catch (error) {
          console.error('🚨 ERROR finding employee by UUID:', error);
        }
      }

      if (!employee) {
        throw new BadRequestException(`Employee not found with ID: ${employeeId}`);
      }

      console.log('🔍 DEBUG - Employee found:', {
        employeeId: employee.employeeId,
        employeeName: employee.name,
        userId: employee.user?.id,
        userEmail: employee.user?.email
      });

    // Check if attendance record already exists for this date (tenant-scoped)
    const existingRecord = await this.attendanceModel.findOne({
      where: {
        userId: employee.user?.id, // Use UUID instead of string employeeId
        date,
        tenantId: tenantId,
      },
    });

    if (existingRecord) {
      throw new BadRequestException(
        `Attendance record already exists for ${employee.name} on ${date}`,
      );
    }

    // Validate date format and ensure it's not in the future
    const attendanceDate = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (attendanceDate > today) {
      throw new BadRequestException('Cannot add attendance for future dates');
    }

    // Calculate status based on check-in time and company policy
    let status = 'present';
    const checkInTime = new Date(`${date}T${checkIn}`);
    const workStartTime = new Date(`${date}T09:00:00`); // Assuming 9 AM start time

    if (checkInTime > workStartTime) {
      status = 'late';
    }

    // Calculate hours worked if check-out is provided
    let hoursWorked = null;
    if (checkOut) {
      const checkOutTime = new Date(`${date}T${checkOut}`);
      const diffMs = checkOutTime.getTime() - checkInTime.getTime();
      hoursWorked = Math.max(0, diffMs / (1000 * 60 * 60)); // Convert to hours
    }

    // Create attendance record (with tenantId)
    const attendanceRecord = await this.attendanceModel.create({
      employeeId: employee.id, // Use employee UUID, not string employeeId
      userId: employee.user?.id, // Use employee's user UUID
      date,
      checkIn,
      checkOut: checkOut || null,
      status,
      hoursWorked,
      notes: description || `Added by ${user.role.toUpperCase()}: ${user.id}`,
      tenantId: tenantId,
    });

    console.log('🔍 DEBUG - Attendance record created:', {
      id: attendanceRecord.id,
      employeeId: attendanceRecord.employeeId,
      userId: attendanceRecord.userId,
      date: attendanceRecord.date
    });

    // Create session record to match the behavior of employee self-punch (with tenantId)
    // This ensures the attendance details popup shows session information
    const sessionData: any = {
      attendanceId: attendanceRecord.id,
      userId: employee.user?.id, // Use employee's user UUID, not string employeeId
      date,
      startTime: checkIn,
      tenantId: tenantId,
    };

    // If check-out time is provided, create a completed session
    if (checkOut) {
      sessionData.endTime = checkOut;
      // Calculate session hours
      const startTime = new Date(`${date}T${checkIn}`);
      const endTime = new Date(`${date}T${checkOut}`);
      const diffMs = endTime.getTime() - startTime.getTime();
      sessionData.hours = Math.max(0, diffMs / (1000 * 60 * 60)); // Convert to hours
    }

    console.log(`🔍 DEBUG addEmployeeAttendance - Creating session:`, JSON.stringify(sessionData, null, 2));

    // Create the session record
    const createdSession = await this.sessionModel.create(sessionData);
    
    console.log(`🔍 DEBUG addEmployeeAttendance - Session created:`, createdSession.id, createdSession.userId, createdSession.attendanceId);

    // Return the created record with employee details
    const recordWithEmployee = await this.attendanceModel.findByPk(
      attendanceRecord.id,
      {
        include: [
          {
            model: this.employeeModel,
            as: 'employee',
            attributes: ['id', 'name', 'email'],
          },
        ],
      },
    );

    return {
      success: true,
      message: `Attendance record added successfully for ${employee.name}`,
      data: recordWithEmployee,
    };
    } catch (error) {
      console.error('🚨 ERROR in addEmployeeAttendance:', error);
      console.error('🚨 ERROR Stack:', error.stack);
      throw error;
    }
  }

  async getAttendanceForDate(user: { id: string; email: string; role: string }, date: string, tenantId?: string) {
    try {
      // First, find the employee record for this user (tenant-scoped)
      const employeeWhere: any = { email: user.email };
      if (tenantId) {
        employeeWhere.tenantId = tenantId;
      }
      
      const employee = await this.employeeModel.findOne({
        where: employeeWhere
      });

      if (!employee) {
        return {
          success: false,
          message: 'Employee record not found',
        };
      }

      // Find attendance record for the user on the specified date (tenant-scoped)
      // Check both userId (for self-created records) and employeeId (for HR/Admin-created records)
      const baseFilter = tenantId ? { tenantId } : {};
      const attendanceRecord = await this.attendanceModel.findOne({
        where: {
          [Op.or]: [
            { userId: user.id, date: date, ...baseFilter },
            { employeeId: employee.id, date: date, ...baseFilter }
          ]
        },
        include: [
          {
            model: this.employeeModel,
            as: 'employee',
            attributes: ['id', 'name', 'email'],
          },
        ],
      });

      if (attendanceRecord) {
        // User was present - return punch in/out details
        return {
          success: true,
          status: 'present',
          data: {
            date: attendanceRecord.date,
            checkIn: attendanceRecord.checkIn,
            checkOut: attendanceRecord.checkOut,
            status: attendanceRecord.status,
            hoursWorked: attendanceRecord.hoursWorked,
          },
          message: `Attendance details for ${date}`,
        };
      } else {
        // No attendance record found - user was absent
        // Check if there's a leave record for this date (optional enhancement)
        return {
          success: true,
          status: 'absent',
          data: {
            date: date,
            message: 'On Leave / Absent',
          },
          message: `No attendance record found for ${date}`,
        };
      }
    } catch (error) {
      console.error('🚨 ERROR in getAttendanceForDate:', error);
      throw error;
    }
  }
}
