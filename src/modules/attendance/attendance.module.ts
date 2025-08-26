import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Attendance } from './attendance.model';
import { AttendanceSession } from './attendance-session.model';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { Employee } from '../employees/employees.model';
import { User } from '../users/users.model';

@Module({
  imports: [SequelizeModule.forFeature([Attendance, AttendanceSession, Employee, User])],
  providers: [AttendanceService],
  controllers: [AttendanceController],
  exports: [AttendanceService],
})
export class AttendanceModule {}
