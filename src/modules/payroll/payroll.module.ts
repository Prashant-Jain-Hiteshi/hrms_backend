import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Payroll } from './payroll.model';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { Employee } from '../employees/employees.model';

@Module({
  imports: [
    SequelizeModule.forFeature([Payroll, Employee]),
  ],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
