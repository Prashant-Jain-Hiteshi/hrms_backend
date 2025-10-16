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
  Index,
} from 'sequelize-typescript';
import { User } from '../users/users.model';
import { Employee } from '../employees/employees.model';
import { Company } from '../companies/companies.model';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'half_day';

@Table({ tableName: 'attendance', timestamps: true })
export class Attendance extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Index
  @Column(DataType.UUID)
  declare userId: string;

  @AllowNull(true)
  @ForeignKey(() => Employee)
  @Index
  @Column(DataType.UUID)
  declare employeeId?: string | null;

  // Tenant relationship
  @AllowNull(false)
  @ForeignKey(() => Company)
  @Column({ type: DataType.UUID })
  declare tenantId: string;

  @BelongsTo(() => Company)
  declare company?: Company;

  @AllowNull(false)
  @Index
  @Column(DataType.DATEONLY)
  declare date: string; // YYYY-MM-DD

  @AllowNull(true)
  @Column(DataType.TIME)
  declare checkIn?: string | null; // HH:MM:SS

  @AllowNull(true)
  @Column(DataType.TIME)
  declare checkOut?: string | null; // HH:MM:SS

  @AllowNull(true)
  @Column(DataType.DECIMAL(5, 2))
  declare hoursWorked?: number | null; // e.g., 8.50

  @AllowNull(true)
  @Column({ type: DataType.ENUM('present', 'absent', 'late', 'half_day') })
  declare status?: AttendanceStatus | null;

  @BelongsTo(() => User)
  declare user?: User;

  @BelongsTo(() => Employee)
  declare employee?: Employee;
}
