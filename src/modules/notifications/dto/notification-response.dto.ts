export class NotificationResponseDto {
  id: string;
  userId: string;
  tenantId: string;
  employeeId: string;
  title: string;
  message: string;
  type: string;
  category: string;
  isRead: boolean;
  priority: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: any;
  createdAt: Date;
  readAt?: Date;
  
  constructor(notification: any) {
    this.id = notification.id;
    this.userId = notification.userId;
    this.tenantId = notification.tenantId;
    this.employeeId = notification.employeeId;
    this.title = notification.title;
    this.message = notification.message;
    this.type = notification.type;
    this.category = notification.category;
    this.isRead = notification.isRead;
    this.priority = notification.priority;
    this.relatedEntityType = notification.relatedEntityType;
    this.relatedEntityId = notification.relatedEntityId;
    this.metadata = notification.metadata;
    this.createdAt = notification.createdAt;
    this.readAt = notification.readAt;
  }
}

