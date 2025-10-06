import { IsString, IsNotEmpty, IsNumber, IsDateString, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateExpenseReimbursementDto {
  @ApiProperty({
    description: 'Expense category ID',
    example: 'uuid-category-id',
  })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    description: 'Expense amount',
    example: 1500.50,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @ApiProperty({
    description: 'Date when expense occurred',
    example: '2024-01-15',
  })
  @IsDateString()
  expenseDate: string;

  @ApiProperty({
    description: 'Description of the expense',
    example: 'Business lunch with client',
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    description: 'Vendor or merchant name',
    example: 'Restaurant ABC',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  vendor?: string;

  @ApiPropertyOptional({
    description: 'Business purpose of the expense',
    example: 'Client meeting to discuss project requirements',
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  businessPurpose?: string;
}
