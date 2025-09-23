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

export enum ComponentType {
  EARNING = 'EARNING',
  DEDUCTION = 'DEDUCTION',
}

export enum CalculationMethod {
  FIXED = 'FIXED',
  PERCENTAGE_OF_BASIC = 'PERCENTAGE_OF_BASIC',
  PERCENTAGE_OF_CTC = 'PERCENTAGE_OF_CTC',
}

@Table({ tableName: 'pay_components', timestamps: true })
export class PayComponent extends Model {
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
  declare name: string;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM(...Object.values(ComponentType)),
  })
  declare type: ComponentType;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM(...Object.values(CalculationMethod)),
  })
  declare calculationMethod: CalculationMethod;

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(10, 2) })
  declare value: number;

  @AllowNull(false)
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare taxable: boolean;

  @AllowNull(false)
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare isActive: boolean;

  @AllowNull(true)
  @Column({ type: DataType.TEXT })
  declare description?: string;
}
