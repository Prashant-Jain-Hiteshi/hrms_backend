import { IsString, IsUUID, IsOptional, IsArray, MaxLength, MinLength } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  documentName: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsUUID()
  categoryId: string;

  @IsUUID()
  typeId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  metadata?: object;
}
