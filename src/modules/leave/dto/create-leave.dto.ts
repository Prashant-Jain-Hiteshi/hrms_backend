import { IsNotEmpty, IsString, IsEnum, IsArray, IsOptional, IsDateString, IsUUID } from 'class-validator';

export class CreateLeaveDto {
  @IsNotEmpty()
  @IsEnum(['sick', 'casual', 'annual', 'maternity', 'paternity', 'emergency', 'other'])
  leaveType: 'sick' | 'casual' | 'annual' | 'maternity' | 'paternity' | 'emergency' | 'other';

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
