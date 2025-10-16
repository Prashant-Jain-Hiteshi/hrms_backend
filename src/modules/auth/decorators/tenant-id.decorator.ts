import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    
    // Extract tenantId from the authenticated user
    // This assumes your JWT payload includes tenantId or you can derive it from user
    return user?.tenantId || user?.id; // Adjust based on your JWT structure
  },
);
