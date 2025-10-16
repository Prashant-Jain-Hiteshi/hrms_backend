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
  HasMany,
} from 'sequelize-typescript';
import { Company } from '../../companies/companies.model';
import { Job } from './job.model';

@Table({ tableName: 'departments', timestamps: true })
export class Department extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare description?: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column({ type: DataType.UUID })
  declare tenantId: string;

  @BelongsTo(() => Company)
  declare company?: Company;

  @HasMany(() => Job)
  declare jobs?: Job[];
}
