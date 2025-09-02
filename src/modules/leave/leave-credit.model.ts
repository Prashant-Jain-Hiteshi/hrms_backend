import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, ForeignKey, BelongsTo } from 'sequelize-typescript';
import { Employee } from '../employees/employees.model';

interface LeaveCreditCreationAttributes {
  employeeId: string;
  leaveType: string;
  creditedAmount: number;
  creditDate: Date;
  creditedForMonth: string;
  creditedForYear: number;
  description?: string;
}

@Table({
  tableName: 'leave_credits',
  timestamps: true,
})
export class LeaveCredit extends Model<LeaveCredit, LeaveCreditCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @ForeignKey(() => Employee)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  employeeId: string;

  @Column({
    type: DataType.ENUM('annual', 'sick', 'personal', 'maternity', 'paternity', 'casual'),
    allowNull: false,
  })
  leaveType: string;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
  })
  creditedAmount: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  creditDate: Date;

  @Column({
    type: DataType.STRING(7), // Format: "2024-01"
    allowNull: false,
  })
  creditedForMonth: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  creditedForYear: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description: string;

  @BelongsTo(() => Employee)
  employee: Employee;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}

interface LeaveCreditConfigCreationAttributes {
  leaveType: string;
  monthlyCredit: number;
  maxAnnualLimit?: number;
  isActive?: boolean;
  description?: string;
}

@Table({
  tableName: 'leave_credit_configs',
  timestamps: true,
})
export class LeaveCreditConfig extends Model<LeaveCreditConfig, LeaveCreditConfigCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.ENUM('annual', 'sick', 'personal', 'maternity', 'paternity', 'casual'),
    allowNull: false,
    unique: true,
  })
  leaveType: string;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: false,
    defaultValue: 0,
    get(this: LeaveCreditConfig) {
      const value = this.getDataValue('monthlyCredit');
      return value ? parseFloat(value.toString()) : 0;
    }
  })
  monthlyCredit: number;

  @Column({
    type: DataType.DECIMAL(5, 2),
    allowNull: true,
    get(this: LeaveCreditConfig) {
      const value = this.getDataValue('maxAnnualLimit');
      return value ? parseFloat(value.toString()) : null;
    }
  })
  maxAnnualLimit: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  isActive: boolean;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
