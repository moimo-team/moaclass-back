import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const Cookies = createParamDecorator(
  (key: string, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const value = request.cookies?.[key];
    return typeof value === 'string' ? value : undefined; // ✅ 안전하게 반환
  },
);
