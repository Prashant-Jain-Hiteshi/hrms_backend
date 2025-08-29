import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { InjectModel } from '@nestjs/sequelize';
import { Employee } from '../employees/employees.model';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectModel(Employee)
    private readonly employeeModel: typeof Employee,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return user; // passwordHash is hidden by toJSON
  }

  async issueToken(user: any) {
    // Resolve Employee UUID by matching email
    let employeeId: string | undefined = undefined;
    try {
      const employee = await this.employeeModel.findOne({ where: { email: user.email } });
      employeeId = employee?.id;
    } catch {}

    const payload: any = { sub: user.id, email: user.email, role: user.role };
    if (employeeId) payload.employeeId = employeeId;
    const access_token = await this.jwtService.signAsync(payload);

    // update last login timestamp (best-effort)
    try {
      await user.update({ lastLoginAt: new Date(), isFirstLogin: false });
    } catch {}

    return { access_token, user: { ...user.toJSON?.() ?? user, employeeId } };
  }
}
