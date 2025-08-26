import { Table, Column, Model, DataType, Default, PrimaryKey, AllowNull, ForeignKey, BelongsTo, Index } from 'sequelize-typescript';
import { Attendance } from './attendance.model';
import { User } from '../users/users.model';

@Table({ tableName: 'attendance_sessions', timestamps: true })
export class AttendanceSession extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @ForeignKey(() => Attendance)
  @Index
  @Column(DataType.UUID)
  declare attendanceId: string;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Index
  @Column(DataType.UUID)
  declare userId: string;

  // For convenience/querying
  @AllowNull(false)
  @Index
  @Column(DataType.DATEONLY)
  declare date: string; // YYYY-MM-DD

  @AllowNull(false)
  @Column(DataType.TIME)
  declare startTime: string; // HH:MM:SS

  @AllowNull(true)
  @Column(DataType.TIME)
  declare endTime?: string | null; // HH:MM:SS

  @AllowNull(true)
  @Column(DataType.DECIMAL(5,2))
  declare hours?: number | null; // duration for this session

  @BelongsTo(() => Attendance)
  declare attendance?: Attendance;

  @BelongsTo(() => User)
  declare user?: User;
}
