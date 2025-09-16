import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'john.doe@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+1 (555) 123-4567' })
  @IsString()
  @Matches(/^[0-9+()\-\s]{7,20}$/)
  phone: string;

  @ApiPropertyOptional({ example: '123 Market St, SF' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @IsNotEmpty()
  department: string;

  @ApiProperty({ example: 'Software Developer' })
  @IsString()
  @IsNotEmpty()
  designation: string;

  @ApiProperty({ example: '2025-08-25' })
  @IsDateString()
  joiningDate: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salary?: number;

  @ApiProperty({ enum: ['active', 'inactive'], example: 'active' })
  @IsEnum(['active', 'inactive'])
  status: 'active' | 'inactive';
}
