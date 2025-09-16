import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  PrimaryKey,
  AllowNull,
  ForeignKey,
  BelongsTo,
  HasMany,
} from 'sequelize-typescript';
import { Employee } from '../employees/employees.model';

@Table({ tableName: 'leave_requests', timestamps: true })
export class LeaveRequest extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => Employee)
  @Column({ type: DataType.UUID })
  declare employeeId: string;

  @BelongsTo(() => Employee, 'employeeId')
  declare employee: Employee;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM(
      'sick',
      'casual',
      'annual',
      'maternity',
      'paternity',
      'emergency',
      'other',
    ),
  })
  declare leaveType:
    | 'sick'
    | 'casual'
    | 'annual'
    | 'maternity'
    | 'paternity'
    | 'emergency'
    | 'other';

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  declare startDate: string;

  @AllowNull(false)
  @Column(DataType.TIME)
  declare startTime: string;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  declare endDate: string;

  @AllowNull(false)
  @Column(DataType.TIME)
  declare endTime: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare reason: string;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM('pending', 'approved', 'rejected', 'cancelled'),
    defaultValue: 'pending',
  })
  declare status: 'pending' | 'approved' | 'rejected' | 'cancelled';

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare comments?: string;

  @AllowNull(true)
  @ForeignKey(() => Employee)
  @Column({ type: DataType.UUID })
  declare approvedBy?: string;

  @BelongsTo(() => Employee, 'approvedBy')
  declare approver?: Employee;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare approvedAt?: Date;

  @HasMany(() => LeaveApprover)
  declare toEmployees: LeaveApprover[];

  @HasMany(() => LeaveCc)
  declare ccEmployees: LeaveCc[];

  @HasMany(() => LeaveStatusHistory)
  declare statusHistory: LeaveStatusHistory[];
}

@Table({ tableName: 'leave_approvers', timestamps: true })
export class LeaveApprover extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => LeaveRequest)
  @Column({ type: DataType.UUID })
  declare leaveRequestId: string;

  @BelongsTo(() => LeaveRequest)
  declare leaveRequest: LeaveRequest;

  @AllowNull(false)
  @ForeignKey(() => Employee)
  @Column({ type: DataType.UUID })
  declare employeeId: string;

  @BelongsTo(() => Employee)
  declare employee: Employee;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  })
  declare status: 'pending' | 'approved' | 'rejected';

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare comments?: string;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare actionAt?: Date;
}

@Table({ tableName: 'leave_cc', timestamps: true })
export class LeaveCc extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => LeaveRequest)
  @Column({ type: DataType.UUID })
  declare leaveRequestId: string;

  @BelongsTo(() => LeaveRequest)
  declare leaveRequest: LeaveRequest;

  @AllowNull(false)
  @ForeignKey(() => Employee)
  @Column({ type: DataType.UUID })
  declare employeeId: string;

  @BelongsTo(() => Employee)
  declare employee: Employee;

  @AllowNull(false)
  @Column({ type: DataType.BOOLEAN, defaultValue: false })
  declare isRead: boolean;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare readAt?: Date;
}

@Table({ tableName: 'leave_status_history', timestamps: true })
export class LeaveStatusHistory extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => LeaveRequest)
  @Column({ type: DataType.UUID })
  declare leaveRequestId: string;

  @BelongsTo(() => LeaveRequest)
  declare leaveRequest: LeaveRequest;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM('pending', 'approved', 'rejected', 'cancelled'),
  })
  declare status: 'pending' | 'approved' | 'rejected' | 'cancelled';

  @AllowNull(true)
  @ForeignKey(() => Employee)
  @Column({ type: DataType.UUID })
  declare changedBy?: string;

  @BelongsTo(() => Employee, 'changedBy')
  declare changedByEmployee?: Employee;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare comments?: string;

  @AllowNull(false)
  @Column(DataType.DATE)
  declare changedAt: Date;
}
