import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(LocalStrategy.name);

  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email', passwordField: 'password' });
    this.logger.log('🔧 LocalStrategy initialized');
  }

  async validate(email: string, password: string) {
    try {
      this.logger.log(`🔍 LocalStrategy validating user: ${email}`);
      
      if (!email || !password) {
        this.logger.error('❌ Missing email or password in validation');
        throw new Error('Email and password are required');
      }
      
      const user = await this.authService.validateUser(email, password);
      
      if (!user) {
        this.logger.error(`❌ User validation failed for: ${email}`);
        throw new Error('Invalid credentials');
      }
      
      this.logger.log(`✅ User validation successful for: ${email}`);
      return user;
    } catch (error) {
      this.logger.error(`💥 LocalStrategy validation error for ${email}:`, error.message);
      throw error;
    }
  }
}
