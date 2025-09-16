import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveTypeController } from './leave-type.controller';
import { LeaveTypeService } from './leave-type.service';
import {
  LeaveRequest,
  LeaveApprover,
  LeaveCc,
  LeaveStatusHistory,
} from './leave.model';
import { LeaveType } from './leave-type.model';
import { Employee } from '../employees/employees.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      LeaveRequest,
      LeaveApprover,
      LeaveCc,
      LeaveStatusHistory,
      LeaveType,
      Employee,
    ]),
  ],
  controllers: [LeaveController, LeaveTypeController],
  providers: [LeaveService, LeaveTypeService],
  exports: [LeaveService, LeaveTypeService],
})
export class LeaveModule {}
