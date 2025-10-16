import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
  CreatedAt,
  UpdatedAt,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';
import { ExpenseCategory } from './expense-category.model';
import { Employee } from '../../employees/employees.model';

export interface ExpenseReimbursementCreationAttributes {
  tenantId: string;
  employeeId: string;
  employeeName?: string;
  categoryId: string;
  amount: number;
  approvedAmount?: number;
  expenseDate: Date;
  description: string;
  vendor?: string;
  businessPurpose?: string;
  receiptUrl?: string;
  status?: string;
  submittedAt?: Date;
  submittedBy?: string;
}

@Table({
  tableName: 'expense_reimbursements',
  timestamps: true,
})
export class ExpenseReimbursement extends Model<ExpenseReimbursement, ExpenseReimbursementCreationAttributes> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.UUID)
  tenantId: string;

  @AllowNull(false)
  @Column(DataType.UUID)
  employeeId: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  employeeName: string;

  @ForeignKey(() => ExpenseCategory)
  @AllowNull(false)
  @Column(DataType.UUID)
  categoryId: string;

  @AllowNull(false)
  @Column(DataType.DECIMAL(10, 2))
  amount: number;

  @Column(DataType.DECIMAL(10, 2))
  approvedAmount: number;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  expenseDate: Date;

  @AllowNull(false)
  @Column(DataType.TEXT)
  description: string;

  @Column(DataType.STRING(255))
  vendor: string;

  @Column(DataType.TEXT)
  businessPurpose: string;

  @Column(DataType.STRING(500))
  receiptUrl: string;

  @Default('submitted')
  @Column(DataType.ENUM('submitted', 'approved', 'rejected', 'paid'))
  status: string;

  @Column(DataType.TEXT)
  approverComments: string;

  // Audit Trail Columns
  @Default(DataType.NOW)
  @Column(DataType.DATE)
  submittedAt: Date;

  @Column(DataType.UUID)
  submittedBy: string;

  @Column(DataType.DATE)
  approvedAt: Date;

  @Column(DataType.UUID)
  approvedBy: string;

  @Column(DataType.DATE)
  paidAt: Date;

  @Column(DataType.UUID)
  paidBy: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => ExpenseCategory)
  category: ExpenseCategory;

  // Try to match by UUID first, then by employeeId string
  @BelongsTo(() => Employee, { foreignKey: 'employeeId', targetKey: 'id', constraints: false })
  employee: Employee;
}
