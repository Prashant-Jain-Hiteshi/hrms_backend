import { IsNotEmpty, IsUUID, IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class EmployeeAssignmentDto {
  @IsNotEmpty({ message: 'Employee ID is required' })
  @IsUUID('4', { message: 'Employee ID must be a valid UUID' })
  employeeId: string;

  @IsNotEmpty({ message: 'Reviewer ID is required' })
  @IsUUID('4', { message: 'Reviewer ID must be a valid UUID' })
  reviewerId: string;
}

export class AssignGoalDto {
  goalId?: string;

  @IsArray({ message: 'Assignments must be an array' })
  @ArrayMinSize(1, { message: 'At least one employee assignment is required' })
  @ValidateNested({ each: true })
  @Type(() => EmployeeAssignmentDto)
  assignments: EmployeeAssignmentDto[];
}
