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
    ]),
  ],
  controllers: [LeaveController, LeaveTypeController],
  providers: [LeaveService, LeaveTypeService],
  exports: [LeaveService, LeaveTypeService],
})
export class LeaveModule {}
