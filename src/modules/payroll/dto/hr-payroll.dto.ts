import { IsArray, IsString, IsOptional, IsNumber, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CalculatePayrollBatchDto {
  @ApiProperty({ 
    description: 'Array of employee IDs to calculate payroll for',
    example: ['uuid1', 'uuid2', 'uuid3']
  })
  @IsArray()
  @IsString({ each: true })
  employeeIds: string[];

  @ApiProperty({ 
    description: 'Month in YYYY-MM format',
    example: '2024-02'
  })
  @IsString()
  month: string;
}

export class AdjustPayrollDto {
  @ApiProperty({ 
    description: 'Type of adjustment',
    enum: ['ALLOWANCE', 'DEDUCTION']
  })
  @IsEnum(['ALLOWANCE', 'DEDUCTION'])
  adjustmentType: 'ALLOWANCE' | 'DEDUCTION';

  @ApiProperty({ 
    description: 'Name of the adjustment',
    example: 'Special Bonus'
  })
  @IsString()
  adjustmentName: string;

  @ApiProperty({ 
    description: 'Adjustment amount',
    example: 5000
  })
  @IsNumber()
  amount: number;

  @ApiProperty({ 
    description: 'Reason for adjustment',
    example: 'Performance bonus for Q1',
    required: false
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkApprovePayrollDto {
  @ApiProperty({ 
    description: 'Array of payroll record IDs to approve',
    example: ['uuid1', 'uuid2', 'uuid3']
  })
  @IsArray()
  @IsString({ each: true })
  payrollRecordIds: string[];

  @ApiProperty({ 
    description: 'Approval notes',
    example: 'Approved after review',
    required: false
  })
  @IsOptional()
  @IsString()
  approvalNotes?: string;
}
