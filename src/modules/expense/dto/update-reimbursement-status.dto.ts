import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReimbursementStatusDto {
  @ApiProperty({
    description: 'New status for the reimbursement',
    enum: ['approved', 'rejected', 'paid'],
    example: 'approved',
  })
  @IsString()
  @IsIn(['approved', 'rejected', 'paid'])
  status: string;

  @ApiPropertyOptional({
    description: 'Comments from approver',
    example: 'Approved as per company policy',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  approverComments?: string;
}
