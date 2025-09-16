import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Payroll } from './payroll.model';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import { Employee } from '../employees/employees.model';
import { Attendance } from '../attendance/attendance.model';
import { LeaveRequest } from '../leave/leave.model';

@Module({
  imports: [
    SequelizeModule.forFeature([Payroll, Employee, Attendance, LeaveRequest]),
  ],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollCalculationService],
  exports: [PayrollService, PayrollCalculationService],
})
export class PayrollModule {}
