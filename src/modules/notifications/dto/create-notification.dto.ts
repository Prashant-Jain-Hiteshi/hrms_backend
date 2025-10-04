import { IsString, IsUUID, IsOptional, IsEnum, IsObject, IsBoolean } from 'class-validator';

export enum NotificationType {
  // Leave Management
  LEAVE_APPROVED = 'leave_approved',
  LEAVE_REJECTED = 'leave_rejected',
  LEAVE_PENDING = 'leave_pending',
  LEAVE_CANCELLED = 'leave_cancelled',
  LEAVE_BALANCE_UPDATED = 'leave_balance_updated',
  COMPENSATORY_LEAVE_ASSIGNED = 'compensatory_leave_assigned',
  
  // Payroll
  PAYSLIP_GENERATED = 'payslip_generated',
  SALARY_PROCESSED = 'salary_processed',
  PAYROLL_HR_APPROVED = 'payroll_hr_approved',
  PAYROLL_FINANCE_APPROVED = 'payroll_finance_approved',
  SALARY_TRANSFER_INITIATED = 'salary_transfer_initiated',
  SALARY_TRANSFER_COMPLETED = 'salary_transfer_completed',
  SALARY_TRANSFER_FAILED = 'salary_transfer_failed',
  
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
