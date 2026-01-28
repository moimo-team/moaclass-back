// auth/jwt-auth.guard.ts
import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();

    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      console.log('🔍 JwtAuthGuard.handleRequest user:', user);
      console.log('❌ JwtAuthGuard.handleRequest error:', err);
      console.log('ℹ️ JwtAuthGuard.handleRequest info:', info);
      throw err || new UnauthorizedException();
    }
    return user;
  }
}
