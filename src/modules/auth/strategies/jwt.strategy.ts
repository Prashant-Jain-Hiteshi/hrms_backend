import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../../common/enums/role.enum';

type JwtPayload = {
  sub: string;
  email: string;
  role: Role | 'admin' | 'hr' | 'employee' | 'finance';
  employeeId?: string;
  tenantId?: string;
  companyCode?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') || 'dev_secret',
    });
  }

  validate(payload: JwtPayload) {
    // payload: { sub, email, role, employeeId?, tenantId?, companyCode? }
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      employeeId: payload.employeeId,
      tenantId: payload.tenantId,
      companyCode: payload.companyCode,
    };
  }
}
