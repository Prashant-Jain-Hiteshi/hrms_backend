import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
} from 'sequelize-typescript';
import { Employee } from '../employees/employees.model';
import { Company } from '../companies/companies.model';

export enum PayrollStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

@Table({ tableName: 'payrolls', timestamps: true })
export class Payroll extends Model {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV4,
  })
  declare id: string;

  @ForeignKey(() => Employee)
  @Column(DataType.UUID)
  employeeId: string;

  @BelongsTo(() => Employee)
  employee: Employee;

  // Tenant relationship
  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column({ type: DataType.UUID })
  declare tenantId: string;

  @BelongsTo(() => Company)
  declare company?: Company;

  @Column(DataType.DATEONLY)
  payPeriodStart: Date;

  @Column(DataType.DATEONLY)
  payPeriodEnd: Date;

  @Column(DataType.DECIMAL(10, 2))
  basicSalary: number;

  @Column(DataType.DECIMAL(10, 2))
  allowances: number;

  @Column(DataType.DECIMAL(10, 2))
  deductions: number;

  @Column(DataType.DECIMAL(10, 2))
  netSalary: number;

  @Column({
    type: DataType.ENUM(...Object.values(PayrollStatus)),
    defaultValue: PayrollStatus.PENDING,
  })
  status: PayrollStatus;

  @Column(DataType.TEXT)
  notes?: string;
}
