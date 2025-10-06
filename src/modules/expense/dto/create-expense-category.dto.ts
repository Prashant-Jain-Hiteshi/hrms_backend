import { IsString, IsNotEmpty, Length, IsBoolean, IsOptional, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExpenseCategoryDto {
  @ApiProperty({
    description: 'Name of the expense category',
    example: 'Travel',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  categoryName: string;

  @ApiPropertyOptional({
    description: 'Code for the expense category (auto-generated if not provided)',
    example: 'TRAVEL',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  categoryCode?: string;

  @ApiPropertyOptional({
    description: 'Description of the expense category',
    example: 'Business travel including flights, hotels, taxi',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the category is active',
    example: true,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @ApiPropertyOptional({
    description: 'Auto approval percentage (0-100)',
    example: 70,
    minimum: 0,
    maximum: 100,
    default: 0,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  autoApprovalPercent?: number = 0;
}
