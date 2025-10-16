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

@Table({ tableName: 'statutory_settings', timestamps: true })
export class StatutorySettings extends Model {
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

  // PF Settings
  @AllowNull(false)
  @Default(15000)
  @Column({ type: DataType.DECIMAL(10, 2) })
  declare pfMinimumSalary: number;

  @AllowNull(false)
  @Default(12)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare pfEmployeeRate: number; // Employee contribution %

 

  // ESI Settings
  @AllowNull(false)
  @Default(21000)
  @Column({ type: DataType.DECIMAL(10, 2) })
  declare esiMinimumSalary: number;

  @AllowNull(false)
  @Default(0.75)
  @Column({ type: DataType.DECIMAL(5, 2) })
  declare esiEmployeeRate: number; // Employee contribution %

  
  // Professional Tax Settings
  @AllowNull(false)
  @Default(200)
  @Column({ type: DataType.DECIMAL(10, 2) })
  declare professionalTaxAmount: number;

  @AllowNull(false)
  @Default(10000)
  @Column({ type: DataType.DECIMAL(10, 2) })
  declare professionalTaxMinimumSalary: number;

  // TDS Settings
  @AllowNull(false)
  @Default(250000)
  @Column({ type: DataType.DECIMAL(10, 2) })
  declare tdsExemptionLimit: number; // Annual exemption limit

  @AllowNull(false)
  @Default(true)
  @Column({ type: DataType.BOOLEAN })
  declare isActive: boolean;

  @AllowNull(true)
  @Column({ type: DataType.TEXT })
  declare notes?: string;
}
