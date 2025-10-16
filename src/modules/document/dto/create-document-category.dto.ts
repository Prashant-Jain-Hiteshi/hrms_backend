import { IsString, IsBoolean, IsOptional, IsInt, IsHexColor, MaxLength, MinLength } from 'class-validator';

export class CreateDocumentCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  categoryName: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  categoryCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsHexColor()
  color?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  metadata?: object;
}
