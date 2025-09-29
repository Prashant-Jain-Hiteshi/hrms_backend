import { Table, Column, Model, DataType, Index, Default, AllowNull } from 'sequelize-typescript';

@Table({
  tableName: 'notifications',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'isRead', 'createdAt'] },
    { fields: ['tenantId', 'createdAt'] },
    { fields: ['expiresAt'] },
    { fields: ['userId'] },
    { fields: ['tenantId'] }
  ]
})
export class Notification extends Model<Notification> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  // User targeting (from JWT payload)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  userId: string; // From JWT 'sub' field

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  tenantId: string; // From JWT 'tenantId' field

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  employeeId: string; // From JWT 'employeeId' field (for reference)

  // Notification content
  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  title: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  message: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  type: string; // 'leave_approved', 'leave_rejected', 'leave_pending', etc.

  @Column({
    type: DataType.STRING(50),
    allowNull: false,
  })
  category: string; // 'Leave', 'Payroll', 'Performance', etc.

  // Status & metadata
  @Default(false)
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
  })
  isRead: boolean;

  @Default('normal')
  @Column({
    type: DataType.STRING(20),
    allowNull: false,
  })
  priority: string; // 'low', 'normal', 'high', 'urgent'

  // Related data (for linking to actual records)
  @AllowNull(true)
  @Column({
    type: DataType.STRING(50),
  })
  relatedEntityType: string | null; // 'leave_request', 'payroll', 'employee'

  @AllowNull(true)
  @Column({
    type: DataType.UUID,
  })
  relatedEntityId: string | null; // ID of the related entity

  // Additional metadata for leave notifications
  @AllowNull(true)
  @Column({
    type: DataType.JSON,
  })
  metadata: {
    leaveType?: string;
    startDate?: string;
    endDate?: string;
    days?: number;
    approvedBy?: string;
    rejectionReason?: string;
    [key: string]: any;
  };

  @AllowNull(true)
  @Column({
    type: DataType.DATE,
  })
  readAt: Date;

  @AllowNull(true)
  @Column({
    type: DataType.DATE,
  })
  expiresAt: Date; // For auto-cleanup (10 days from creation)
}
