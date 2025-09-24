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
  Index,
} from 'sequelize-typescript';
import { Employee } from '../../employees/employees.model';
import { Company } from '../../companies/companies.model';

@Table({ 
  tableName: 'employee_monthly_leave_records', 
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['employeeId', 'month', 'tenantId'],
      name: 'unique_employee_month_tenant'
    }
  ]
})
export class EmployeeMonthlyLeaveRecord extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => Employee)
  @Index
  @Column(DataType.UUID)
  declare employeeId: string;

  @BelongsTo(() => Employee)
  declare employee?: Employee;

  // Tenant relationship
  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column({ type: DataType.UUID })
  declare tenantId: string;

  @BelongsTo(() => Company)
  declare company?: Company;

  // Month in YYYY-MM format
  @AllowNull(false)
  @Index
  @Column(DataType.STRING(7))
  declare month: string;

  // Year for easier querying
  @AllowNull(false)
  @Index
  @Column(DataType.INTEGER)
  declare year: number;

  // Leave Balance Data (same as UI columns)
  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare opening: number;

  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare monthlyCredit: number;

  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare extraCredit: number;

  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare deducted: number;

  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare lwp: number;

  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare closing: number;

  // Attendance Data (same as UI columns)
  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare present: number;

  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare absent: number;

  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare effectivePresent: number;

  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare effectiveAbsent: number;

  // The key field for payroll calculation
  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare paidDays: number;

  // Additional metadata
  @AllowNull(true)
  @Column(DataType.TEXT)
  declare extraCreditBreakdown?: string;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare calculatedAt?: Date;

  // Note: Unique constraint is defined at table level in @Table decorator
}
