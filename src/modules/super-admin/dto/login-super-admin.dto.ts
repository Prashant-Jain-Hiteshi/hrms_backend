import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginSuperAdminDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}
