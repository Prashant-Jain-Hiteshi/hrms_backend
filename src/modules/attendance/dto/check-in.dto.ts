import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class CheckInDto {
  @ApiProperty({ required: false, example: '2025-08-26' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string; // optional override (YYYY-MM-DD)

  @ApiProperty({ required: false, example: '09:00:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  checkInTime?: string; // optional override (HH:MM[:SS])
}
