import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  PrimaryKey,
  AllowNull,
  Unique,
  BelongsTo,
} from 'sequelize-typescript';
import { User } from '../users/users.model';

@Table({ tableName: 'employees', timestamps: true })
export class Employee extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  declare employeeId: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  declare email: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare phone: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare address?: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare department: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare designation: string;

  @AllowNull(false)
  @Column(DataType.DATEONLY)
  declare joiningDate: string;

  @AllowNull(true)
  @Column(DataType.DECIMAL(10, 2))
  declare salary?: number;

  @AllowNull(false)
  @Column({ type: DataType.ENUM('active', 'inactive'), defaultValue: 'active' })
  declare status: 'active' | 'inactive';

  // Association with User
  @BelongsTo(() => User, { foreignKey: 'email', targetKey: 'email', as: 'user' })
  declare user?: User;
}
