import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { LoginDto } from './dto/login.dto';
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
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @UseGuards(LocalAuthGuard)
  async login(@Body() _dto: LoginDto, @Req() req: { user: AuthUser }) {
    // LocalAuthGuard puts user on req.user
    return this.authService.issueToken(req.user);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  me(@Req() req: { user: AuthUser }) {
    return req.user;
  }
}
