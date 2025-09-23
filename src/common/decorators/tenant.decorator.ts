import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    
    console.log('🔑 TENANT DECORATOR - Full user object:', JSON.stringify(user, null, 2));
    console.log('🔑 TENANT DECORATOR - tenantId extracted:', user?.tenantId);
    
    // Extract tenantId from JWT payload
    return user?.tenantId || null;
  },
);

export const CompanyCode = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    
    // Extract companyCode from JWT payload
    return user?.companyCode || null;
  },
);
