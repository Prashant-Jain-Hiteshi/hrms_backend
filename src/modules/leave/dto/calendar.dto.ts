import { IsArray, ArrayUnique, IsIn, IsOptional, IsString, IsDateString, IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateWeekendsDto {
  @IsArray()
  @ArrayUnique()
  @IsIn([0,1,2,3,4,5,6], { each: true })
  weekends: number[];
}

export class CreateHolidayDto {
  @IsDateString()
  date: string; // yyyy-mm-dd

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEnum(['public','restricted','optional'] as any)
  type?: 'public' | 'restricted' | 'optional';
}

export class UpdateHolidayDto {
  @IsOptional()
  @IsDateString()
  date?: string; // yyyy-mm-dd

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['public','restricted','optional'] as any)
  type?: 'public' | 'restricted' | 'optional';
}
