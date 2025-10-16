import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  PrimaryKey,
  IsEmail,
  Unique,
  AllowNull,
} from 'sequelize-typescript';

@Table({ tableName: 'super_admins', timestamps: true })
export class SuperAdmin extends Model {
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
  declare name: string;

  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @AllowNull(true)
  @Column(DataType.DATE)
  declare lastLoginAt?: Date | null;

  // Hide sensitive fields from API responses
  toJSON(): Record<string, unknown> {
    const values = this.get({ plain: true }) as Record<string, unknown>;
    const rest: Record<string, unknown> = { ...values };
    delete (rest as { passwordHash?: unknown }).passwordHash;
    return rest;
  }
}
