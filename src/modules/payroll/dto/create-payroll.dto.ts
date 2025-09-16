import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PayrollStatus } from '../payroll.model';

export class CreatePayrollDto {
  @IsUUID()
  employeeId: string;

  @IsDateString()
  payPeriodStart: Date;

  @IsDateString()
  payPeriodEnd: Date;

  @IsNumber()
  basicSalary: number;

  @IsNumber()
  allowances: number;

  @IsNumber()
  deductions: number;

  @IsNumber()
  netSalary: number;

  @IsOptional()
  @IsEnum(PayrollStatus)
  status?: PayrollStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
