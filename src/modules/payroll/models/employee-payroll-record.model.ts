import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  HasMany,
  AllowNull,
  Default,
  PrimaryKey,
  Index,
} from 'sequelize-typescript';
import { Company } from '../../companies/companies.model';
import { Employee } from '../../employees/employees.model';
import { User } from '../../users/users.model';

export enum PayrollStatus {
  DRAFT = 'DRAFT',
  CALCULATED = 'CALCULATED',
  HR_APPROVED = 'HR_APPROVED',
  PROCESSED = 'PROCESSED',
}

@Table({
  tableName: 'employee_payroll_records',
  timestamps: true,
})
export class EmployeePayrollRecord extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => Company)
  @Index
  @Column({ type: DataType.UUID })
  declare tenantId: string;

  @BelongsTo(() => Company)
  declare company?: Company;

  @AllowNull(false)
  @ForeignKey(() => Employee)
  @Index
  @Column({ type: DataType.UUID })
  declare employeeId: string;

  @BelongsTo(() => Employee)
  declare employee?: Employee;

  @AllowNull(false)
  @Index
  @Column({ type: DataType.STRING(7) }) // YYYY-MM
  declare month: string;

  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare year: number;

  // Salary Components
  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(12, 2) })
  declare baseSalary: number;

  @AllowNull(false)
  @Default('{}')
  @Column({ type: DataType.JSON })
  declare allowances: object;

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(12, 2) })
  declare grossSalary: number;

  @AllowNull(false)
  @Default('{}')
  @Column({ type: DataType.JSON })
  declare deductions: object;

  @AllowNull(false)
  @Default(0)
  @Column({ type: DataType.DECIMAL(10, 2) })
  declare lwpDeduction: number;

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(12, 2) })
  declare totalDeductions: number;

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(12, 2) })
  declare netSalary: number;

  // Working Days
  @AllowNull(false)
  @Column({ type: DataType.INTEGER })
  declare workingDays: number;

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare paidDays: number;

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare unpaidDays: number;

  // Status & Tracking
  @AllowNull(false)
  @Default(PayrollStatus.DRAFT)
  @Index
  @Column({
    type: DataType.ENUM(...Object.values(PayrollStatus)),
  })
  declare status: PayrollStatus;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID })
  declare calculatedBy?: string;

  @BelongsTo(() => User, { foreignKey: 'calculatedBy', as: 'calculator' })
  declare calculator?: User;

  @AllowNull(true)
  @Column({ type: DataType.DATE })
  declare calculatedAt?: Date;

  @AllowNull(true)
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID })
  declare approvedBy?: string;

  @BelongsTo(() => User, { foreignKey: 'approvedBy', as: 'approver' })
  declare approver?: User;

  @AllowNull(true)
  @Column({ type: DataType.DATE })
  declare approvedAt?: Date;
}

// PayrollAdjustment Model
@Table({
  tableName: 'payroll_adjustments',
  timestamps: true,
})
export class PayrollAdjustment extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column({ type: DataType.UUID })
  declare tenantId: string;

  @BelongsTo(() => Company)
  declare company?: Company;

  @AllowNull(false)
  @ForeignKey(() => EmployeePayrollRecord)
  @Column({ type: DataType.UUID })
  declare payrollRecordId: string;

  @BelongsTo(() => EmployeePayrollRecord)
  declare payrollRecord?: EmployeePayrollRecord;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM('ALLOWANCE', 'DEDUCTION'),
  })
  declare adjustmentType: 'ALLOWANCE' | 'DEDUCTION';

  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare adjustmentName: string;

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(10, 2) })
  declare amount: number;

  @AllowNull(true)
  @Column({ type: DataType.TEXT })
  declare reason?: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID })
  declare adjustedBy: string;

  @BelongsTo(() => User, { foreignKey: 'adjustedBy' })
  declare adjuster?: User;
}

// PayrollApproval Model
@Table({
  tableName: 'payroll_approvals',
  timestamps: true,
})
export class PayrollApproval extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column({ type: DataType.UUID })
  declare tenantId: string;

  @BelongsTo(() => Company)
  declare company?: Company;

  @AllowNull(false)
  @ForeignKey(() => EmployeePayrollRecord)
  @Column({ type: DataType.UUID })
  declare payrollRecordId: string;

  @BelongsTo(() => EmployeePayrollRecord)
  declare payrollRecord?: EmployeePayrollRecord;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column({ type: DataType.UUID })
  declare approvedBy: string;

  @BelongsTo(() => User, { foreignKey: 'approvedBy' })
  declare approver?: User;

  @AllowNull(false)
  @Default('APPROVED')
  @Column({
    type: DataType.ENUM('PENDING', 'APPROVED', 'REJECTED'),
  })
  declare approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';

  @AllowNull(true)
  @Column({ type: DataType.TEXT })
  declare approvalNotes?: string;

  @AllowNull(false)
  @Default(DataType.NOW)
  @Column({ type: DataType.DATE })
  declare approvedAt: Date;
}
