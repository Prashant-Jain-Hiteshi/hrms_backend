import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { InjectModel } from '@nestjs/sequelize';
import { Employee } from '../employees/employees.model';
import { Company } from '../companies/companies.model';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectModel(Employee)
    private readonly employeeModel: typeof Employee,
    @InjectModel(Company)
    private readonly companyModel: typeof Company,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return user; // passwordHash is hidden by toJSON
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
}
