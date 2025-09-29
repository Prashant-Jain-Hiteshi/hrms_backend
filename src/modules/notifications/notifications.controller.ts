import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  Query, 
  UseGuards, 
  Request 
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { NotificationQueryDto } from './dto/notification-query.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get all notifications for the authenticated user
   */
  @Get()
  async getNotifications(@Request() req: any, @Query() query: NotificationQueryDto) {
    try {
      console.log('🔍 GET /notifications called with query:', query);
      console.log('🔍 User from JWT:', req.user);
      
      const { id: userId, tenantId } = req.user;
      console.log('🔍 Extracted userId:', userId, 'tenantId:', tenantId);
      
      const result = await this.notificationsService.findByUser(userId, tenantId, query);
      console.log('✅ Notifications retrieved successfully, count:', result.notifications?.length || 0);
      
      return result;
    } catch (error) {
      console.error('❌ Error in getNotifications controller:', error);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  @Get('unread-count')
  async getUnreadCount(@Request() req: any) {
    const { id: userId, tenantId } = req.user;
    const count = await this.notificationsService.getUnreadCount(userId, tenantId);
    return { unreadCount: count };
  }

  /**
   * Mark a specific notification as read
   */
  @Put(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    const { id: userId, tenantId } = req.user;
    return this.notificationsService.markAsRead(id, userId, tenantId);
  }

  /**
   * Mark all notifications as read
   */
  @Put('mark-all-read')
  async markAllAsRead(@Request() req: any) {
    const { id: userId, tenantId } = req.user;
    return this.notificationsService.markAllAsRead(userId, tenantId);
  }

  /**
   * Delete a specific notification
   */
  @Delete(':id')
  async deleteNotification(@Param('id') id: string, @Request() req: any) {
    const { id: userId, tenantId } = req.user;
    await this.notificationsService.delete(id, userId, tenantId);
    return { message: 'Notification deleted successfully' };
  }

  /**
   * Create a notification (for testing purposes - remove in production)
   */
  @Post()
  async createNotification(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationsService.create(createNotificationDto);
  }
}
