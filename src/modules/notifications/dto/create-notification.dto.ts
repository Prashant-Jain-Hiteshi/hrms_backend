import { IsString, IsUUID, IsOptional, IsEnum, IsObject, IsBoolean } from 'class-validator';

export enum NotificationType {
  // Leave Management
  LEAVE_APPROVED = 'leave_approved',
  LEAVE_REJECTED = 'leave_rejected',
  LEAVE_PENDING = 'leave_pending',
  LEAVE_CANCELLED = 'leave_cancelled',
  LEAVE_BALANCE_UPDATED = 'leave_balance_updated',
  
  // Payroll
  PAYSLIP_GENERATED = 'payslip_generated',
  SALARY_PROCESSED = 'salary_processed',
  
  // General
  PROFILE_UPDATED = 'profile_updated',
  DOCUMENT_UPLOADED = 'document_uploaded',
  ANNOUNCEMENT = 'announcement'
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  tenantId: string;

  @IsString()
  employeeId: string;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  category: string;

  @IsOptional()
  @IsEnum(NotificationPriority)
  priority?: NotificationPriority = NotificationPriority.NORMAL;

  @IsOptional()
  @IsString()
  relatedEntityType?: string | null;

  @IsOptional()
  @IsUUID()
  relatedEntityId?: string | null;

  @IsOptional()
  @IsObject()
  metadata?: any;

  @IsOptional()
  expiresAt?: Date;
}
