import { Body, Controller, Get, Post, Req, UseGuards, Logger } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { LoginDto } from './dto/login.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

type AuthUser = {
  id: string;
  email: string;
  role: 'admin' | 'hr' | 'employee' | 'finance';
  employeeId: string;
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @UseGuards(LocalAuthGuard)
  async login(@Body() dto: LoginDto, @Req() req: { user: AuthUser }) {
    try {
      this.logger.log(`🔐 Login attempt for email: ${dto.email}`);
      this.logger.log(`📝 Request body received:`, dto);
      
      // LocalAuthGuard puts user on req.user after validation
      if (!req.user) {
        this.logger.error('❌ LocalAuthGuard did not set user on request');
        throw new Error('Authentication failed - no user set by guard');
      }
      
      this.logger.log(`✅ User validated by LocalAuthGuard:`, {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      });
      
      const result = await this.authService.issueToken(req.user);
      this.logger.log(`🎫 Token issued successfully for user: ${req.user.email}`);
      
      return result;
    } catch (error) {
      this.logger.error(`💥 Login error for ${dto.email}:`, error.message);
      this.logger.error(`📊 Error stack:`, error.stack);
      throw error;
    }
  }

  @Post('send-otp')
  @ApiOperation({ summary: 'Send OTP to email for login' })
  async sendOtp(@Body() dto: SendOtpDto) {
    try {
      this.logger.log(`📧 OTP request for email: ${dto.email}`);
      
      const result = await this.authService.sendOtp(dto.email);
      this.logger.log(`📧 OTP send result for ${dto.email}:`, result);
      
      return result;
    } catch (error) {
      this.logger.error(`💥 Send OTP error for ${dto.email}:`, error.message);
      throw error;
    }
  }

  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and login' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    try {
      this.logger.log(`🔐 OTP verification for email: ${dto.email}`);
      
      // Validate OTP
      const user = await this.authService.validateOtp(dto.email, dto.otpCode);
      this.logger.log(`✅ OTP validated successfully for: ${dto.email}`);
      
      // Issue token
      const result = await this.authService.issueToken(user);
      this.logger.log(`🎫 Token issued via OTP for user: ${dto.email}`);
      
      return result;
    } catch (error) {
      this.logger.error(`💥 OTP verification error for ${dto.email}:`, error.message);
      throw error;
    }
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using OTP' })
  async resetPassword(@Body() dto: { email: string; otpCode: string; newPassword: string }) {
    try {
      this.logger.log(`🔐 Password reset request for email: ${dto.email}`);
      
      const result = await this.authService.resetPassword(dto.email, dto.otpCode, dto.newPassword);
      this.logger.log(`✅ Password reset successfully for: ${dto.email}`);
      
      return result;
    } catch (error) {
      this.logger.error(`💥 Password reset error for ${dto.email}:`, error.message);
      throw error;
    }
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: AuthUser }) {
    return req.user;
  }
}
