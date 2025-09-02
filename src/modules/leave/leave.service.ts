import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { LeaveRequest, LeaveApprover, LeaveCc, LeaveStatusHistory } from './leave.model';
import { LeaveStatus } from './leave.types';
import { LeaveCredit, LeaveCreditConfig } from './leave-credit.model';
// Leave DTOs are now imported from their respective files
import { CreateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';
import { User } from '../users/users.model';
import { Employee } from '../employees/employees.model';
import { CompensatoryLeaveService } from './compensatory-leave.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);
  constructor(
    @InjectModel(LeaveRequest)
    private leaveRequestModel: typeof LeaveRequest,
    @InjectModel(LeaveApprover)
    private leaveApproverModel: typeof LeaveApprover,
    @InjectModel(LeaveCc)
    private leaveCcModel: typeof LeaveCc,
    @InjectModel(LeaveStatusHistory)
    private leaveStatusHistoryModel: typeof LeaveStatusHistory,
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
    @InjectModel(LeaveCredit)
    private leaveCreditModel: typeof LeaveCredit,
    @InjectModel(LeaveCreditConfig)
    private leaveCreditConfigModel: typeof LeaveCreditConfig,
  ) {}

  async createLeaveRequest(employeeId: string, createLeaveDto: CreateLeaveDto) {
    const { toEmployees, ccEmployees, ...leaveData } = createLeaveDto;
    this.logger.log(
      `POST /leave requested by employeeId=${employeeId} | payload=${JSON.stringify({
        ...leaveData,
        toCount: toEmployees?.length || 0,
        ccCount: ccEmployees?.length || 0,
      })}`
    );

    try {
      // Validate TO employees exist
      const toEmployeesExist = await this.employeeModel.findAll({
        where: { id: { [Op.in]: toEmployees } },
      });

      if (toEmployeesExist.length !== toEmployees.length) {
        this.logger.warn('Validation failed: One or more TO employees not found');
        throw new BadRequestException('One or more TO employees not found');
      }


      // Validate CC employees exist (if provided)
      if (ccEmployees && ccEmployees.length > 0) {
        const ccEmployeesExist = await this.employeeModel.findAll({
          where: { id: { [Op.in]: ccEmployees } },
        });

        if (ccEmployeesExist.length !== ccEmployees.length) {
          this.logger.warn('Validation failed: One or more CC employees not found');
          throw new BadRequestException('One or more CC employees not found');
        }
      }

      // Create leave request
      const leaveRequest = await this.leaveRequestModel.create({
        ...leaveData,
        employeeId,
        status: 'pending',
      });

      // Create TO approvers
      const approverPromises = toEmployees.map((empId) =>
        this.leaveApproverModel.create({
          leaveRequestId: leaveRequest.id,
          employeeId: empId,
          status: 'pending',
        })
      );

      // Create CC entries
      const ccPromises =
        ccEmployees?.map((empId) =>
          this.leaveCcModel.create({
            leaveRequestId: leaveRequest.id,
            employeeId: empId,
            isRead: false,
          })
        ) || [];

      // Create initial status history
      const statusHistoryPromise = this.leaveStatusHistoryModel.create({
        leaveRequestId: leaveRequest.id,
        status: 'pending',
        changedBy: employeeId,
        changedAt: new Date(),
        comments: 'Leave request submitted',
      });

      await Promise.all([...approverPromises, ...ccPromises, statusHistoryPromise]);

      this.logger.log(`Leave request created successfully id=${leaveRequest.id}`);
      return this.getLeaveRequestById(leaveRequest.id);
    } catch (error) {
      this.logger.error(
        `Error creating leave request for employeeId=${employeeId}: ${error?.message}`,
        error?.stack
      );
      throw error;
    }
  }

  async getLeaveRequests(employeeId: string, userRole: string) {
    let whereClause: any = {};

    if (userRole === 'employee') {
      // Employee can only see their own requests
      whereClause.employeeId = employeeId;
    } else if (userRole === 'admin') {
      // Admin can see all requests
      whereClause = {};
    }

    return this.leaveRequestModel.findAll({
      where: whereClause,
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'name', 'email', 'employeeId']
        },
        {
          model: Employee,
          as: 'approver',
          attributes: ['id', 'name', 'email', 'employeeId']
        },
        {
          model: LeaveApprover,
          as: 'toEmployees',
          include: [{
            model: Employee,
            attributes: ['id', 'name', 'email', 'employeeId']
          }]
        },
        {
          model: LeaveCc,
          as: 'ccEmployees',
          include: [{
            model: Employee,
            attributes: ['id', 'name', 'email', 'employeeId']
          }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async getLeaveRequestsMentions(employeeId: string) {
    // Union of requests where user is approver (TO) or in CC, for ALL statuses
    this.logger.log(`GET /leave/mentions | employeeId=${employeeId}`);
    try {
      const [asApprover, asCc] = await Promise.all([
        this.leaveRequestModel.findAll({
          include: [
            {
              model: Employee,
              as: 'employee',
              attributes: ['id', 'name', 'email', 'employeeId']
            },
            {
              model: LeaveApprover,
              as: 'toEmployees',
              where: { employeeId },
              include: [{
                model: Employee,
                attributes: ['id', 'name', 'email', 'employeeId']
              }]
            },
            {
              model: LeaveCc,
              as: 'ccEmployees',
              include: [{
                model: Employee,
                attributes: ['id', 'name', 'email', 'employeeId']
              }]
            }
          ],
          order: [['createdAt', 'DESC']]
        }),
        this.leaveRequestModel.findAll({
          include: [
            {
              model: Employee,
              as: 'employee',
              attributes: ['id', 'name', 'email', 'employeeId']
            },
            {
              model: LeaveApprover,
              as: 'toEmployees',
              include: [{
                model: Employee,
                attributes: ['id', 'name', 'email', 'employeeId']
              }]
            },
            {
              model: LeaveCc,
              as: 'ccEmployees',
              where: { employeeId },
              include: [{
                model: Employee,
                attributes: ['id', 'name', 'email', 'employeeId']
              }]
            }
          ],
          order: [['createdAt', 'DESC']]
        })
      ]);

      const map = new Map<string, any>();
      for (const lr of [...asApprover, ...asCc]) {
        if (lr?.id) map.set(lr.id, lr);
      }
      const merged = Array.from(map.values());
      merged.sort((a: any, b: any) => {
        const ad = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bd = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bd - ad;
      });
      return merged;
    } catch (error) {
      this.logger.error(`GET /leave/mentions failed: ${error?.message}`, error?.stack);
      throw error;
    }
  }

  async getLeaveRequestsForApproval(approverId: string) {
    // Get leave requests where user is in TO list
    return this.leaveRequestModel.findAll({
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'name', 'email', 'employeeId']
        },
        {
          model: LeaveApprover,
          as: 'toEmployees',
          where: { employeeId: approverId, status: 'pending' },
          include: [{
            model: Employee,
            attributes: ['id', 'name', 'email', 'employeeId']
          }]
        },
        {
          model: LeaveCc,
          as: 'ccEmployees',
          include: [{
            model: Employee,
            attributes: ['id', 'name', 'email', 'employeeId']
          }]
        }
      ],
      where: { status: 'pending' },
      order: [['createdAt', 'DESC']]
    });
  }

  async getLeaveRequestsForCC(ccEmployeeId: string) {
    // Get leave requests where user is in CC list
    return this.leaveRequestModel.findAll({
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'name', 'email', 'employeeId']
        },
        {
          model: LeaveApprover,
          as: 'toEmployees',
          include: [{
            model: Employee,
            attributes: ['id', 'name', 'email', 'employeeId']
          }]
        },
        {
          model: LeaveCc,
          as: 'ccEmployees',
          where: { employeeId: ccEmployeeId },
          include: [{
            model: Employee,
            attributes: ['id', 'name', 'email', 'employeeId']
          }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async getLeaveRequestById(id: string) {
    const leaveRequest = await this.leaveRequestModel.findByPk(id, {
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'name', 'email', 'employeeId']
        },
        {
          model: Employee,
          as: 'approver',
          attributes: ['id', 'name', 'email', 'employeeId']
        },
        {
          model: LeaveApprover,
          as: 'toEmployees',
          include: [{
            model: Employee,
            attributes: ['id', 'name', 'email', 'employeeId']
          }]
        },
        {
          model: LeaveCc,
          as: 'ccEmployees',
          include: [{
            model: Employee,
            attributes: ['id', 'name', 'email', 'employeeId']
          }]
        },
        {
          model: LeaveStatusHistory,
          as: 'statusHistory',
          include: [{
            model: Employee,
            as: 'changedByEmployee',
            attributes: ['id', 'name', 'email', 'employeeId']
          }],
          order: [['changedAt', 'DESC']]
        }
      ]
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    return leaveRequest;
  }

  async updateLeaveStatus(
    leaveRequestId: string,
    approverId: string,
    updateStatusDto: UpdateLeaveStatusDto
  ) {
    const leaveRequest = await this.getLeaveRequestById(leaveRequestId);

    // Check if user is authorized to approve this request
    const approver = await this.leaveApproverModel.findOne({
      where: {
        leaveRequestId,
        employeeId: approverId,
        status: 'pending'
      }
    });

    if (!approver) {
      throw new ForbiddenException('You are not authorized to approve this leave request');
    }

    // Update leave request status
    await leaveRequest.update({
      status: updateStatusDto.status,
      approvedBy: approverId,
      approvedAt: new Date(),
      comments: updateStatusDto.comments
    });

    // Update approver status
    await approver.update({
      status: updateStatusDto.status,
      comments: updateStatusDto.comments,
      actionAt: new Date()
    });

    // Create status history entry
    await this.leaveStatusHistoryModel.create({
      leaveRequestId,
      status: updateStatusDto.status,
      changedBy: approverId,
      changedAt: new Date(),
      comments: updateStatusDto.comments || `Leave ${updateStatusDto.status}`
    });

    return this.getLeaveRequestById(leaveRequestId);
  }

  async markCCAsRead(leaveRequestId: string, ccEmployeeId: string) {
    const ccEntry = await this.leaveCcModel.findOne({
      where: {
        leaveRequestId,
        employeeId: ccEmployeeId
      }
    });

    if (!ccEntry) {
      throw new NotFoundException('CC entry not found');
    }

    await ccEntry.update({
      isRead: true,
      readAt: new Date()
    });

    return { message: 'Marked as read' };
  }

  async deleteLeaveRequest(id: string, employeeId: string, userRole: string) {
    const leaveRequest = await this.getLeaveRequestById(id);

    // Only employee who created the request or admin can delete
    if (userRole !== 'admin' && leaveRequest.employeeId !== employeeId) {
      throw new ForbiddenException('You can only delete your own leave requests');
    }

    // Can only delete pending requests
    if (leaveRequest.status !== 'pending') {
      throw new BadRequestException('Can only delete pending leave requests');
    }

    // Delete related records first
    await Promise.all([
      this.leaveApproverModel.destroy({ where: { leaveRequestId: id } }),
      this.leaveCcModel.destroy({ where: { leaveRequestId: id } }),
      this.leaveStatusHistoryModel.destroy({ where: { leaveRequestId: id } })
    ]);

    // Delete leave request
    await leaveRequest.destroy();

    return { message: 'Leave request deleted successfully' };
  }

  async cancelLeaveRequest(id: string, employeeId: string, comments?: string) {
    const leaveRequest = await this.getLeaveRequestById(id);

    // Only the employee who created the request can cancel
    if (leaveRequest.employeeId !== employeeId) {
      throw new ForbiddenException('You can only cancel your own leave requests');
    }

    // Can only cancel pending requests
    if (leaveRequest.status !== 'pending') {
      throw new BadRequestException('Can only cancel pending leave requests');
    }

    // Update leave request to cancelled
    await leaveRequest.update({
      status: 'cancelled' as any,
      comments: comments || 'Cancelled by requester',
      approvedBy: null,
      approvedAt: null,
    });

    // Create status history entry
    await this.leaveStatusHistoryModel.create({
      leaveRequestId: id,
      status: 'cancelled' as any,
      changedBy: employeeId,
      changedAt: new Date(),
      comments: comments || 'Leave cancelled by requester',
    });

    return this.getLeaveRequestById(id);
  }

  async getLeaveBalance(employeeId: string) {
    // DOJ-based monthly accrual using LeaveCreditConfig
    // 1) Get employee DOJ
    const employee = await this.employeeModel.findByPk(employeeId, { attributes: ['id', 'joiningDate'], raw: true });
    if (!employee?.joiningDate) {
      throw new NotFoundException('Employee or joiningDate not found');
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const doj = new Date(employee.joiningDate as unknown as string);
    // Accrual begins from the later of DOJ or Jan 1 of current year
    const accrualStart = doj > startOfYear ? new Date(doj.getFullYear(), doj.getMonth(), 1) : startOfYear;

    // Calculate eligible months from accrualStart to current month inclusive
    const monthsEligible = (() => {
      // If DOJ is in the future relative to now within the same year, zero
      if (accrualStart > now) return 0;
      const startY = accrualStart.getFullYear();
      const startM = accrualStart.getMonth();
      const endY = now.getFullYear();
      const endM = now.getMonth();
      return (endY - startY) * 12 + (endM - startM) + 1; // inclusive months
    })();

    // 2) Get active credit configs
    const configs = await this.leaveCreditConfigModel.findAll({
      where: { isActive: true },
      attributes: ['leaveType', 'monthlyCredit', 'maxAnnualLimit'],
      raw: true,
      order: [['leaveType', 'ASC']],
    });

    // 3) Compute used days (approved leaves within current year, clamped within the year)
    const approvedLeaves = await this.leaveRequestModel.findAll({
      where: { employeeId, status: 'approved' },
      attributes: ['leaveType', 'startDate', 'endDate'],
      raw: true,
    });

    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
    const dayMs = 24 * 60 * 60 * 1000;

    const usedByType: Record<string, number> = {};
    for (const lr of approvedLeaves) {
      const type = (lr as any).leaveType as string;
      if (!type) continue;
      const s = new Date((lr as any).startDate);
      const e = new Date((lr as any).endDate);
      // clamp to current year window
      const clampedStart = s < yearStart ? yearStart : s;
      const clampedEnd = e > yearEnd ? yearEnd : e;
      if (clampedEnd < clampedStart) continue;
      const days = Math.floor((clampedEnd.getTime() - clampedStart.getTime()) / dayMs) + 1; // inclusive
      usedByType[type] = (usedByType[type] || 0) + days;
    }

    // 4) Build raw totals by type from configs; if no configs, fall back to zeros
    const balance: Record<string, { total: number; used: number; remaining: number }> = {};
    for (const cfg of configs) {
      const type = String((cfg as any).leaveType || '').toLowerCase();
      const monthly = Number((cfg as any).monthlyCredit ?? 0) || 0;
      const maxAnnual = (cfg as any).maxAnnualLimit != null ? Number((cfg as any).maxAnnualLimit) : null;

      let total = Number((monthsEligible * monthly).toFixed(2));
      if (maxAnnual != null) total = Math.min(total, maxAnnual);
      const used = Number(usedByType[type] || 0);
      balance[type] = { total, used, remaining: 0 } as any; // remaining computed after cascading
    }

    // 5) Cascading deduction: each type consumes its own total first, then borrows from 'annual', remainder becomes LWP
    const ANNUAL_KEY = 'annual';
    const types = Object.keys(balance);
    const hasAnnual = types.includes(ANNUAL_KEY);
    let annualTotal = hasAnnual ? Number(balance[ANNUAL_KEY].total || 0) : 0;
    let annualUsedDirect = Number(usedByType[ANNUAL_KEY] || 0);
    let annualRemaining = Math.max(0, Number((annualTotal - annualUsedDirect).toFixed(2)));
    let lwp = 0;

    for (const type of types) {
      if (type === ANNUAL_KEY) continue;
      const total = Number(balance[type].total || 0);
      const used = Number(balance[type].used || 0);
      // Consume own bucket first
      const ownCovered = Math.min(used, total);
      const overflow = Math.max(0, used - ownCovered);
      // Borrow overflow from annual
      const borrowFromAnnual = Math.min(overflow, annualRemaining);
      annualRemaining = Number((annualRemaining - borrowFromAnnual).toFixed(2));
      const stillUncovered = Math.max(0, overflow - borrowFromAnnual);
      lwp += stillUncovered; // remainder becomes LWP

      // Remaining for this type is what's left in its own bucket after covering own used
      const remaining = Math.max(0, Number((total - used).toFixed(2)));
      balance[type].remaining = remaining;
    }

    // Now compute annual's remaining considering direct annual used plus any borrowed
    // Borrowed amount = (original annualTotal - annualUsedDirect) - annualRemaining
    const annualBorrowed = Math.max(0, Number(((annualTotal - annualUsedDirect) - annualRemaining).toFixed(2)));
    if (hasAnnual) {
      const annualUsedCombined = Number((annualUsedDirect + annualBorrowed).toFixed(2));
      balance[ANNUAL_KEY].used = annualUsedCombined;
      balance[ANNUAL_KEY].remaining = Math.max(0, Number((annualTotal - annualUsedCombined).toFixed(2)));
    }

    // 6) Expose LWP as a virtual type in the balance map
    if (lwp > 0) {
      balance['lwp'] = { total: 0, used: Number(lwp.toFixed(2)), remaining: 0 };
    }

    return balance;
  }

  // Leave Credit Configuration Methods
  async configureLeaveCreditConfig(configData: any) {
    const leaveType = String(configData.leaveType).toLowerCase();
    const monthlyCredit = Number(configData.monthlyCredit);
    const isActive = configData.isActive !== false;

    if (!leaveType || Number.isNaN(monthlyCredit)) {
      throw new BadRequestException('leaveType and monthlyCredit are required');
    }

    // Upsert by unique leaveType
    const [record, created] = await this.leaveCreditConfigModel.findOrCreate({
      where: { leaveType },
      defaults: { leaveType, monthlyCredit, isActive },
    });

    if (!created) {
      await record.update({ monthlyCredit, isActive });
    }

    // Refetch to ensure all fields are populated from DB
    const saved = await this.leaveCreditConfigModel.findOne({
      where: { leaveType },
      attributes: ['leaveType', 'monthlyCredit', 'isActive', 'updatedAt', 'createdAt'],
      raw: true,
    });
    if (!saved) {
      throw new NotFoundException('Failed to persist configuration');
    }
    return {
      leaveType: saved.leaveType,
      monthlyCredit: saved.monthlyCredit as unknown as number,
      isActive: saved.isActive as unknown as boolean,
      updatedAt: saved.updatedAt as unknown as Date,
      createdAt: saved.createdAt as unknown as Date,
    };
  }

  async getLeaveCreditConfigs() {
    const rows = await this.leaveCreditConfigModel.findAll({
      attributes: ['leaveType', 'monthlyCredit', 'isActive'],
      order: [['leaveType', 'ASC']],
      raw: true,
    });
    return rows.map((r: any) => ({
      leaveType: r.leaveType,
      monthlyCredit: r.monthlyCredit != null ? Number(r.monthlyCredit) : 0,
      isActive: !!r.isActive,
    }));
  }

  async updateLeaveCreditConfig(leaveType: string, updateData: any) {
    const key = String(leaveType).toLowerCase();
    const record = await this.leaveCreditConfigModel.findOne({ where: { leaveType: key } });
    if (!record) {
      throw new NotFoundException('Configuration not found');
    }

    const update: Partial<LeaveCreditConfig> = {} as any;
    if (updateData.monthlyCredit !== undefined) {
      const val = Number(updateData.monthlyCredit);
      if (Number.isNaN(val)) throw new BadRequestException('monthlyCredit must be a number');
      (update as any).monthlyCredit = val;
    }
    if (updateData.isActive !== undefined) {
      (update as any).isActive = !!updateData.isActive;
    }

    await record.update(update as any);

    const saved = await this.leaveCreditConfigModel.findOne({
      where: { leaveType: key },
      attributes: ['leaveType', 'monthlyCredit', 'isActive', 'updatedAt'],
      raw: true,
    });
    if (!saved) {
      throw new NotFoundException('Failed to fetch updated configuration');
    }
    return {
      leaveType: saved.leaveType,
      monthlyCredit: saved.monthlyCredit != null ? Number(saved.monthlyCredit) : 0,
      isActive: !!saved.isActive,
      updatedAt: saved.updatedAt as unknown as Date,
    };
  }

  async manualCreditLeave(creditData: any) {
    // TODO: Store credit in database when models are integrated
    const credit = {
      employeeId: creditData.employeeId,
      leaveType: creditData.leaveType,
      amount: creditData.amount,
      description: creditData.description || 'Manual credit by admin',
      creditDate: new Date()
    };
    
    this.logger.log(`Manual leave credit: ${JSON.stringify(credit)}`);
    return credit;
  }

  async triggerMonthlyCredits() {
    // TODO: Implement monthly crediting logic when models are integrated
    this.logger.log('Monthly credit processing triggered');
    return { message: 'Monthly credit processing completed', processedEmployees: 0 };
  }

  async getEmployeeCreditHistory(employeeId: string, year?: number) {
    // TODO: Fetch from database when models are integrated
    // For now, return mock data
    return [
      {
        leaveType: 'annual',
        amount: 1.67,
        creditDate: new Date(),
        description: 'Monthly credit - 1.67 annual leaves'
      }
    ];
  }

  async getLeaveStatistics(employeeId?: string) {
    let whereClause: any = {};
    
    if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    const [total, pending, approved, rejected] = await Promise.all([
      this.leaveRequestModel.count({ where: whereClause }),
      this.leaveRequestModel.count({ where: { ...whereClause, status: 'pending' } }),
      this.leaveRequestModel.count({ where: { ...whereClause, status: 'approved' } }),
      this.leaveRequestModel.count({ where: { ...whereClause, status: 'rejected' } })
    ]);

    return {
      total,
      pending,
      approved,
      rejected
    };
  }

  // Compute monthly deducted (paid leave) and LWP for a date range
  async getMonthlyLedger(employeeId: string, from?: string, to?: string) {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), 0, 1); // Jan 1 current year
    const defaultTo = new Date(now.getFullYear(), now.getMonth(), 1); // cap at current month start

    const start = from ? new Date(from) : defaultFrom;
    const endInput = to ? new Date(to) : new Date(now.getFullYear(), 11, 31);
    // cap to current month start to avoid future months
    const end = endInput > defaultTo ? defaultTo : new Date(endInput.getFullYear(), endInput.getMonth(), 1);
    // IMPORTANT: For DB filtering, include the ENTIRE capped end month
    const endBoundary = new Date(end.getFullYear(), end.getMonth() + 1, 0, 23, 59, 59, 999);

    // Fetch approved leaves for employee intersecting the window (quick filter by year span)
    const approved = await this.leaveRequestModel.findAll({
      where: {
        employeeId,
        status: 'approved',
        // broad filter by dates overlapping range
        [Op.or]: [
          { startDate: { [Op.between]: [start, endBoundary] } },
          { endDate:   { [Op.between]: [start, endBoundary] } },
          { startDate: { [Op.lte]: start }, endDate: { [Op.gte]: endBoundary } },
        ] as any,
      },
      attributes: ['leaveType', 'startDate', 'endDate'],
      raw: true,
    });

    // Helpers
    const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth()+n, 1);

    // Initialize months map from start..end inclusive
    const months: string[] = [];
    {
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
      while (cursor <= endMonth) {
        months.push(ym(cursor));
        cursor.setMonth(cursor.getMonth()+1);
      }
    }

    const deducted: Record<string, number> = {};
    const lwp: Record<string, number> = {};

    // Get current leave balance to determine paid vs LWP deduction
    const currentBalance = await this.getLeaveBalance(employeeId);
    
    const dayMs = 24*60*60*1000;
    for (const rec of approved as any[]) {
      const type = String(rec.leaveType || '').toLowerCase();
      const isLwpType = (type === 'lwp' || type === 'leave without pay' || type === 'leavewithoutpay');
      
      // Clamp leave to [start, endLastDay]
      const s0 = new Date(rec.startDate);
      const e0 = new Date(rec.endDate);
      // Normalize to midnight
      s0.setHours(0,0,0,0);
      e0.setHours(0,0,0,0);
      // Clamp to requested window
      const s = s0 < start ? new Date(start) : s0;
      const endLastDay = new Date(end.getFullYear(), end.getMonth()+1, 0); // end of capped month
      const e = e0 > endLastDay ? endLastDay : e0;
      if (e < s) continue;

      // Calculate total days for this leave request
      const totalDays = Math.floor((e.getTime() - s.getTime()) / dayMs) + 1;
      
      // Determine how much should be paid vs LWP based on balance
      let paidDays = 0;
      let lwpDays = 0;
      
      if (isLwpType) {
        // Explicitly LWP type - all days are LWP
        lwpDays = totalDays;
      } else {
        // Check if employee has sufficient balance for this leave type
        const typeBalance = currentBalance[type];
        const availableBalance = typeBalance ? typeBalance.remaining : 0;
        const annualBalance = currentBalance['annual'] ? currentBalance['annual'].remaining : 0;
        const totalAvailable = availableBalance + annualBalance;
        
        if (totalDays <= totalAvailable) {
          // Sufficient balance - all paid
          paidDays = totalDays;
        } else {
          // Insufficient balance - partial paid, remainder LWP
          paidDays = Math.max(0, totalAvailable);
          lwpDays = totalDays - paidDays;
        }
      }

      // Iterate months spanned by [s,e] and distribute days proportionally
      let mCursor = new Date(s.getFullYear(), s.getMonth(), 1);
      const mEnd = new Date(e.getFullYear(), e.getMonth(), 1);
      while (mCursor <= mEnd) {
        const key = ym(mCursor);
        const monthStart = new Date(mCursor.getFullYear(), mCursor.getMonth(), 1);
        const monthEnd = new Date(mCursor.getFullYear(), mCursor.getMonth()+1, 0);
        const segStart = s > monthStart ? s : monthStart;
        const segEnd = e < monthEnd ? e : monthEnd;
        if (segEnd >= segStart) {
          const segDays = Math.floor((segEnd.getTime() - segStart.getTime()) / dayMs) + 1;
          const segRatio = segDays / totalDays;
          
          const segPaidDays = Math.round(paidDays * segRatio);
          const segLwpDays = Math.round(lwpDays * segRatio);
          
          deducted[key] = (deducted[key] || 0) + segPaidDays;
          lwp[key] = (lwp[key] || 0) + segLwpDays;
        }
        mCursor = addMonths(mCursor, 1);
      }
    }

    // Build rows in order of months with zeros where missing
    const rows = months.map((m) => ({ ym: m, deducted: Number(deducted[m] || 0), lwp: Number(lwp[m] || 0) }));
    return rows;
  }
}
