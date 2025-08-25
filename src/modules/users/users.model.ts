import { Table, Column, Model, DataType, Default, PrimaryKey, IsEmail, Unique, AllowNull } from 'sequelize-typescript';
import { Role } from '../../common/enums/role.enum';

@Table({ tableName: 'users', timestamps: true })
export class User extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @IsEmail
  @Unique
  @AllowNull(false)
  @Column(DataType.STRING)
  declare email: string;

  @AllowNull(false)
  @Column({ type: DataType.STRING })
  declare passwordHash: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare firstName: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare lastName: string;

  @AllowNull(false)
  @Column({
    type: DataType.ENUM('admin', 'hr', 'employee', 'finance'),
  })
  declare role: Role;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare avatarUrl?: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isFirstLogin: boolean;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare lastLoginAt?: Date | null;

  // Hide sensitive fields from API responses
  toJSON() {
    const values = { ...this.get() } as any;
    delete values.passwordHash;
    return values;
  }
}
