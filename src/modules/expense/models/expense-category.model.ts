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
} from 'sequelize-typescript';

export interface ExpenseCategoryCreationAttributes {
  tenantId: string;
  categoryName: string;
  categoryCode: string;
  description?: string;
  isActive?: boolean;
  autoApprovalPercent?: number;
}

@Table({
  tableName: 'expense_categories',
  timestamps: true,
})
export class ExpenseCategory extends Model<ExpenseCategory, ExpenseCategoryCreationAttributes> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.UUID)
  tenantId: string;

  @AllowNull(false)
  @Column(DataType.STRING(100))
  categoryName: string;

  @AllowNull(false)
  @Column(DataType.STRING(50))
  categoryCode: string;

  @Column(DataType.TEXT)
  description: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  isActive: boolean;

  @Default(0)
  @Column(DataType.DECIMAL(5, 2))
  autoApprovalPercent: number;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
