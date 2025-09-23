import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsUUID,
  Min,
  Max,
  Length,
  IsArray,
  ValidateNested,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ComponentType, CalculationMethod } from '../models/pay-components.model';

// Pay Components DTOs
export class CreatePayComponentDto {
  @ApiProperty({ description: 'Component name', example: 'Basic Salary' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  name: string;

  @ApiProperty({ description: 'Component type', enum: ComponentType })
  @IsEnum(ComponentType)
  type: ComponentType;

  @ApiProperty({ description: 'Calculation method', enum: CalculationMethod })
  @IsEnum(CalculationMethod)
  calculationMethod: CalculationMethod;

  @ApiProperty({ description: 'Component value', example: 50000 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ description: 'Is taxable', example: true })
  @IsBoolean()
  @IsOptional()
  taxable?: boolean = true;

  @ApiProperty({ description: 'Component description', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdatePayComponentDto {
  @ApiProperty({ description: 'Component name', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  name?: string;

  @ApiProperty({ description: 'Component type', enum: ComponentType, required: false })
  @IsEnum(ComponentType)
  @IsOptional()
  type?: ComponentType;

  @ApiProperty({ description: 'Calculation method', enum: CalculationMethod, required: false })
  @IsEnum(CalculationMethod)
  @IsOptional()
  calculationMethod?: CalculationMethod;

  @ApiProperty({ description: 'Component value', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  value?: number;

  @ApiProperty({ description: 'Is taxable', required: false })
  @IsBoolean()
  @IsOptional()
  taxable?: boolean;

  @ApiProperty({ description: 'Is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Component description', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}

// Company Bank Account DTOs
export class CreateCompanyBankAccountDto {
  @ApiProperty({ description: 'Bank name', example: 'State Bank of India' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  bankName: string;

  @ApiProperty({ description: 'Branch name', example: 'Main Branch' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  branchName: string;

  @ApiProperty({ description: 'Account number', example: '1234567890' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  accountNumber: string;

  @ApiProperty({ description: 'IFSC code', example: 'SBIN0000123' })
  @IsString()
  @IsNotEmpty()
  @Length(11, 11)
  ifscCode: string;

  @ApiProperty({ description: 'Is default account', example: true })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean = false;

  @ApiProperty({ description: 'Account holder name', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  accountHolderName?: string;

  @ApiProperty({ description: 'Notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateCompanyBankAccountDto {
  @ApiProperty({ description: 'Bank name', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  bankName?: string;

  @ApiProperty({ description: 'Branch name', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  branchName?: string;

  @ApiProperty({ description: 'Account number', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  accountNumber?: string;

  @ApiProperty({ description: 'IFSC code', required: false })
  @IsString()
  @IsOptional()
  @Length(11, 11)
  ifscCode?: string;

  @ApiProperty({ description: 'Is default account', required: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @ApiProperty({ description: 'Is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Account holder name', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  accountHolderName?: string;

  @ApiProperty({ description: 'Notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

// Salary Template DTOs
export class SalaryTemplateComponentDto {
  @ApiProperty({ description: 'Component ID' })
  @IsUUID()
  componentId: string;

  @ApiProperty({ description: 'Component value', example: 50000 })
  @IsNumber()
  @Min(0)
  value: number;
}

export class CreateSalaryTemplateDto {
  @ApiProperty({ description: 'Template name', example: 'Senior Developer Template' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  templateName: string;

  @ApiProperty({ description: 'Template description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Template components', type: [SalaryTemplateComponentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalaryTemplateComponentDto)
  components: SalaryTemplateComponentDto[];
}

export class UpdateSalaryTemplateDto {
  @ApiProperty({ description: 'Template name', required: false })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  templateName?: string;

  @ApiProperty({ description: 'Is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Template description', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Template components', type: [SalaryTemplateComponentDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalaryTemplateComponentDto)
  @IsOptional()
  components?: SalaryTemplateComponentDto[];
}

// Statutory Settings DTOs
export class UpdateStatutorySettingsDto {
  @ApiProperty({ description: 'PF minimum salary', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  pfMinimumSalary?: number;

  @ApiProperty({ description: 'PF employee rate (%)', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  pfEmployeeRate?: number;

  @ApiProperty({ description: 'PF employer rate (%)', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  pfEmployerRate?: number;

  @ApiProperty({ description: 'ESI minimum salary', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  esiMinimumSalary?: number;

  @ApiProperty({ description: 'ESI employee rate (%)', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  esiEmployeeRate?: number;

  @ApiProperty({ description: 'ESI employer rate (%)', required: false })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  esiEmployerRate?: number;

  @ApiProperty({ description: 'Professional tax amount', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  professionalTaxAmount?: number;

  @ApiProperty({ description: 'Professional tax minimum salary', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  professionalTaxMinimumSalary?: number;

  @ApiProperty({ description: 'TDS exemption limit', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  tdsExemptionLimit?: number;

  @ApiProperty({ description: 'Notes', required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

// Company Info Update DTO - Temporarily reduced to match current database schema
export class UpdateCompanyPayrollInfoDto {
  @ApiProperty({ description: 'Company name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: 'Company address', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  // @ApiProperty({ description: 'GSTIN', required: false })
  // @IsOptional()
  // @IsString()
  // @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GSTIN format' })
  // gstin?: string;

  // @ApiProperty({ description: 'PAN number', required: false })
  // @IsOptional()
  // @IsString()
  // @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format' })
  // panNumber?: string;

  @ApiProperty({ description: 'Payroll cycle', enum: ['MONTHLY', 'WEEKLY', 'BI_WEEKLY'], required: false })
  @IsOptional()
  @IsEnum(['MONTHLY', 'WEEKLY', 'BI_WEEKLY'])
  payrollCycle?: 'MONTHLY' | 'WEEKLY' | 'BI_WEEKLY';

  // @ApiProperty({ description: 'City', required: false })
  // @IsOptional()
  // @IsString()
  // city?: string;

  // @ApiProperty({ description: 'State', required: false })
  // @IsOptional()
  // @IsString()
  // state?: string;

  // @ApiProperty({ description: 'Pincode', required: false })
  // @IsOptional()
  // @IsString()
  // @Matches(/^\d{6}$/, { message: 'Pincode must be 6 digits' })
  // pincode?: string;

  // @ApiProperty({ description: 'Payroll processing date (day of month)', minimum: 1, maximum: 31, required: false })
  // @IsOptional()
  // @IsNumber()
  // @Min(1)
  // @Max(31)
  // payrollProcessingDate?: number;

  // @ApiProperty({ description: 'Salary disbursement date (day of month)', minimum: 1, maximum: 31, required: false })
  // @IsOptional()
  // @IsNumber()
  // @Min(1)
  // @Max(31)
  // salaryDisbursementDate?: number;
}

// Payroll Test Calculation DTO
export class PayrollTestCalculationDto {
  @ApiProperty({ description: 'Basic salary for calculation', example: 50000 })
  @IsNumber()
  @Min(0)
  basicSalary: number;

  @ApiProperty({ description: 'Salary template ID', required: false })
  @IsUUID()
  @IsOptional()
  templateId?: string;

  @ApiProperty({ description: 'Manual components', type: [SalaryTemplateComponentDto], required: false })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalaryTemplateComponentDto)
  @IsOptional()
  components?: SalaryTemplateComponentDto[];
}
