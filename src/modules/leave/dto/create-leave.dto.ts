import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsDateString,
  IsUUID,
} from 'class-validator';

export class CreateLeaveDto {
  @IsNotEmpty()
  @IsString()
  leaveType: string;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsString()
  startTime: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @IsNotEmpty()
  @IsString()
  endTime: string;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsNotEmpty()
  @IsArray()
  @IsUUID('4', { each: true })
  toEmployees: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  ccEmployees?: string[];
}

export class UpdateLeaveStatusDto {
  @IsNotEmpty()
  @IsEnum(['approved', 'rejected'])
  status: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  allocation?: any;
}
