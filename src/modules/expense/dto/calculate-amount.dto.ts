import { IsUUID, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CalculateAmountDto {
  @ApiProperty({
    description: 'Expense category ID',
    example: 'uuid-category-id',
  })
  @IsUUID()
  categoryId: string;

  @ApiProperty({
    description: 'Requested amount',
    example: 1000.00,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Transform(({ value }) => parseFloat(value))
  amount: number;
}
