import { IsOptional, IsString, IsEnum, IsUUID, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class JobQueryDto {
  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 10,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Search in title and location',
    example: 'software engineer',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by department ID',
    example: 'uuid-here',
  })
  @IsOptional()
  @IsUUID()
  department?: string;

  @ApiPropertyOptional({
    description: 'Filter by job status',
    enum: ['active', 'inactive', 'closed'],
    example: 'active',
  })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'closed'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by job type',
    enum: ['full-time', 'part-time', 'contract', 'internship'],
    example: 'full-time',
  })
  @IsOptional()
  @IsEnum(['full-time', 'part-time', 'contract', 'internship'])
  jobType?: string;
}
