import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { Payroll } from './payroll.model';
import { Employee } from '../employees/employees.model';
import { Attendance } from '../attendance/attendance.model';
import { LeaveRequest } from '../leave/leave.model';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import { PayrollSetupController } from './controllers/payroll-setup.controller';
import { PayrollSetupService } from './services/payroll-setup.service';
import { PayComponent } from './models/pay-components.model';
import { CompanyBankAccount } from './models/company-bank-accounts.model';
import { SalaryTemplate, SalaryTemplateComponent } from './models/salary-templates.model';
import { StatutorySettings } from './models/statutory-settings.model';
import { CompanyPayrollInfo } from './models/company-payroll-info.model';
import { Company } from '../companies/companies.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Payroll,
      Employee,
      Attendance,
      LeaveRequest,
      PayComponent,
      CompanyBankAccount,
      SalaryTemplate,
      SalaryTemplateComponent,
      StatutorySettings,
      CompanyPayrollInfo,
      Company,
    ]),
  ],
  controllers: [PayrollController, PayrollSetupController],
  providers: [PayrollService, PayrollCalculationService, PayrollSetupService],
  exports: [PayrollService, PayrollSetupService],
})
export class PayrollModule {}
