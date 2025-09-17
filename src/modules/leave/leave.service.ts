import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import {
  LeaveRequest,
  LeaveApprover,
  LeaveCc,
  LeaveStatusHistory,
} from './leave.model';
import { Employee } from '../employees/employees.model';
import { User } from '../users/users.model';
import { CreateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';
import { LeaveStatus } from './leave.types';
import { LeaveCredit, LeaveCreditConfig } from './leave-credit.model';
import { CompensatoryLeaveService } from './compensatory-leave.service';

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
    private compensatoryLeaveService: CompensatoryLeaveService,
  ) {}

  async createLeaveRequest(employeeId: string, createLeaveDto: CreateLeaveDto) {
    const { toEmployees, ccEmployees, ...leaveData } = createLeaveDto;
    this.logger.log(
      `POST /leave requested by employeeId=${employeeId} | payload=${JSON.stringify(
        {
          ...leaveData,
          toCount: toEmployees?.length || 0,
          ccCount: ccEmployees?.length || 0,
        },
      )}`,
    );

    try {
      // Validate TO employees exist
      const toEmployeesExist = await this.employeeModel.findAll({
        where: { id: { [Op.in]: toEmployees } },
      });

      if (toEmployeesExist.length !== toEmployees.length) {
        this.logger.warn(
          'Validation failed: One or more TO employees not found',
        );
        throw new BadRequestException('One or more TO employees not found');
      }

      // Validate CC employees exist (if provided)
      if (ccEmployees && ccEmployees.length > 0) {
        const ccEmployeesExist = await this.employeeModel.findAll({
          where: { id: { [Op.in]: ccEmployees } },
        });

        if (ccEmployeesExist.length !== ccEmployees.length) {
          this.logger.warn(
            'Validation failed: One or more CC employees not found',
          );
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
        }),
      );

      // Create CC entries
      const ccPromises =
        ccEmployees?.map((empId) =>
          this.leaveCcModel.create({
            leaveRequestId: leaveRequest.id,
            employeeId: empId,
            isRead: false,
          }),
        ) || [];

      // Create initial status history
      const statusHistoryPromise = this.leaveStatusHistoryModel.create({
        leaveRequestId: leaveRequest.id,
        status: 'pending',
        changedBy: employeeId,
        changedAt: new Date(),
        comments: 'Leave request submitted',
      });

      await Promise.all([
        ...approverPromises,
        ...ccPromises,
        statusHistoryPromise,
      ]);

      this.logger.log(
        `Leave request created successfully id=${leaveRequest.id}`,
      );
      return this.getLeaveRequestById(leaveRequest.id);
    } catch (err: unknown) {
      const e = err as Error;
      this.logger.error(
        `Error creating leave request for employeeId=${employeeId}: ${e.message}`,
        e.stack,
      );
      throw err;
    }
  }

  async getLeaveRequests(employeeId: string, userRole: string) {
    let whereClause: Record<string, unknown> = {};

    if (userRole === 'employee') {
      // Employee can only see their own requests
      // Convert string employeeId to UUID for database query
      let employee = await this.employeeModel.findOne({
        where: { employeeId },
        attributes: ['id'],
      });

      // If not found by employeeId string, try by UUID (fallback)
      if (!employee && employeeId) {
        employee = await this.employeeModel.findOne({
          where: { id: employeeId },
          attributes: ['id'],
        });
      }

      if (employee) {
        whereClause.employeeId = employee.id; // Use UUID for database query
      }
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
          attributes: ['id', 'name', 'email', 'employeeId'],
        },
        {
          model: Employee,
          as: 'approver',
          attributes: ['id', 'name', 'email', 'employeeId'],
        },
        {
          model: LeaveApprover,
          as: 'toEmployees',
          include: [
            {
              model: Employee,
              attributes: ['id', 'name', 'email', 'employeeId'],
            },
          ],
        },
        {
          model: LeaveCc,
          as: 'ccEmployees',
          include: [
            {
              model: Employee,
              attributes: ['id', 'name', 'email', 'employeeId'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
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
              attributes: ['id', 'name', 'email', 'employeeId'],
            },
            {
              model: LeaveApprover,
              as: 'toEmployees',
              where: { employeeId },
              include: [
                {
                  model: Employee,
                  attributes: ['id', 'name', 'email', 'employeeId'],
                },
              ],
            },
            {
              model: LeaveCc,
              as: 'ccEmployees',
              include: [
                {
                  model: Employee,
                  attributes: ['id', 'name', 'email', 'employeeId'],
                },
              ],
            },
          ],
          order: [['createdAt', 'DESC']],
        }),
        this.leaveRequestModel.findAll({
          include: [
            {
              model: Employee,
              as: 'employee',
              attributes: ['id', 'name', 'email', 'employeeId'],
            },
            {
              model: LeaveApprover,
              as: 'toEmployees',
              include: [
                {
                  model: Employee,
                  attributes: ['id', 'name', 'email', 'employeeId'],
                },
              ],
            },
            {
              model: LeaveCc,
              as: 'ccEmployees',
              where: { employeeId },
              include: [
                {
                  model: Employee,
                  attributes: ['id', 'name', 'email', 'employeeId'],
                },
              ],
            },
          ],
          order: [['createdAt', 'DESC']],
        }),
      ]);

      const map = new Map<string, LeaveRequest>();
      for (const lr of [...asApprover, ...asCc]) {
        const id = lr.id;
        if (id) map.set(id, lr);
      }
      const merged = Array.from(map.values());
      const getCreatedAtTime = (x: LeaveRequest): number => {
        // Sequelize instance may have get('createdAt') or plain field
        const val = (x as any)?.get?.('createdAt') ?? (x as any)?.createdAt;
        if (!val) return 0;
        const date = typeof val === 'string' ? new Date(val) : (val as Date);
        return isNaN(date.getTime()) ? 0 : date.getTime();
      };
      merged.sort((a, b) => getCreatedAtTime(b) - getCreatedAtTime(a));
      return merged;
    } catch (err: unknown) {
      const e = err as Error;
      this.logger.error(`GET /leave/mentions failed: ${e.message}`, e.stack);
      throw err;
    }
  }

  async getLeaveRequestsForApproval(approverId: string) {
    // Get leave requests where user is in TO list
    return this.leaveRequestModel.findAll({
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'name', 'email', 'employeeId'],
        },
        {
          model: LeaveApprover,
          as: 'toEmployees',
          where: { employeeId: approverId, status: 'pending' },
          include: [
            {
              model: Employee,
              attributes: ['id', 'name', 'email', 'employeeId'],
            },
          ],
        },
        {
          model: LeaveCc,
          as: 'ccEmployees',
          include: [
            {
              model: Employee,
              attributes: ['id', 'name', 'email', 'employeeId'],
            },
          ],
        },
      ],
      where: { status: 'pending' },
      order: [['createdAt', 'DESC']],
    });
  }

  async getLeaveRequestsForCC(ccEmployeeId: string) {
    // Get leave requests where user is in CC list
    return this.leaveRequestModel.findAll({
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'name', 'email', 'employeeId'],
        },
        {
          model: LeaveApprover,
          as: 'toEmployees',
          include: [
            {
              model: Employee,
              attributes: ['id', 'name', 'email', 'employeeId'],
            },
          ],
        },
        {
          model: LeaveCc,
          as: 'ccEmployees',
          where: { employeeId: ccEmployeeId },
          include: [
            {
              model: Employee,
              attributes: ['id', 'name', 'email', 'employeeId'],
            },
          ],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  async getLeaveRequestById(id: string) {
    const leaveRequest = await this.leaveRequestModel.findByPk(id, {
      include: [
        {
          model: Employee,
          as: 'employee',
          attributes: ['id', 'name', 'email', 'employeeId'],
        },
        {
          model: Employee,
          as: 'approver',
          attributes: ['id', 'name', 'email', 'employeeId'],
        },
        {
          model: LeaveApprover,
          as: 'toEmployees',
          include: [
            {
              model: Employee,
              attributes: ['id', 'name', 'email', 'employeeId'],
            },
          ],
        },
        {
          model: LeaveCc,
          as: 'ccEmployees',
          include: [
            {
              model: Employee,
              attributes: ['id', 'name', 'email', 'employeeId'],
            },
          ],
        },
        {
          model: LeaveStatusHistory,
          as: 'statusHistory',
          include: [
            {
              model: Employee,
              as: 'changedByEmployee',
              attributes: ['id', 'name', 'email', 'employeeId'],
            },
          ],
          order: [['changedAt', 'DESC']],
        },
      ],
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    return leaveRequest;
  }

  async updateLeaveStatus(
    leaveRequestId: string,
    approverId: string,
    updateStatusDto: UpdateLeaveStatusDto,
  ) {
    const leaveRequest = await this.getLeaveRequestById(leaveRequestId);

    // Check if user is authorized to approve this request
    const approver = await this.leaveApproverModel.findOne({
      where: {
        leaveRequestId,
        employeeId: approverId,
        status: 'pending',
      },
    });

    if (!approver) {
      throw new ForbiddenException(
        'You are not authorized to approve this leave request',
      );
    }

    // Update leave request status
    await leaveRequest.update({
      status: updateStatusDto.status,
      approvedBy: approverId,
      approvedAt: new Date(),
      comments: updateStatusDto.comments,
    });

    // Update approver status
    await approver.update({
      status: updateStatusDto.status,
      comments: updateStatusDto.comments,
      actionAt: new Date(),
    });

    // Create status history entry
    await this.leaveStatusHistoryModel.create({
      leaveRequestId,
      status: updateStatusDto.status,
      changedBy: approverId,
      changedAt: new Date(),
      comments: updateStatusDto.comments || `Leave ${updateStatusDto.status}`,
    });

    return this.getLeaveRequestById(leaveRequestId);
  }

  async markCCAsRead(leaveRequestId: string, ccEmployeeId: string) {
    const ccEntry = await this.leaveCcModel.findOne({
      where: {
        leaveRequestId,
        employeeId: ccEmployeeId,
      },
    });

    if (!ccEntry) {
      throw new NotFoundException('CC entry not found');
    }

    await ccEntry.update({
      isRead: true,
      readAt: new Date(),
    });

    return { message: 'Marked as read' };
  }

  async deleteLeaveRequest(id: string, employeeId: string, userRole: string) {
    const leaveRequest = await this.getLeaveRequestById(id);

    // Only employee who created the request or admin can delete
    if (userRole !== 'admin' && leaveRequest.employeeId !== employeeId) {
      throw new ForbiddenException(
        'You can only delete your own leave requests',
      );
    }

    // Can only delete pending requests
    if (leaveRequest.status !== 'pending') {
      throw new BadRequestException('Can only delete pending leave requests');
    }

    // Delete related records first
    await Promise.all([
      this.leaveApproverModel.destroy({ where: { leaveRequestId: id } }),
      this.leaveCcModel.destroy({ where: { leaveRequestId: id } }),
      this.leaveStatusHistoryModel.destroy({ where: { leaveRequestId: id } }),
    ]);

    // Delete leave request
    await leaveRequest.destroy();

    return { message: 'Leave request deleted successfully' };
  }

  async cancelLeaveRequest(id: string, employeeId: string, comments?: string) {
    const leaveRequest = await this.getLeaveRequestById(id);

    // Only the employee who created the request can cancel
    if (leaveRequest.employeeId !== employeeId) {
      throw new ForbiddenException(
        'You can only cancel your own leave requests',
      );
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
    // Get employee details first - handle both string employeeId and UUID lookups
    let employee = await this.employeeModel.findOne({
      where: { employeeId },
      attributes: ['id', 'employeeId', 'name', 'joiningDate'],
    });

    // If not found by employeeId string, try by UUID (fallback)
    if (!employee && employeeId) {
      employee = await this.employeeModel.findOne({
        where: { id: employeeId },
        attributes: ['id', 'employeeId', 'name', 'joiningDate'],
      });
    }

    if (!employee) {
      throw new NotFoundException(`Employee not found with ID: ${employeeId}`);
    }

    // Get all leave types (hardcoded for now, will be dynamic when LeaveTypes module is added)
    const leaveTypes = [
      { name: 'Annual Leave', numberOfLeaves: 20 },
      { name: 'Sick Leave', numberOfLeaves: 10 },
      { name: 'Casual Leave', numberOfLeaves: 5 },
      { name: 'Maternity Leave', numberOfLeaves: 90 },
      { name: 'Paternity Leave', numberOfLeaves: 15 },
      { name: 'Emergency Leave', numberOfLeaves: 3 },
    ];

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

    // Get approved leaves for the current year
    const approvedLeaves = await this.leaveRequestModel.findAll({
      where: {
        employeeId: employee.id, // Use UUID instead of string employeeId
        status: 'approved',
      },
      attributes: ['leaveType', 'startDate', 'endDate'],
    });

    // Calculate used days per leave type
    const balance: Record<
      string,
      { total: number; used: number; remaining: number; displayName: string }
    > = {};

    leaveTypes.forEach((leaveType) => {
      const typeName = leaveType.name.toLowerCase().replace(/\s+/g, '');
      const typeLeaves = approvedLeaves.filter((leave) => {
        const leaveTypeName = leave.leaveType.toLowerCase().replace(/\s+/g, '');
        return (
          leaveTypeName === typeName ||
          leaveTypeName === leaveType.name.toLowerCase().replace(' leave', '')
        );
      });

      const usedDays = typeLeaves.reduce((total, leave) => {
        const startDate = new Date(leave.startDate);
        const endDate = new Date(leave.endDate);
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return total + diffDays;
      }, 0);

      balance[typeName] = {
        total: leaveType.numberOfLeaves,
        used: usedDays,
        remaining: Math.max(0, leaveType.numberOfLeaves - usedDays),
        displayName: leaveType.name,
      };
    });

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
    const whereClause: Record<string, unknown> = {};

    if (employeeId) {
      // Convert string employeeId to UUID for database query
      let employee = await this.employeeModel.findOne({
        where: { employeeId },
        attributes: ['id'],
      });

      // If not found by employeeId string, try by UUID (fallback)
      if (!employee && employeeId) {
        employee = await this.employeeModel.findOne({
          where: { id: employeeId },
          attributes: ['id'],
        });
      }

      if (employee) {
        whereClause.employeeId = employee.id; // Use UUID for database query
      }
    }

    const [total, pending, approved, rejected] = await Promise.all([
      this.leaveRequestModel.count({ where: whereClause }),
      this.leaveRequestModel.count({
        where: { ...whereClause, status: 'pending' },
      }),
      this.leaveRequestModel.count({
        where: { ...whereClause, status: 'approved' },
      }),
      this.leaveRequestModel.count({
        where: { ...whereClause, status: 'rejected' },
      }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
    };
  }

  // Compute monthly deducted (paid leave) and LWP for a date range
  async getMonthlyLedger(employeeId: string, from?: string, to?: string) {
    try {
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), 0, 1); // Jan 1 current year
    const defaultTo = new Date(now.getFullYear(), now.getMonth(), 1); // cap at current month start

    const start = from ? new Date(from) : defaultFrom;
    const endInput = to ? new Date(to) : new Date(now.getFullYear(), 11, 31);
    // cap to current month start to avoid future months
    const end = endInput > defaultTo ? defaultTo : new Date(endInput.getFullYear(), endInput.getMonth(), 1);
    // IMPORTANT: For DB filtering, include the ENTIRE capped end month
    const endBoundary = new Date(end.getFullYear(), end.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get employee to find associated user
    // Handle both string employeeId and UUID lookups for compatibility
    let employee = await this.employeeModel.findOne({
      where: { employeeId },
      include: [{ model: User, as: 'user' }]
    });

    // If not found by employeeId string, try by UUID (fallback)
    if (!employee && employeeId) {
      employee = await this.employeeModel.findOne({
        where: { id: employeeId },
        include: [{ model: User, as: 'user' }]
      });
    }

    if (!employee) {
      throw new Error(`Employee not found with ID: ${employeeId}`);
    }

    let compensatoryCredits: Record<string, number> = {};
    if (employee?.user) {
      console.log('🔍 DEBUG - Employee found:', {
        employeeId: employee.employeeId,
        employeeName: employee.name,
        userId: employee.user.id,
        userEmail: employee.user.email
      });
      try {
        // Fetch compensatory leave credits by assigned month for the date range
        const compensatoryLeaves = await this.compensatoryLeaveService.findByUserId(
          employee.user.id, // Use UUID string directly
          'active' as any
        );
        console.log('🔍 DEBUG - Compensatory leaves found:', compensatoryLeaves.length);
        console.log('🔍 DEBUG - Compensatory leaves data:', JSON.stringify(compensatoryLeaves, null, 2));

      // Group compensatory credits by assigned month
      // Credits are applied to the month BEFORE the assigned month
      compensatoryLeaves.forEach((credit: any) => {
        try {
          console.log('🔍 DEBUG - Full credit object keys:', Object.keys(credit));
          console.log('🔍 DEBUG - Raw assignedDate from DB:', credit.assignedDate);
          console.log('🔍 DEBUG - Raw assigned_date from DB:', credit.assigned_date);
          console.log('🔍 DEBUG - Credit dataValues:', credit.dataValues);
          
          // Try different possible field names
          const assignedDateValue = credit.assignedDate || credit.assigned_date || credit.dataValues?.assignedDate || credit.dataValues?.assigned_date;
          console.log('🔍 DEBUG - Final assignedDateValue:', assignedDateValue);
          
          let assignedDate: Date;
          if (!assignedDateValue) {
            console.error('🚨 ERROR - No assignedDate found in any format, using current month middle');
            // Fallback: use middle of current month as you suggested
            const now = new Date();
            assignedDate = new Date(now.getFullYear(), now.getMonth(), 15); // 15th of current month
            console.log('🔍 DEBUG - Using fallback assignedDate:', assignedDate);
          } else {
            assignedDate = new Date(assignedDateValue);
          }
          console.log('🔍 DEBUG - Parsed assignedDate:', assignedDate);
          
          // Check if assignedDate is valid
          if (isNaN(assignedDate.getTime())) {
            console.error('🚨 ERROR - Invalid assignedDate:', credit.assignedDate);
            return; // Skip this credit
          }
          
          // Calculate the previous month from assigned date (safer approach)
          const assignedYear = assignedDate.getFullYear();
          const assignedMonth = assignedDate.getMonth();
          
          console.log('🔍 DEBUG - Assigned year/month:', assignedYear, assignedMonth);
          
          // Calculate previous month and year
          let previousYear = assignedYear;
          let previousMonthIndex = assignedMonth - 1;
          
          // Handle year rollover (January -> December of previous year)
          if (previousMonthIndex < 0) {
            previousMonthIndex = 11; // December
            previousYear = assignedYear - 1;
          }
          
          console.log('🔍 DEBUG - Previous year/month:', previousYear, previousMonthIndex);
          
          // Create previous month date safely (use day 1 to avoid invalid dates)
          const previousMonth = new Date(previousYear, previousMonthIndex, 1);
          
          console.log('🔍 DEBUG - Previous month date:', previousMonth);
          
          // Check if previousMonth is valid
          if (isNaN(previousMonth.getTime())) {
            console.error('🚨 ERROR - Invalid previousMonth date');
            return; // Skip this credit
          }
          
          const yearMonth = `${previousYear}-${String(previousMonthIndex + 1).padStart(2, '0')}`;
          
          // Only include credits within the requested date range (check both assigned and credited month)
          const creditedDate = previousMonth;
          // Try different ways to access credits field
          const creditsValue = credit.credits || credit.dataValues?.credits || 0;
          console.log('🔍 DEBUG - Raw credits from DB:', credit.credits);
          console.log('🔍 DEBUG - Credits from dataValues:', credit.dataValues?.credits);
          console.log('🔍 DEBUG - Final creditsValue:', creditsValue);
          
          console.log('🔍 DEBUG - Processing credit:', {
            assignedDate: assignedDate.toISOString(),
            creditedDate: creditedDate.toISOString(),
            yearMonth,
            credits: creditsValue,
            dateRangeStart: start.toISOString(),
            dateRangeEnd: endBoundary.toISOString(),
            assignedInRange: assignedDate >= start && assignedDate <= endBoundary,
            creditedInRange: creditedDate >= start && creditedDate <= endBoundary
          });
          
          // Check if credit should be included in the date range
          if ((assignedDate >= start && assignedDate <= endBoundary) || 
              (creditedDate >= start && creditedDate <= endBoundary)) {
            compensatoryCredits[yearMonth] = (compensatoryCredits[yearMonth] || 0) + Number(creditsValue);
            console.log('🔍 DEBUG - Credit added to month:', yearMonth, 'Total:', compensatoryCredits[yearMonth]);
          } else {
            console.log('🔍 DEBUG - Credit NOT in date range, skipping');
          }
        } catch (dateError) {
          console.error('🚨 ERROR in date processing for credit:', credit.id, dateError);
          return; // Skip this credit
        }
      });
      } catch (compensatoryError) {
        console.error('🚨 ERROR fetching compensatory leave credits:', compensatoryError);
        // Continue without compensatory credits if service fails
        compensatoryCredits = {};
      }
    }

    // Fetch approved leaves for employee intersecting the window (quick filter by year span)
    // Use the employee's UUID for the database query, not the string employeeId
    const approved = await this.leaveRequestModel.findAll({
      where: {
        employeeId: employee.id, // Use UUID instead of string employeeId
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
    console.log('🔍 DEBUG - Final compensatoryCredits object:', compensatoryCredits);
    const rows = months.map((m) => ({ 
      ym: m, 
      deducted: Number(deducted[m] || 0), 
      lwp: Number(lwp[m] || 0),
      extraCredit: Number(compensatoryCredits[m] || 0),
      extraCreditBreakdown: compensatoryCredits[m] ? `${compensatoryCredits[m]} (Compensatory - Previous Month Credit)` : ''
    }));
    console.log('🔍 DEBUG - Final rows with extraCredit:', JSON.stringify(rows, null, 2));
    return rows;
    } catch (error) {
      console.error('🚨 ERROR in getMonthlyLedger:', error);
      console.error('🚨 ERROR Stack:', error.stack);
      throw error;
    }
  }
}
