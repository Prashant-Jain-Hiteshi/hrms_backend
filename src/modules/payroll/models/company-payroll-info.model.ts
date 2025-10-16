import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Default,
} from 'sequelize-typescript';
import { Company } from '../../companies/companies.model';

export interface CompanyPayrollInfoAttributes {
  companyId: string;
  tenantId: string;
  companyName?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
  panNumber?: string;
  payrollCycle: 'MONTHLY' | 'WEEKLY' | 'BI_WEEKLY';
  payrollProcessingDate: number;
  salaryDisbursementDate: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompanyPayrollInfoCreationAttributes
  extends Omit<CompanyPayrollInfoAttributes, 'createdAt' | 'updatedAt'> {
  createdAt?: Date;
  updatedAt?: Date;
}

@Table({
  tableName: 'company_payroll_info',
  timestamps: true,
})
export class CompanyPayrollInfo extends Model<
  CompanyPayrollInfoAttributes,
  CompanyPayrollInfoCreationAttributes
> {
  @PrimaryKey
  @ForeignKey(() => Company)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare companyId: string;

  @AllowNull(false)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare tenantId: string;

  // Basic Information
  @AllowNull(true)
  @Column(DataType.STRING)
  declare companyName?: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare address?: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare city?: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare state?: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare pincode?: string;

  // Tax & Payroll Settings
  @AllowNull(true)
  @Column(DataType.STRING)
  declare gstin?: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare panNumber?: string;

  @AllowNull(false)
  @Default('MONTHLY')
  @Column({
    type: DataType.ENUM('MONTHLY', 'WEEKLY', 'BI_WEEKLY'),
  })
  declare payrollCycle: 'MONTHLY' | 'WEEKLY' | 'BI_WEEKLY';

  @AllowNull(false)
  @Default(1)
  @Column(DataType.INTEGER)
  declare payrollProcessingDate: number; // Day of month for payroll processing (1-31)

  @AllowNull(false)
  @Default(5)
  @Column(DataType.INTEGER)
  declare salaryDisbursementDate: number; // Day of month for salary payment (1-31)

  // Relationships
  @BelongsTo(() => Company, 'companyId')
  declare company: Company;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare createdAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  declare updatedAt: Date;
}