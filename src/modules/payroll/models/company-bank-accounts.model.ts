import {
  Table,
  Column,
  Model,
  DataType,
  ForeignKey,
  BelongsTo,
  AllowNull,
  Default,
  PrimaryKey,
} from 'sequelize-typescript';
import { Company } from '../../companies/companies.model';

@Table({ tableName: 'company_bank_accounts', timestamps: true })
export class CompanyBankAccount extends Model {
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
  @Column({ type: DataType.STRING(100) })
  declare bankName: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING(100) })
  declare branchName: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING(50) })
  declare accountNumber: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING(20) })
  declare ifscCode: string;

  @AllowNull(false)
  @Default(false)
  @Column({ type: DataType.BOOLEAN })
  declare isDefault: boolean;

  @AllowNull(false)
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare isActive: boolean;

  @AllowNull(true)
  @Column({ type: DataType.STRING(100) })
  declare accountHolderName?: string;

  @AllowNull(true)
  @Column({ type: DataType.TEXT })
  declare notes?: string;
}
