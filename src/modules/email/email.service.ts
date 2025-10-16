import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailHost = this.configService.get<string>('EMAIL_HOST', 'smtp.gmail.com');
    const emailPort = this.configService.get<number>('EMAIL_PORT', 587);
    const emailUser = this.configService.get<string>('EMAIL_USER');
    const emailPass = this.configService.get<string>('EMAIL_PASS');

    if (!emailUser || !emailPass) {
      this.logger.warn('Email credentials not configured. Email functionality will be disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPass, // App password for Gmail
      },
    });

    this.logger.log(`Email service initialized with host: ${emailHost}:${emailPort}`);
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.error('Email transporter not initialized. Cannot send email.');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.configService.get<string>('EMAIL_FROM') || this.configService.get<string>('EMAIL_USER'),
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(`Email sent successfully to ${options.to}. Message ID: ${info.messageId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  // Generate welcome email template
  generateWelcomeEmail(userName: string, email: string, password: string, role: string): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to StaffLoom HRMS</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #334155;
                background-color: #f8fafc;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                color: white;
                padding: 40px 30px;
                text-align: center;
            }
            .logo {
                font-size: 28px;
                font-weight: bold;
                margin-bottom: 10px;
            }
            .content {
                padding: 40px 30px;
            }
            .welcome-title {
                font-size: 24px;
                font-weight: bold;
                color: #1e293b;
                margin-bottom: 20px;
                text-align: center;
            }
            .credentials-box {
                background-color: #f1f5f9;
                border: 2px solid #e2e8f0;
                border-radius: 8px;
                padding: 25px;
                margin: 25px 0;
            }
            .credential-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 15px;
                border-bottom: 1px solid #e2e8f0;
            }
            .credential-item:last-child {
                margin-bottom: 0;
                padding-bottom: 0;
                border-bottom: none;
            }
            .credential-label {
                font-weight: 600;
                color: #475569;
            }
            .credential-value {
                font-family: 'Courier New', monospace;
                background-color: #ffffff;
                padding: 8px 12px;
                border-radius: 4px;
                border: 1px solid #d1d5db;
                font-size: 14px;
            }
            .login-button {
                display: inline-block;
                background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                color: white;
                text-decoration: none;
                padding: 15px 30px;
                border-radius: 8px;
                font-weight: 600;
                text-align: center;
                margin: 25px 0;
                transition: transform 0.2s;
            }
            .login-button:hover {
                transform: translateY(-2px);
            }
            .features {
                margin: 30px 0;
            }
            .feature-item {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
            }
            .feature-icon {
                width: 20px;
                height: 20px;
                background-color: #10b981;
                border-radius: 50%;
                margin-right: 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 12px;
            }
            .footer {
                background-color: #f8fafc;
                padding: 30px;
                text-align: center;
                color: #64748b;
                font-size: 14px;
            }
            .security-note {
                background-color: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 6px;
                padding: 15px;
                margin: 20px 0;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">🏢 StaffLoom HRMS</div>
                <p>Human Resource Management System</p>
            </div>
            
            <div class="content">
                <h1 class="welcome-title">Welcome to StaffLoom, ${userName}!</h1>
                
                <p>Congratulations! Your ${role} account has been successfully created in our HRMS system. You now have access to a comprehensive platform designed to streamline HR operations and enhance productivity.</p>
                
                <div class="credentials-box">
                    <h3 style="margin-top: 0; color: #1e293b;">Your Login Credentials</h3>
                    <div class="credential-item">
                        <span class="credential-label">Email:</span>
                        <span class="credential-value">${email}</span>
                    </div>
                    <div class="credential-item">
                        <span class="credential-label">Password:</span>
                        <span class="credential-value">${password}</span>
                    </div>
                    <div class="credential-item">
                        <span class="credential-label">Role:</span>
                        <span class="credential-value">${role}</span>
                    </div>
                </div>
                
                <div class="security-note">
                    <strong>🔒 Security Note:</strong> For your security, please change your password after your first login. Keep your credentials confidential and never share them with others.
                </div>
                
                <div style="text-align: center;">
                    <a href="${this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173')}/login" class="login-button">
                        Login to StaffLoom
                    </a>
                </div>
                
                <div class="features">
                    <h3 style="color: #1e293b;">What you can do with StaffLoom:</h3>
                    <div class="feature-item">
                        <div class="feature-icon">✓</div>
                        <span>Manage employee information and profiles</span>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">✓</div>
                        <span>Track attendance and working hours</span>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">✓</div>
                        <span>Process leave requests and approvals</span>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">✓</div>
                        <span>Handle payroll and salary management</span>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">✓</div>
                        <span>Generate comprehensive reports</span>
                    </div>
                </div>
                
                <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
            </div>
            
            <div class="footer">
                <p><strong>StaffLoom HRMS</strong></p>
                <p>Streamlining HR Operations • Enhancing Productivity</p>
                <p style="margin-top: 15px; font-size: 12px;">
                    This is an automated message. Please do not reply to this email.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // Send welcome email to new user
  async sendWelcomeEmail(userName: string, email: string, password: string, role: string): Promise<boolean> {
    const subject = `Welcome to StaffLoom HRMS - Your ${role} Account is Ready!`;
    const html = this.generateWelcomeEmail(userName, email, password, role);
    
    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Welcome to StaffLoom HRMS! Your login credentials - Email: ${email}, Password: ${password}, Role: ${role}. Please login and change your password for security.`
    });
  }

  // Generate OTP email template
  generateOtpEmail(userName: string, otpCode: string): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Login OTP - StaffLoom HRMS</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #334155;
                background-color: #f8fafc;
                margin: 0;
                padding: 0;
            }
            .container {
                max-width: 500px;
                margin: 0 auto;
                background-color: #ffffff;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            .header {
                background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                color: white;
                padding: 30px;
                text-align: center;
            }
            .content {
                padding: 40px 30px;
                text-align: center;
            }
            .otp-box {
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white;
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                padding: 25px;
                border-radius: 12px;
                margin: 25px 0;
                font-family: 'Courier New', monospace;
            }
            .timer-note {
                background-color: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 6px;
                padding: 15px;
                margin: 20px 0;
                font-size: 14px;
            }
            .footer {
                background-color: #f8fafc;
                padding: 20px;
                text-align: center;
                color: #64748b;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>🔐 Login Verification</h2>
                <p>StaffLoom HRMS</p>
            </div>
            
            <div class="content">
                <h2 style="color: #1e293b; margin-bottom: 20px;">Hello ${userName}!</h2>
                <p>You requested to login using OTP. Here's your verification code:</p>
                
                <div class="otp-box">
                    ${otpCode}
                </div>
                
                <div class="timer-note">
                    <strong>⏰ Important:</strong> This OTP will expire in <strong>1 minute</strong>. Please use it immediately to complete your login.
                </div>
                
                <p>If you didn't request this OTP, please ignore this email or contact support if you have concerns.</p>
            </div>
            
            <div class="footer">
                <p><strong>StaffLoom HRMS</strong></p>
                <p style="margin-top: 10px; font-size: 12px;">
                    This is an automated message. Please do not reply to this email.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  // Send OTP email
  async sendOtpEmail(userName: string, email: string, otpCode: string): Promise<boolean> {
    const subject = `Your StaffLoom Login OTP: ${otpCode}`;
    const html = this.generateOtpEmail(userName, otpCode);
    
    return this.sendEmail({
      to: email,
      subject,
      html,
      text: `Your StaffLoom HRMS login OTP is: ${otpCode}. This code will expire in 1 minute.`
    });
  }
}
