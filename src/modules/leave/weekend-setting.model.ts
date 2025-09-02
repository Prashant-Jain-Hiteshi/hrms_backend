import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt } from 'sequelize-typescript';

interface WeekendSettingCreationAttributes {
  weekends: number[]; // 0..6
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
