import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../../../common/enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const role = req.user?.role;
    if (!role) return false;
    // If role is e.g., 'admin' (string), compare equality; if it is an array, check membership
    if (Array.isArray(role)) {
      return requiredRoles.some((r) => (role as string[]).includes(r));
    }
    return requiredRoles.some((r) => role === r);
  }
}
