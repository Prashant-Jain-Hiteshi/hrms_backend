import { IsNotEmpty, IsString, IsNumber, IsDateString, IsOptional, IsEnum, Min, Max, IsInt } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CompensatoryLeaveStatus } from '../compensatory-leave.model';

export class CreateCompensatoryLeaveDto {
  @ApiProperty({ description: 'Employee ID' })
  @IsNotEmpty()
  @IsString()
  employeeId: string;

  @ApiProperty({ description: 'Number of compensatory leave credits (0.5 to 10 days)', minimum: 0.5, maximum: 10 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0.5)
  @Max(10)
  credits: number;

  @ApiProperty({ description: 'Reason for compensatory leave assignment' })
  @IsNotEmpty()
  @IsString()
  reason: string;

  @ApiProperty({ description: 'Expiry date for the compensatory leave (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  expiryDate: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCompensatoryLeaveDto {
  @ApiPropertyOptional({ description: 'Number of compensatory leave credits (0.5 to 10 days)', minimum: 0.5, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  @Max(10)
  credits?: number;

  @ApiPropertyOptional({ description: 'Reason for compensatory leave assignment' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Expiry date for the compensatory leave (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'Status of the compensatory leave', enum: CompensatoryLeaveStatus })
  @IsOptional()
  @IsEnum(CompensatoryLeaveStatus)
  status?: CompensatoryLeaveStatus;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CompensatoryLeaveQueryDto {
  @ApiPropertyOptional({ description: 'Filter by employee ID' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ description: 'Filter by status', enum: CompensatoryLeaveStatus })
  @IsOptional()
  @IsEnum(CompensatoryLeaveStatus)
  status?: CompensatoryLeaveStatus;

  @ApiPropertyOptional({ description: 'Filter by department' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: 'Start date for date range filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for date range filter (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CompensatoryLeaveResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  userId: number;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  employeeName: string;

  @ApiProperty()
  department: string;

  @ApiProperty()
  credits: number;

  @ApiProperty()
  reason: string;

  @ApiProperty()
  assignedDate: string;

  @ApiProperty()
  expiryDate: string;

  @ApiProperty({ enum: CompensatoryLeaveStatus })
  status: CompensatoryLeaveStatus;

  @ApiProperty()
  assignedBy: number;

  @ApiProperty()
  assignedByUser?: {
    id: number;
    name: string;
    email: string;
  };

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CompensatoryCreditsSummaryDto {
  @ApiProperty()
  totalActiveCredits: number;

  @ApiProperty()
  totalEmployees: number;

  @ApiProperty()
  expiringSoon: number;

  @ApiProperty()
  totalExpired: number;

  @ApiProperty()
  totalUsed: number;
}
