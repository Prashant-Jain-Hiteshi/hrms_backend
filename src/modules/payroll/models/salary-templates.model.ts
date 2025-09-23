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
} from 'sequelize-typescript';
import { Company } from '../../companies/companies.model';
import { PayComponent } from './pay-components.model';

@Table({ tableName: 'salary_templates', timestamps: true })
export class SalaryTemplate extends Model {
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
  declare templateName: string;

  @AllowNull(false)
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare isActive: boolean;

  @AllowNull(true)
  @Column({ type: DataType.TEXT })
  declare description?: string;

  @HasMany(() => SalaryTemplateComponent)
  declare components: SalaryTemplateComponent[];
}

@Table({ tableName: 'salary_template_components', timestamps: true })
export class SalaryTemplateComponent extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => SalaryTemplate)
  @Column({ type: DataType.UUID })
  declare templateId: string;

  @BelongsTo(() => SalaryTemplate)
  declare template?: SalaryTemplate;

  @AllowNull(false)
  @ForeignKey(() => PayComponent)
  @Column({ type: DataType.UUID })
  declare componentId: string;

  @BelongsTo(() => PayComponent)
  declare component?: PayComponent;

  @AllowNull(false)
  @Column({ type: DataType.DECIMAL(10, 2) })
  declare value: number;

  @AllowNull(false)
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare isActive: boolean;
}
