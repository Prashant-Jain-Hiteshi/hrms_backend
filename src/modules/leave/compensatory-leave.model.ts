import { Table, Column, Model, DataType, ForeignKey, BelongsTo, CreatedAt, UpdatedAt } from 'sequelize-typescript';
import { User } from '../users/users.model';

export enum CompensatoryLeaveStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  USED = 'used'
}

export interface CompensatoryLeaveCreationAttributes {
  userId: string;
  employeeId: string;
  employeeName: string;
  department?: string | null;
  credits: number;
  reason: string;
  assignedDate: string;
  expiryDate: string;
  status?: CompensatoryLeaveStatus;
  assignedBy: string;
  notes?: string | null;
}

@Table({
  tableName: 'compensatory_leaves',
  timestamps: true,
})
export class CompensatoryLeave extends Model<CompensatoryLeave, CompensatoryLeaveCreationAttributes> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  })
  declare id: number;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  userId: string;

  @BelongsTo(() => User)
  user: User;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  employeeId: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  employeeName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  department: string;

  @Column({
    type: DataType.DECIMAL(4, 2),
    allowNull: false,
    validate: {
      min: 0.5,
      max: 10,
    },
  })
  credits: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  reason: string;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
  })
  assignedDate: string;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
  })
  expiryDate: string;

  @Column({
    type: DataType.ENUM(...Object.values(CompensatoryLeaveStatus)),
    allowNull: false,
    defaultValue: CompensatoryLeaveStatus.ACTIVE,
  })
  status: CompensatoryLeaveStatus;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  assignedBy: string;

  @BelongsTo(() => User, 'assignedBy')
  assignedByUser: User;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  notes: string | null;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
