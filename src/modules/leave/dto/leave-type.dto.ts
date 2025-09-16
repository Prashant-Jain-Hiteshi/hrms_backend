import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLeaveTypeDto {
  @ApiProperty({
    description: 'Name of the leave type',
    example: 'Annual Leave',
  })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'Number of leaves allowed per year',
    example: 20,
  })
  @IsNumber()
  @Min(0)
  numberOfLeaves: number;

  @ApiPropertyOptional({ description: 'Description of the leave type' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether approval is required',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Whether carry forward is allowed',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  carryForward?: boolean;

  @ApiPropertyOptional({
    description: 'Whether encashment is allowed',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  encashment?: boolean;

  @ApiPropertyOptional({
    description: 'Employee eligibility',
    enum: ['all', 'permanent', 'contract', 'senior'],
    default: 'all',
  })
  @IsOptional()
  @IsEnum(['all', 'permanent', 'contract', 'senior'])
  eligibility?: string;
}

export class UpdateLeaveTypeDto {
  @ApiPropertyOptional({ description: 'Name of the leave type' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Number of leaves allowed per year' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  numberOfLeaves?: number;

  @ApiPropertyOptional({ description: 'Description of the leave type' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: 'Whether approval is required' })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ description: 'Whether carry forward is allowed' })
  @IsOptional()
  @IsBoolean()
  carryForward?: boolean;

  @ApiPropertyOptional({ description: 'Whether encashment is allowed' })
  @IsOptional()
  @IsBoolean()
  encashment?: boolean;

  @ApiPropertyOptional({
    description: 'Employee eligibility',
    enum: ['all', 'permanent', 'contract', 'senior'],
  })
  @IsOptional()
  @IsEnum(['all', 'permanent', 'contract', 'senior'])
  eligibility?: string;

  @ApiPropertyOptional({ description: 'Whether leave type is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
