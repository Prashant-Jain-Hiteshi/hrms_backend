import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  AutoIncrement,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  BelongsTo,
  AllowNull,
} from 'sequelize-typescript';
import { Company } from '../companies/companies.model';

interface LeaveTypeCreationAttributes {
  name: string;
  numberOfLeaves: number;
  tenantId: string;
  description?: string;
  requiresApproval?: boolean;
  carryForward?: boolean;
  encashment?: boolean;
  eligibility?: string;
  isActive?: boolean;
}

@Table({
  tableName: 'leave_types',
  timestamps: true,
})
export class LeaveType extends Model<LeaveType, LeaveTypeCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  // Tenant relationship
  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column({ type: DataType.UUID })
  declare tenantId: string;

  @BelongsTo(() => Company)
  declare company?: Company;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  numberOfLeaves: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  requiresApproval: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  carryForward: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  encashment: boolean;

  @Column({
    type: DataType.ENUM('all', 'permanent', 'contract', 'senior'),
    allowNull: false,
    defaultValue: 'all',
  })
  eligibility: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  isActive: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
