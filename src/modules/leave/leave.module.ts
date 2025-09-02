import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveTypeController } from './leave-type.controller';
import { LeaveTypeService } from './leave-type.service';
import { LeaveRequest, LeaveApprover, LeaveCc, LeaveStatusHistory } from './leave.model';
import { LeaveType } from './leave-type.model';
import { Employee } from '../employees/employees.model';
import { LeaveCredit, LeaveCreditConfig } from './leave-credit.model';
import { Holiday } from './holiday.model';
import { WeekendSetting } from './weekend-setting.model';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CompensatoryLeave } from './compensatory-leave.model';
import { CompensatoryLeaveController } from './compensatory-leave.controller';
import { CompensatoryLeaveService } from './compensatory-leave.service';
import { User } from '../users/users.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      LeaveRequest,
      LeaveApprover,
      LeaveCc,
      LeaveStatusHistory,
      LeaveType,
      Employee,
      LeaveCredit,
      LeaveCreditConfig,
      Holiday,
      WeekendSetting,
      CompensatoryLeave,
      User,
    ]),
  ],
  controllers: [LeaveController, LeaveTypeController, CalendarController, CompensatoryLeaveController],
  providers: [LeaveService, LeaveTypeService, CalendarService, CompensatoryLeaveService],
  exports: [LeaveService, LeaveTypeService, CalendarService, CompensatoryLeaveService],
})
export class LeaveModule {}
