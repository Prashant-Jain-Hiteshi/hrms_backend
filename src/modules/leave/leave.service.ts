import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import {
  LeaveRequest,
  LeaveApprover,
  LeaveCc,
  LeaveStatusHistory,
} from './leave.model';
import { Employee } from '../employees/employees.model';
import { CreateLeaveDto, UpdateLeaveStatusDto } from './dto/create-leave.dto';
import { Op } from 'sequelize';

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
    // Get all leave types (hardcoded for now, will be dynamic when LeaveTypes module is added)
    const leaveTypes = [
      { name: 'Annual Leave', numberOfLeaves: 20 },
      { name: 'Sick Leave', numberOfLeaves: 10 },
      { name: 'Casual Leave', numberOfLeaves: 5 },
      { name: 'Maternity Leave', numberOfLeaves: 90 },
      { name: 'Paternity Leave', numberOfLeaves: 15 },
      { name: 'Emergency Leave', numberOfLeaves: 3 },
    ];

    // Get approved leave requests for this employee
    const approvedLeaves = await this.leaveRequestModel.findAll({
      where: {
        employeeId,
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
        // Calculate days between start and end date
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end date
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

  async getLeaveStatistics(employeeId?: string) {
    const whereClause: Record<string, unknown> = {};

    if (employeeId) {
      whereClause.employeeId = employeeId;
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
}
