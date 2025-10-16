import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, ForeignKey, BelongsTo, AllowNull } from 'sequelize-typescript';
import { Company } from '../companies/companies.model';

interface WeekendSettingCreationAttributes {
  weekends: number[]; // 0..6
  tenantId: string;
}

@Table({
  tableName: 'weekend_settings',
  timestamps: true,
})
export class WeekendSetting extends Model<WeekendSetting, WeekendSettingCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  // Tenant relationship
  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column({ type: DataType.UUID })
  declare tenantId: string;

  @BelongsTo(() => Company)
  declare company?: Company;

  @Column({
    type: DataType.JSON,
    allowNull: false,
    defaultValue: [0, 6],
  })
  declare weekends: number[];

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
