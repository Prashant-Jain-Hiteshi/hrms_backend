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
import { Department } from './department.model';
import { Candidate } from './candidate.model';

@Table({ tableName: 'jobs', timestamps: true })
export class Job extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @ForeignKey(() => Department)
  @Column({ type: DataType.UUID })
  declare departmentId: string;

  @BelongsTo(() => Department)
  declare department: Department;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare location: string;

  @AllowNull(false)
  @Column({ 
    type: DataType.ENUM('full-time', 'part-time', 'contract', 'internship'),
    defaultValue: 'full-time'
  })
  declare jobType: string;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare experienceRequired: number;

  @AllowNull(true)
  @Column(DataType.DATEONLY)
  declare applicationDeadline?: string;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare description: string;

  @AllowNull(false)
  @Column({ 
    type: DataType.ENUM('active', 'inactive', 'closed'), 
    defaultValue: 'active' 
  })
  declare status: string;

  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column({ type: DataType.UUID })
  declare tenantId: string;

  @BelongsTo(() => Company)
  declare company?: Company;

  @HasMany(() => Candidate)
  declare candidates?: Candidate[];
}
