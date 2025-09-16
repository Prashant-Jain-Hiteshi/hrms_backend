import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  IsArray,
  IsNumber,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ProcessDynamicPayrollDto {
  @ApiProperty({
    description: 'Array of employee IDs to process payroll for',
    example: ['uuid1', 'uuid2'],
  })
  @IsArray()
  @IsUUID(4, { each: true })
  employeeIds: string[];

  @ApiProperty({
    description: 'Payroll period start date',
    example: '2024-01-01',
  })
  @IsDateString()
  periodStart: string;

  @ApiProperty({
    description: 'Payroll period end date',
    example: '2024-01-31',
  })
  @IsDateString()
  periodEnd: string;

  @ApiProperty({
    description: 'Optional notes for the payroll batch',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class PayrollCalculationDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsUUID()
  employeeId: string;

  @ApiProperty({ description: 'Period start date' })
  @IsDateString()
  periodStart: string;

  @ApiProperty({ description: 'Period end date' })
  @IsDateString()
  periodEnd: string;
}

export class SalaryStructureDto {
  @ApiProperty({ description: 'Basic salary amount' })
  @IsNumber()
  @Min(0)
  basicSalary: number;

  @ApiProperty({ description: 'House rent allowance' })
  @IsNumber()
  @Min(0)
  houseRentAllowance: number;

  @ApiProperty({ description: 'Medical allowance' })
  @IsNumber()
  @Min(0)
  medicalAllowance: number;

  @ApiProperty({ description: 'Transport allowance' })
  @IsNumber()
  @Min(0)
  transportAllowance: number;

  @ApiProperty({ description: 'Other allowances' })
  @IsNumber()
  @Min(0)
  otherAllowances: number;

  @ApiProperty({ description: 'Provident fund deduction' })
  @IsNumber()
  @Min(0)
  providentFund: number;

  @ApiProperty({ description: 'Tax deduction' })
  @IsNumber()
  @Min(0)
  taxDeduction: number;

  @ApiProperty({ description: 'Other deductions' })
  @IsNumber()
  @Min(0)
  otherDeductions: number;
}

export class PayrollCalculationResponseDto {
  @ApiProperty({ description: 'Employee details' })
  employee: {
    id: string;
    name: string;
    employeeId: string;
    department: string;
    designation: string;
  };

  @ApiProperty({ description: 'Salary structure breakdown' })
  salaryStructure: SalaryStructureDto;

  @ApiProperty({ description: 'Attendance summary' })
  attendanceSummary: {
    totalWorkingDays: number;
    actualWorkingDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    halfDays: number;
  };

  @ApiProperty({ description: 'Leave summary' })
  leaveSummary: {
    totalLeavesAllowed: number;
    leavesTaken: number;
    excessLeaves: number;
    unpaidLeaves: number;
  };

  @ApiProperty({ description: 'Calculated amounts' })
  calculations: {
    grossSalary: number;
    totalAllowances: number;
    totalDeductions: number;
    leaveDeductions: number;
    netSalary: number;
    perDayAmount: number;
  };

  @ApiProperty({ description: 'Period information' })
  period: {
    startDate: string;
    endDate: string;
    totalDays: number;
  };
}
