import { IsString, IsEmail, IsOptional, IsUUID, IsInt, Min, Max, Length } from 'class-validator';

export class CreateCandidateDto {
  @IsString()
  @Length(2, 100, { message: 'Full name must be between 2 and 100 characters' })
  fullName: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsOptional()
  @IsString()
  @Length(0, 20, { message: 'Phone number must be less than 20 characters' })
  phone?: string;

  @IsString()
  @Length(2, 100, { message: 'Position must be between 2 and 100 characters' })
  position: string;

  @IsOptional()
  @IsInt({ message: 'Experience must be a number' })
  @Min(0, { message: 'Experience cannot be negative' })
  @Max(50, { message: 'Experience cannot exceed 50 years' })
  experience?: number;

  @IsUUID(4, { message: 'Invalid job ID format' })
  jobId: string;
}
