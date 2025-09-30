import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto, NotificationType, NotificationPriority } from './dto/create-notification.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification)
    private notificationModel: typeof Notification,
  ) {}
  /**
   * Create a new notification
   */
  async create(createNotificationDto: CreateNotificationDto): Promise<NotificationResponseDto> {
    try {
      // Set expiry date to 10 days from now if not provided
      const expiresAt = createNotificationDto.expiresAt 
        ? new Date(createNotificationDto.expiresAt)
        : new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days

      const savedNotification = await this.notificationModel.create({
        userId: createNotificationDto.userId,
        tenantId: createNotificationDto.tenantId,
        employeeId: createNotificationDto.employeeId,
        title: createNotificationDto.title,
        message: createNotificationDto.message,
        type: createNotificationDto.type,
        category: createNotificationDto.category,
        priority: createNotificationDto.priority || NotificationPriority.NORMAL,
        relatedEntityType: createNotificationDto.relatedEntityType || null,
        relatedEntityId: createNotificationDto.relatedEntityId || null,
        metadata: createNotificationDto.metadata || null,
        expiresAt: expiresAt,
      } as any);
      
      console.log(`  Notification created for user ${createNotificationDto.employeeId}:`, {
        type: createNotificationDto.type,
        category: createNotificationDto.category
      });

      return new NotificationResponseDto(savedNotification.toJSON());
    } catch (error) {
      console.error('❌ ERROR: Failed to create notification:', {
        error: error.message,
        errorType: error.constructor.name,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Get notifications for a specific user with filtering and pagination
   */
  async findByUser(
    userId: string, 
    tenantId: string, 
    query: NotificationQueryDto = {}
  ): Promise<{ notifications: NotificationResponseDto[], total: number, unreadCount: number }> {
    try {
      console.log('  findByUser called with:', { userId, tenantId, query });
      
      const { page = 1, limit = 20, category, type, isRead, search } = query;
      
      const whereConditions: any = {
        userId,
        tenantId,
      };

      // Add filters
      if (category) whereConditions.category = category;
      if (type) whereConditions.type = type;
      if (typeof isRead === 'boolean') whereConditions.isRead = isRead;
      if (search) {
        whereConditions.title = { [Op.iLike]: `%${search}%` };
      }

      console.log('  Where conditions:', whereConditions);
      console.log('  Pagination:', { page, limit, offset: (page - 1) * limit });
      const { rows: notifications, count: total } = await this.notificationModel.findAndCountAll({
        where: whereConditions,
        order: [['createdAt', 'DESC']],
        offset: (page - 1) * limit,
        limit: limit,
      });

      console.log('🔍 Raw query result:', { notificationsCount: notifications.length, total });

      // Get unread count
      const unreadCount = await this.notificationModel.count({
        where: { userId, tenantId, isRead: false }
      });

      console.log('🔍 Unread count:', unreadCount);

      const notificationDtos = notifications.map(notification => 
        new NotificationResponseDto(notification.toJSON())
      );

      console.log(`📋 Retrieved ${notifications.length} notifications for user ${userId}`);

      return {
        notifications: notificationDtos,
        total,
        unreadCount
      };
    } catch (error) {
      console.error('❌ Error in findByUser:', error);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Mark a specific notification as read
   */
  async markAsRead(id: string, userId: string, tenantId: string): Promise<NotificationResponseDto> {
    try {
      console.log('🔍 NotificationsService.markAsRead - ID:', id, 'userId:', userId, 'tenantId:', tenantId);
      
      // Validate input parameters
      if (!id || id === 'undefined' || id === 'null') {
        console.error('❌ BAD_REQUEST: Invalid notification ID in service:', id);
        throw new BadRequestException('Invalid notification ID');
      }

      if (!userId) {
        console.error('❌ BAD_REQUEST: userId is required for markAsRead');
        throw new BadRequestException('User ID is required');
      }

      if (!tenantId) {
        console.error('❌ BAD_REQUEST: tenantId is required for markAsRead');
        throw new BadRequestException('Tenant ID is required');
      }

      const notification = await this.notificationModel.findOne({
        where: { id, userId, tenantId }
      });

      if (!notification) {
        console.error('❌ NOT_FOUND: Notification not found:', { id, userId, tenantId });
        throw new NotFoundException('Notification not found');
      }

      await notification.update({
        isRead: true,
        readAt: new Date()
      });

      console.log(`✅ Notification ${id} marked as read for user ${userId}`);

      return new NotificationResponseDto(notification.toJSON());
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string, tenantId: string): Promise<{ updated: number }> {
    try {
      const [updated] = await this.notificationModel.update(
        { isRead: true, readAt: new Date() },
        { where: { userId, tenantId, isRead: false } }
      );

      console.log(`✅ Marked ${updated} notifications as read for user ${userId}`);

      return { updated };
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete a specific notification
   */
  async delete(id: string, userId: string, tenantId: string): Promise<void> {
    try {
      const deleted = await this.notificationModel.destroy({
        where: { id, userId, tenantId }
      });

      if (deleted === 0) {
        throw new NotFoundException('Notification not found');
      }

      console.log(`🗑️ Deleted notification ${id} for user ${userId}`);
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string, tenantId: string): Promise<number> {
    try {
      const count = await this.notificationModel.count({
        where: { userId, tenantId, isRead: false }
      });

      return count;
    } catch (error) {
      console.error('❌ Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Clean up expired notifications (called by cron job)
   */
  async cleanupExpiredNotifications(): Promise<{ deleted: number }> {
    try {
      const deleted = await this.notificationModel.destroy({
        where: {
          expiresAt: { [Op.lt]: new Date() }
        }
      });

      console.log(`🧹 Cleaned up ${deleted} expired notifications`);

      return { deleted };
    } catch (error) {
      console.error('❌ Error cleaning up expired notifications:', error);
      return { deleted: 0 };
    }
  }

  /**
   * Delete notifications related to a specific entity (for cascade deletion)
   */
  async deleteByRelatedEntity(
    relatedEntityType: string, 
    relatedEntityId: string, 
    tenantId: string
  ): Promise<{ deleted: number }> {
    try {
      const deleted = await this.notificationModel.destroy({
        where: {
          relatedEntityType,
          relatedEntityId,
          tenantId
        }
      });

      console.log(`🗑️ Deleted ${deleted} notifications for ${relatedEntityType}:${relatedEntityId}`);

      return { deleted };
    } catch (error) {
      console.error('❌ Error deleting related notifications:', error);
      return { deleted: 0 };
    }
  }

  /**
   * Create leave-specific notifications
   */
  async createLeaveNotification(
    userId: string,
    tenantId: string,
    employeeId: string,
    type: NotificationType,
    leaveData: {
      leaveType: string;
      startDate: string;
      endDate: string;
      days: number;
      approvedBy?: string;
      rejectionReason?: string;
    },
    relatedEntityId: string
  ): Promise<NotificationResponseDto> {
    let title: string;
    let message: string;

    switch (type) {
      case NotificationType.LEAVE_APPROVED:
        title = 'Leave Request Approved';
        message = `Your ${leaveData.leaveType} leave request for ${leaveData.startDate} to ${leaveData.endDate} (${leaveData.days} days) has been approved.`;
        break;
      
      case NotificationType.LEAVE_REJECTED:
        title = 'Leave Request Rejected';
        message = `Your ${leaveData.leaveType} leave request for ${leaveData.startDate} to ${leaveData.endDate} has been rejected${leaveData.rejectionReason ? `. Reason: ${leaveData.rejectionReason}` : ''}.`;
        break;
      
      case NotificationType.LEAVE_PENDING:
        title = 'Leave Request Submitted';
        message = `Your ${leaveData.leaveType} leave request for ${leaveData.startDate} to ${leaveData.endDate} (${leaveData.days} days) has been submitted.`;
        break;
      
      default:
        title = 'Leave Update';
        message = `Your leave request has been updated.`;
    }

    const createDto: CreateNotificationDto = {
      userId,
      tenantId,
      employeeId,
      title,
      message,
      type,
      category: 'Leave',
      priority: type === NotificationType.LEAVE_REJECTED ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
      relatedEntityType: 'leave_request',
      relatedEntityId,
      metadata: leaveData
    };

    return this.create(createDto);
  }

  /**
   * Create compensatory leave assignment notification
   */
  async createCompensatoryLeaveNotification(
    userId: string,
    tenantId: string,
    employeeId: string,
    compensatoryData: {
      credits: number;
      expiryDate: string;
      assignedByName: string;
      reason: string;
    },
    relatedEntityId: string
  ): Promise<NotificationResponseDto> {
    try {
      console.log('🔔 Creating compensatory leave notification for:', { userId, employeeId, credits: compensatoryData.credits });

      if (!userId) {
        console.error('❌ BAD_REQUEST: userId is required for compensatory leave notification');
        throw new Error('UserId is required');
      }

      if (!tenantId) {
        console.error('❌ BAD_REQUEST: tenantId is required for compensatory leave notification');
        throw new Error('TenantId is required');
      }

      if (!employeeId) {
        console.error('❌ BAD_REQUEST: employeeId is required for compensatory leave notification');
        throw new Error('EmployeeId is required');
      }

      if (!compensatoryData.credits || compensatoryData.credits <= 0) {
        console.error('❌ BAD_REQUEST: Invalid credits value for compensatory leave notification:', compensatoryData.credits);
        throw new Error('Invalid credits value');
      }

      const title = 'Compensatory Leave Credits Assigned';
      const message = `You have been assigned ${compensatoryData.credits} compensatory leave credits by ${compensatoryData.assignedByName}. Reason: ${compensatoryData.reason}. Valid until: ${compensatoryData.expiryDate}`;

      const createDto: CreateNotificationDto = {
        userId,
        tenantId,
        employeeId,
        title,
        message,
        type: NotificationType.COMPENSATORY_LEAVE_ASSIGNED,
        category: 'Leave',
        priority: NotificationPriority.NORMAL,
        relatedEntityType: 'compensatory_leave',
        relatedEntityId,
        metadata: compensatoryData
      };

      console.log('✅ Compensatory leave notification created successfully for employee:', employeeId);
      return this.create(createDto);

    } catch (error) {
      console.error('❌ ERROR: Failed to create compensatory leave notification:', {
        error: error.message,
        errorType: error.constructor.name,
        userId,
        employeeId,
        tenantId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Create payroll HR approval notification (HR → Finance)
   */
  async createPayrollHRApprovalNotification(
    financeUsers: any[],
    tenantId: string,
    payrollData: {
      employeeCount: number;
      totalAmount: number;
      month: string;
      approvedByName: string;
      employeeNames?: string[];
      isBulk: boolean;
    },
    relatedEntityId: string
  ): Promise<void> {
    try {
      console.log('🔔 Creating payroll HR approval notifications for Finance team:', {
        financeUserCount: financeUsers.length,
        payrollData,
        relatedEntityId
      });

      // Create message based on single or bulk approval
      const title = payrollData.isBulk 
        ? 'Bulk Payroll Approved by HR'
        : 'Payroll Approved by HR';

      const message = payrollData.isBulk
        ? `Bulk payroll approved for ${payrollData.employeeCount} employees (${payrollData.month}) by ${payrollData.approvedByName}. Total: ₹${payrollData.totalAmount.toLocaleString()}`
        : `Payroll approved for ${payrollData.employeeNames?.[0]} (${payrollData.month}) by ${payrollData.approvedByName}. Amount: ₹${payrollData.totalAmount.toLocaleString()}`;

      // Send notification to each Finance user
      for (const financeUser of financeUsers) {
        try {
          const createDto: CreateNotificationDto = {
            userId: financeUser.id,
            tenantId,
            employeeId: financeUser.employeeId || 'FINANCE_TEAM',
            title,
            message,
            type: NotificationType.PAYROLL_HR_APPROVED,
            category: 'Payroll',
            priority: NotificationPriority.HIGH,
            relatedEntityType: 'payroll_approval',
            relatedEntityId,
            metadata: payrollData
          };

          await this.create(createDto);
          console.log('✅ Payroll HR approval notification sent to Finance user:', financeUser.email);

        } catch (userError) {
          console.error('❌ NOTIFICATION_ERROR: Failed to send notification to Finance user:', {
            error: userError.message,
            errorType: userError.constructor.name,
            financeUserId: financeUser.id,
            financeUserEmail: financeUser.email
          });
        }
      }

    } catch (error) {
      console.error('❌ FATAL_ERROR: Failed to create payroll HR approval notifications:', {
        error: error.message,
        errorType: error.constructor.name,
        tenantId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Create payroll Finance approval notification (Finance → HR/Admin)
   */
  async createPayrollFinanceApprovalNotification(
    hrAdminUsers: any[],
    tenantId: string,
    payrollData: {
      employeeCount: number;
      totalAmount: number;
      month: string;
      approvedByName: string;
      employeeNames?: string[];
      isBulk: boolean;
    },
    relatedEntityId: string
  ): Promise<void> {
    try {
      console.log('🔔 Creating payroll Finance approval notifications for HR/Admin team:', {
        hrAdminUserCount: hrAdminUsers.length,
        payrollData,
        relatedEntityId
      });

      // Create message based on single or bulk approval
      const title = payrollData.isBulk 
        ? 'Bulk Payroll Finalized by Finance'
        : 'Payroll Finalized by Finance';

      const message = payrollData.isBulk
        ? `Bulk payroll finalized for ${payrollData.employeeCount} employees (${payrollData.month}) by ${payrollData.approvedByName}. Total: ₹${payrollData.totalAmount.toLocaleString()}`
        : `Payroll finalized for ${payrollData.employeeNames?.[0]} (${payrollData.month}) by ${payrollData.approvedByName}. Amount: ₹${payrollData.totalAmount.toLocaleString()}`;

      // Send notification to each HR/Admin user
      for (const hrAdminUser of hrAdminUsers) {
        try {
          const createDto: CreateNotificationDto = {
            userId: hrAdminUser.id,
            tenantId,
            employeeId: hrAdminUser.employeeId || 'HR_ADMIN_TEAM',
            title,
            message,
            type: NotificationType.PAYROLL_FINANCE_APPROVED,
            category: 'Payroll',
            priority: NotificationPriority.NORMAL,
            relatedEntityType: 'payroll_finalization',
            relatedEntityId,
            metadata: payrollData
          };

          await this.create(createDto);
          console.log('✅ Payroll Finance approval notification sent to HR/Admin user:', hrAdminUser.email);

        } catch (userError) {
          console.error('❌ NOTIFICATION_ERROR: Failed to send notification to HR/Admin user:', {
            error: userError.message,
            errorType: userError.constructor.name,
            hrAdminUserId: hrAdminUser.id,
            hrAdminUserEmail: hrAdminUser.email
          });
        }
      }

    } catch (error) {
      console.error('❌ FATAL_ERROR: Failed to create payroll Finance approval notifications:', {
        error: error.message,
        errorType: error.constructor.name,
        tenantId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Create salary transfer notification for employee
   */
  async createSalaryTransferNotification(
    userId: string,
    tenantId: string,
    employeeId: string,
    transferData: {
      amount: number;
      bankName: string;
      accountNumber: string;
      transactionId?: string;
      status: 'initiated' | 'completed' | 'failed';
      transferredByName: string;
      month: string;
    },
    relatedEntityId: string
  ): Promise<NotificationResponseDto> {
    try {
      console.log('🔔 Creating salary transfer notification for employee:', {
        userId,
        employeeId,
        transferData,
        relatedEntityId
      });

      // Validate required parameters
      if (!userId) {
        console.error('❌ BAD_REQUEST: userId is required for salary transfer notification');
        throw new BadRequestException('UserId is required');
      }

      if (!tenantId) {
        console.error('❌ BAD_REQUEST: tenantId is required for salary transfer notification');
        throw new BadRequestException('TenantId is required');
      }

      if (!employeeId) {
        console.error('❌ BAD_REQUEST: employeeId is required for salary transfer notification');
        throw new BadRequestException('EmployeeId is required');
      }

      // Create notification based on transfer status
      let title: string;
      let message: string;
      let notificationType: NotificationType;
      let priority: NotificationPriority;

      const maskedAccount = `****${transferData.accountNumber.slice(-4)}`;

      switch (transferData.status) {
        case 'initiated':
          title = 'Salary Transfer Initiated';
          message = `Your salary transfer of ₹${transferData.amount.toLocaleString()} has been initiated by ${transferData.transferredByName} to ${transferData.bankName} ${maskedAccount}. Transaction ID: ${transferData.transactionId}`;
          notificationType = NotificationType.SALARY_TRANSFER_INITIATED;
          priority = NotificationPriority.HIGH;
          break;

        case 'completed':
          title = 'Salary Transfer Completed';
          message = `Your salary of ₹${transferData.amount.toLocaleString()} has been successfully transferred to your ${transferData.bankName} account ${maskedAccount}. Transaction ID: ${transferData.transactionId}`;
          notificationType = NotificationType.SALARY_TRANSFER_COMPLETED;
          priority = NotificationPriority.HIGH;
          break;

        case 'failed':
          title = 'Salary Transfer Failed';
          message = `Your salary transfer of ₹${transferData.amount.toLocaleString()} to ${transferData.bankName} ${maskedAccount} has failed. Please contact Finance for assistance. Transaction ID: ${transferData.transactionId}`;
          notificationType = NotificationType.SALARY_TRANSFER_FAILED;
          priority = NotificationPriority.HIGH;
          break;

        default:
          throw new BadRequestException('Invalid transfer status');
      }

      const createDto: CreateNotificationDto = {
        userId,
        tenantId,
        employeeId,
        title,
        message,
        type: notificationType,
        category: 'Payroll',
        priority,
        relatedEntityType: 'salary_transfer',
        relatedEntityId,
        metadata: transferData
      };

      console.log('✅ Salary transfer notification created successfully for employee:', employeeId);
      return this.create(createDto);

    } catch (error) {
      console.error('❌ ERROR: Failed to create salary transfer notification:', {
        error: error.message,
        errorType: error.constructor.name,
        userId,
        employeeId,
        tenantId,
        transferStatus: transferData?.status,
        stack: error.stack
      });
      throw error;
    }
  }
}
