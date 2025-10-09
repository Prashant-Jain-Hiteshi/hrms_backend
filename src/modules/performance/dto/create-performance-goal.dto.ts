import { IsNotEmpty, IsString, IsEnum, MaxLength, MinLength } from 'class-validator';
import { GoalCategory } from '../models/performance-goal.model';

export class CreatePerformanceGoalDto {
  @IsNotEmpty({ message: 'Goal name is required' })
  @IsString({ message: 'Goal name must be a string' })
  @MinLength(3, { message: 'Goal name must be at least 3 characters long' })
  @MaxLength(100, { message: 'Goal name cannot exceed 100 characters' })
  goalName: string;

  @IsNotEmpty({ message: 'Category is required' })
  @IsEnum(GoalCategory, { message: 'Invalid category selected' })
  category: GoalCategory;

  @IsNotEmpty({ message: 'Description is required' })
  @IsString({ message: 'Description must be a string' })
  @MinLength(1, { message: 'Description is required' })
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description: string;
}
