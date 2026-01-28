import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { JwtPayload } from './jwt-payload.interface';
import { AuthenticatedSocket } from 'src/types/AuthenticatedSocket';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();

    // 토큰 가져오기 (auth.token 또는 Authorization 헤더)
    const authHeader = client.handshake.headers?.authorization;
    const token =
      (client.handshake.auth as { token?: string })?.token ||
      (authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : undefined);

    if (!token) {
      return false;
    }

    try {
      // 토큰 검증
      const payload = this.jwtService.verify<JwtPayload>(token);
      console.log('Decoded payload:', payload);
      // 타입 안전하게 user 저장
      (client as AuthenticatedSocket).data.user = payload;

      return true;
    } catch (err) {
      console.error('WebSocket JWT 검증 실패:', err);
      return false;
    }
  }
}
