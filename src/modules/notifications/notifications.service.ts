import { Injectable, NotFoundException } from '@nestjs/common';
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
        title: createNotificationDto.title,
        category: createNotificationDto.category
      });

      return new NotificationResponseDto(savedNotification.toJSON());
    } catch (error) {
      console.error('  Error creating notification:', error);
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
      const notification = await this.notificationModel.findOne({
        where: { id, userId, tenantId }
      });

      if (!notification) {
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
}
