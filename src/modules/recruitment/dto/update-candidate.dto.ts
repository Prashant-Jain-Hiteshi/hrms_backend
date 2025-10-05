import { IsString, IsEmail, IsOptional, IsEnum, IsInt, Min, Max, Length } from 'class-validator';
import { CandidateStatus } from '../models/candidate.model';

export class UpdateCandidateDto {
  @IsOptional()
  @IsString()
  @Length(2, 100, { message: 'Full name must be between 2 and 100 characters' })
  fullName?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @Length(0, 20, { message: 'Phone number must be less than 20 characters' })
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100, { message: 'Position must be between 2 and 100 characters' })
  position?: string;

  @IsOptional()
  @IsInt({ message: 'Experience must be a number' })
  @Min(0, { message: 'Experience cannot be negative' })
  @Max(50, { message: 'Experience cannot exceed 50 years' })
  experience?: number;

  @IsOptional()
  @IsEnum(CandidateStatus, { message: 'Invalid candidate status' })
  status?: CandidateStatus;
}
