import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, Min, Max, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCompanyPayrollInfoDto {
  @ApiProperty({ description: 'Company name', required: false })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ description: 'Company address', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: 'City', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ description: 'State', required: false })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({ description: 'Pincode', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Pincode must be 6 digits' })
  pincode?: string;

  @ApiProperty({ description: 'GSTIN', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { 
    message: 'Invalid GSTIN format' 
  })
  gstin?: string;

  @ApiProperty({ description: 'PAN number', required: false })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { 
    message: 'Invalid PAN format' 
  })
  panNumber?: string;

  @ApiProperty({ description: 'Payroll cycle', enum: ['MONTHLY', 'WEEKLY', 'BI_WEEKLY'], required: false })
  @IsOptional()
  @IsEnum(['MONTHLY', 'WEEKLY', 'BI_WEEKLY'])
  payrollCycle?: 'MONTHLY' | 'WEEKLY' | 'BI_WEEKLY';

  @ApiProperty({ description: 'Payroll processing date (day of month)', minimum: 1, maximum: 31, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  payrollProcessingDate?: number;

  @ApiProperty({ description: 'Salary disbursement date (day of month)', minimum: 1, maximum: 31, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  salaryDisbursementDate?: number;
}

export class UpdateCompanyPayrollInfoDto extends CreateCompanyPayrollInfoDto {}
