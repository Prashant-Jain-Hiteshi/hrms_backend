import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from './notifications.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
  employeeId?: string;
  role?: string;
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: true, // Allow all origins for development
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  namespace: '/notifications',
  transports: ['websocket', 'polling'], // Support both transports
  allowEIO3: true, // Support older Socket.io versions
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('🚀 Notifications WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract JWT token from handshake auth
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        this.logger.warn(`❌ Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);
      const { sub: userId, tenantId, employeeId, role } = payload;

      if (!userId || !tenantId || !employeeId) {
        this.logger.warn(`❌ Client ${client.id} has invalid token payload`);
        client.disconnect();
        return;
      }

      // Store user info in socket
      client.userId = userId;
      client.tenantId = tenantId;
      client.employeeId = employeeId;
      client.role = role;

      // Join user-specific room
      const userRoom = `user_${userId}`;
      await client.join(userRoom);

      // Join role-based room for the tenant
      const roleRoom = `tenant_${tenantId}_${role}`;
      await client.join(roleRoom);

      // Join tenant-wide room for company announcements
      const tenantRoom = `tenant_${tenantId}_all`;
      await client.join(tenantRoom);

      this.logger.log(`✅ User ${employeeId} (${role}) connected to rooms: ${userRoom}, ${roleRoom}, ${tenantRoom}`);

      // Send unread count on connection
      const unreadCount = await this.notificationsService.getUnreadCount(userId, tenantId);
      client.emit('unread_count', { count: unreadCount });

    } catch (error) {
      this.logger.error(`❌ Authentication failed for client ${client.id}:`, error.message);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.employeeId) {
      this.logger.log(`👋 User ${client.employeeId} disconnected`);
    } else {
      this.logger.log(`👋 Client ${client.id} disconnected`);
    }
  }

  /**
   * Send notification to a specific user
   */
  async sendToUser(userId: string, notification: any) {
    const userRoom = `user_${userId}`;
    this.server.to(userRoom).emit('new_notification', notification);
    this.logger.log(`📧 Sent notification to user room: ${userRoom}`);
  }

  /**
   * Send notification to all users with a specific role in a tenant
   */
  async sendToRole(tenantId: string, role: string, notification: any) {
    const roleRoom = `tenant_${tenantId}_${role}`;
    this.server.to(roleRoom).emit('new_notification', notification);
    this.logger.log(`📧 Sent notification to role room: ${roleRoom}`);
  }

  /**
   * Send notification to all users in a tenant (company-wide announcement)
   */
  async sendToTenant(tenantId: string, notification: any) {
    const tenantRoom = `tenant_${tenantId}_all`;
    this.server.to(tenantRoom).emit('new_notification', notification);
    this.logger.log(`📧 Sent notification to tenant room: ${tenantRoom}`);
  }

  /**
   * Update unread count for a specific user
   */
  async updateUnreadCount(userId: string, count: number) {
    const userRoom = `user_${userId}`;
    this.server.to(userRoom).emit('unread_count', { count });
    this.logger.log(`🔢 Updated unread count for user ${userId}: ${count}`);
  }

  /**
   * Notify user when their notification is marked as read
   */
  async notifyNotificationRead(userId: string, notificationId: string) {
    const userRoom = `user_${userId}`;
    this.server.to(userRoom).emit('notification_read', { notificationId });
    this.logger.log(`✅ Notified user ${userId} that notification ${notificationId} was read`);
  }

  /**
   * Send leave approval notification to employee
   */
  async sendLeaveApprovalNotification(
    userId: string,
    tenantId: string,
    notification: any
  ) {
    // Send to specific user
    await this.sendToUser(userId, notification);
    
    // Update unread count
    const unreadCount = await this.notificationsService.getUnreadCount(userId, tenantId);
    await this.updateUnreadCount(userId, unreadCount);
  }

  /**
   * Send leave request notification to HR/Admin
   */
  async sendLeaveRequestNotification(
    tenantId: string,
    notification: any
  ) {
    // Send to HR role
    await this.sendToRole(tenantId, 'hr', notification);
    
    // Send to Admin role
    await this.sendToRole(tenantId, 'admin', notification);
    
    this.logger.log(`📧 Sent leave request notification to HR and Admin in tenant ${tenantId}`);
  }

  /**
   * Send payroll notification to employee
   */
  async sendPayrollNotification(
    userId: string,
    tenantId: string,
    notification: any
  ) {
    await this.sendToUser(userId, notification);
    
    const unreadCount = await this.notificationsService.getUnreadCount(userId, tenantId);
    await this.updateUnreadCount(userId, unreadCount);
  }

  /**
   * Send company-wide announcement
   */
  async sendCompanyAnnouncement(
    tenantId: string,
    notification: any
  ) {
    await this.sendToTenant(tenantId, notification);
    this.logger.log(`📢 Sent company announcement to tenant ${tenantId}`);
  }
}
