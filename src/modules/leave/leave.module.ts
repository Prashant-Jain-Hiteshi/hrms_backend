import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { LeaveRequest, LeaveApprover, LeaveCc, LeaveStatusHistory } from './leave.model';
import { Employee } from '../employees/employees.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      LeaveRequest,
      LeaveApprover,
      LeaveCc,
      LeaveStatusHistory,
      Employee,
    ]),
  ],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
