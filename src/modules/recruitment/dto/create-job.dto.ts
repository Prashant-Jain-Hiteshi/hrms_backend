import { 
  IsString, 
  IsNotEmpty, 
  IsUUID, 
  IsEnum, 
  IsInt, 
  Min, 
  Max, 
  IsOptional, 
  IsDateString,
  MaxLength 
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateJobDto {
  @ApiProperty({
    description: 'Job title',
    example: 'Senior Software Engineer',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    description: 'Department ID',
    example: 'uuid-here',
  })
  @IsUUID()
  @IsNotEmpty()
  departmentId: string;

  @ApiProperty({
    description: 'Job location',
    example: 'San Francisco, CA',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  location: string;

  @ApiProperty({
    description: 'Job type',
    enum: ['full-time', 'part-time', 'contract', 'internship'],
    example: 'full-time',
  })
  @IsEnum(['full-time', 'part-time', 'contract', 'internship'])
  jobType: string;

  @ApiProperty({
    description: 'Experience required in years',
    example: 3,
    minimum: 0,
    maximum: 50,
  })
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(0)
  @Max(50)
  experienceRequired: number;

  @ApiPropertyOptional({
    description: 'Application deadline',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  applicationDeadline?: string;

  @ApiProperty({
    description: 'Job description',
    example: 'We are looking for a senior software engineer...',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    description: 'Job status',
    enum: ['active', 'inactive', 'closed'],
    example: 'active',
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'closed'])
  status?: string;
}
