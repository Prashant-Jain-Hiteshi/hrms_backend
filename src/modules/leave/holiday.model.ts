import { Table, Column, Model, DataType, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt } from 'sequelize-typescript';

interface HolidayCreationAttributes {
  date: string; // yyyy-mm-dd
  name: string;
  type?: 'public' | 'restricted' | 'optional';
  isActive?: boolean;
}

@Table({
  tableName: 'holidays',
  timestamps: true,
})
export class Holiday extends Model<Holiday, HolidayCreationAttributes> {
  @PrimaryKey
  @AutoIncrement
  @Column(DataType.INTEGER)
  declare id: number;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
  })
  declare date: string; // yyyy-mm-dd

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare name: string;

  @Column({
    type: DataType.ENUM('public', 'restricted', 'optional'),
    allowNull: false,
    defaultValue: 'public',
  })
  declare type: 'public' | 'restricted' | 'optional';

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  declare isActive: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
