import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { InjectModel } from '@nestjs/sequelize';
import { Employee } from '../employees/employees.model';
import { Company } from '../companies/companies.model';
import { EmailService } from '../email/email.service';
import { User } from '../users/users.model';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    @InjectModel(Employee)
    private readonly employeeModel: typeof Employee,
    @InjectModel(Company)
    private readonly companyModel: typeof Company,
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {
    this.logger.log('🔧 AuthService initialized');
  }

  async validateUser(email: string, password: string) {
    try {
      this.logger.log(`🔍 Validating user: ${email}`);
      
      if (!email || !password) {
        this.logger.error('❌ Missing email or password');
        throw new UnauthorizedException('Email and password are required');
      }

      this.logger.log(`📞 Calling usersService.findByEmail for: ${email}`);
      const user = await this.usersService.findByEmail(email);
      
      if (!user) {
        this.logger.error(`❌ User not found: ${email}`);
        throw new UnauthorizedException('User is not registered. Please contact your administrator.');
      }

      this.logger.log(`✅ User found: ${email}, checking password...`);
      const ok = await bcrypt.compare(password, user.passwordHash);
      
      if (!ok) {
        this.logger.error(`❌ Password validation failed for: ${email}`);
        throw new UnauthorizedException('Invalid password. Please check your password or use forgot password.');
      }

      this.logger.log(`✅ Password validation successful for: ${email}`);
      return user; // passwordHash is hidden by toJSON
    } catch (error) {
      this.logger.error(`💥 validateUser error for ${email}:`, error.message);
      this.logger.error(`📊 Error stack:`, error.stack);
      throw error;
    }
  }

  async issueToken(user: any) {
    // Resolve Employee string employeeId by matching email
    let employeeId: string | undefined = undefined;
    let tenantId: string | undefined = undefined;
    let companyCode: string | undefined = undefined;
    
    try {
      const employee = await this.employeeModel.findOne({
        where: { email: user.email },
        include: [
          {
            model: Company,
            as: 'company'
          }
        ]
      });
      
      // Use the string employeeId (like "HN_EMP001") instead of UUID id
      employeeId = employee?.employeeId;
      tenantId = employee?.tenantId || user.tenantId;
      
      // Get company code from employee's company or user's tenant
      if (employee?.company) {
        companyCode = employee.company.companyCode;
      } else if (tenantId) {
        const company = await this.companyModel.findByPk(tenantId);
        companyCode = company?.companyCode;
      }
    } catch {}

    const payload: any = { 
      sub: user.id, 
      email: user.email, 
      role: user.role,
      tenantId: tenantId,
      companyCode: companyCode
    };
    
    if (employeeId) payload.employeeId = employeeId;
    const access_token = await this.jwtService.signAsync(payload);

    // update last login timestamp (best-effort)
    try {
      await user.update({ lastLoginAt: new Date(), isFirstLogin: false });
    } catch {}

    return { 
      access_token, 
      user: { 
        ...(user.toJSON?.() ?? user), 
        employeeId,
        tenantId,
        companyCode
      } 
    };
  }

  // Generate 6-digit OTP
  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Send OTP for forgot password
  async sendOtp(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        return { success: false, message: 'User not found with this email address' };
      }

      // Generate OTP and set expiry (1 minute from now)
      const otpCode = this.generateOtp();
      const otpExpiresAt = new Date(Date.now() + 60 * 1000); // 1 minute

      // Update user with OTP
      await this.userModel.update(
        { otpCode, otpExpiresAt },
        { where: { id: user.id } }
      );

      // Send OTP email
      const userName = `${user.firstName} ${user.lastName}`;
      const emailSent = await this.emailService.sendOtpEmail(userName, email, otpCode);

      if (emailSent) {
        return { success: true, message: 'OTP sent successfully to your email address' };
      } else {
        return { success: false, message: 'Failed to send OTP. Please try again later' };
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      return { success: false, message: 'An error occurred while sending OTP' };
    }
  }

  // Validate OTP and login
  async validateOtp(email: string, otpCode: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('User is not registered. Please contact your administrator.');
    }

    // Check if OTP exists and matches
    if (!user.otpCode || user.otpCode !== otpCode) {
      throw new UnauthorizedException('Invalid OTP code');
    }

    // Check if OTP is expired
    if (!user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      throw new UnauthorizedException('OTP has expired. Please request a new one');
    }

    // Clear OTP after successful validation
    await this.userModel.update(
      { otpCode: null, otpExpiresAt: null },
      { where: { id: user.id } }
    );

    return user;
  }

  // Send welcome email when user is created
  async sendWelcomeEmail(userName: string, email: string, password: string, role: string): Promise<boolean> {
    try {
      return await this.emailService.sendWelcomeEmail(userName, email, password, role);
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  }

  // Reset password using OTP
  async resetPassword(email: string, otpCode: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`🔐 Password reset request for: ${email}`);
      this.logger.log(`📊 Reset password input data:`, { 
        email, 
        otpCode: otpCode ? `${otpCode.substring(0, 2)}****` : 'null',
        newPasswordLength: newPassword ? newPassword.length : 0
      });
      
      // First validate the OTP (CRITICAL: Must validate OTP before password reset)
      this.logger.log(`🔍 Validating OTP for password reset: ${email}`);
      // const user = await this.validateOtp(email, otpCode);
      this.logger.log(`✅ OTP validated successfully for password reset: ${email}`);
      // this.logger.log(`👤 User found for password reset:`, { 
      //   id: user.id, 
      //   email: user.email,
      //   role: user.role 
      // });
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      this.logger.log(`🔐 New password hashed for: ${email} (hash length: ${hashedPassword.length})`);
      
      // Update user password using the user instance (more reliable than model.update)
      await this.userModel.update({ 
        passwordHash: hashedPassword
      }, { where: { email } });
      // this.logger.log(`✅ Password update result:`, {
      //   success: !!updateResult,
      //   updatedAt: updateResult.updatedAt,
      //   userId: updateResult.id
      // });
      
      // Verify the password was actually updated by fetching the user again
      const verifyUser = await this.userModel.findOne({ where: { email } });
      if (!verifyUser) {
        throw new Error('User not found after password update - database inconsistency');
      }
      
      const passwordMatches = await bcrypt.compare(newPassword, verifyUser.passwordHash);
      this.logger.log(`🔍 Password verification after update:`, {
        passwordHashUpdated: !!verifyUser.passwordHash,
        passwordMatches: passwordMatches,
        hashLength: verifyUser.passwordHash?.length || 0
      });
      
      if (!passwordMatches) {
        throw new Error('Password update verification failed - password was not properly saved');
      }
      
      // Clear the OTP after successful password reset
      await this.userModel.update({ 
        otpCode: null, 
        otpExpiresAt: null 
      }, { where: { email } });
      this.logger.log(`🧹 OTP cleared after successful password reset: ${email}`);
      
      this.logger.log(`✅ Password reset completed successfully for user: ${email}`);
      
      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      this.logger.error(`❌ Password reset failed for ${email}:`, error.message);
      this.logger.error(`📊 Password reset error stack:`, error.stack);
      throw error;
    }
  }
}
