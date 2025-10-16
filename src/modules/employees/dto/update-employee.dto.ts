import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateEmployeeDto } from './create-employee.dto';
import { IsOptional, IsUUID } from 'class-validator';

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {
  // Allow id to be present but ignore it (it's in the URL params anyway)
  @IsOptional()
  @IsUUID()
  id?: string;
}
