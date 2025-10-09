import { IsOptional, IsEnum, IsString, MaxLength } from 'class-validator';
import { AssignmentStatus } from '../models/performance-goal-assignment.model';

export class UpdateAssignmentDto {
  @IsOptional()
  @IsEnum(AssignmentStatus, { message: 'Invalid assignment status' })
  status?: AssignmentStatus;

  @IsOptional()
  @IsString({ message: 'Employee comments must be a string' })
  @MaxLength(2000, { message: 'Employee comments cannot exceed 2000 characters' })
  employeeComments?: string;

  @IsOptional()
  @IsString({ message: 'Reviewer comments must be a string' })
  @MaxLength(2000, { message: 'Reviewer comments cannot exceed 2000 characters' })
  reviewerComments?: string;
}
