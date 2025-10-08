import { IsString, IsBoolean, IsOptional, IsInt, IsHexColor, IsArray, IsNumber, MaxLength, MinLength } from 'class-validator';

export class CreateDocumentTypeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  typeName: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  typeCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedExtensions?: string[];

  @IsOptional()
  @IsNumber()
  maxFileSize?: number;

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
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  metadata?: object;
}
