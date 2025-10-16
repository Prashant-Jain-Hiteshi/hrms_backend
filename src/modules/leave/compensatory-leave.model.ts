import { Table, Column, Model, DataType, ForeignKey, BelongsTo, CreatedAt, UpdatedAt, AllowNull } from 'sequelize-typescript';
import { User } from '../users/users.model';
import { Company } from '../companies/companies.model';

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
  tenantId: string;
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
  declare userId: string;

  @BelongsTo(() => User)
  declare user: User;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare employeeId: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare employeeName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare department: string;

  @Column({
    type: DataType.DECIMAL(4, 2),
    allowNull: false,
    validate: {
      min: 0.5,
      max: 10,
    },
  })
  declare credits: number;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  declare reason: string;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
  })
  declare assignedDate: string;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
  })
  declare expiryDate: string;

  @Column({
    type: DataType.ENUM(...Object.values(CompensatoryLeaveStatus)),
    allowNull: false,
    defaultValue: CompensatoryLeaveStatus.ACTIVE,
  })
  declare status: CompensatoryLeaveStatus;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare assignedBy: string;

  @BelongsTo(() => User, 'assignedBy')
  declare assignedByUser: User;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare notes: string | null;

  // Tenant relationship
  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column({ type: DataType.UUID })
  declare tenantId: string;

  @BelongsTo(() => Company)
  declare company?: Company;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
