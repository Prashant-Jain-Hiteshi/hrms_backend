import { IsOptional, IsString, IsNumber, IsArray, IsObject, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class ProjectDetailsDto {
  @IsOptional()
  @IsString()
  projectName?: string;

  @IsOptional()
  @IsString()
  clientName?: string;

  @IsOptional()
  @IsString()
  projectPhase?: string;

  @IsOptional()
  @IsString()
  yourRole?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  teamSize?: number;

  @IsOptional()
  @IsString()
  projectDuration?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technologiesUsed?: string[];
}

export class LearningOutcomesDto {
  @IsOptional()
  @IsString()
  whatYouLearned?: string;

  @IsOptional()
  @IsString()
  skillsGained?: string;

  @IsOptional()
  @IsString()
  challengesFaced?: string;

  @IsOptional()
  @IsString()
  solutionsImplemented?: string;

  @IsOptional()
  @IsString()
  knowledgeShared?: string;
}

export class FeedbackDataDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ProjectDetailsDto)
  projectDetails?: ProjectDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LearningOutcomesDto)
  learningOutcomes?: LearningOutcomesDto;
}

export class FeedbackRatingsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  responsibility?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  ownership?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  clientEngagement?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  teamCollaboration?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  problemSolving?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  communication?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  initiative?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  qualityOfWork?: number;
}

export class EmployeeFeedbackDto {
  @IsOptional()
  @IsString()
  goalCategory?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FeedbackDataDto)
  feedbackData?: FeedbackDataDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => FeedbackRatingsDto)
  ratings?: FeedbackRatingsDto;
}
