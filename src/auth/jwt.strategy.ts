import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, JwtFromRequestFunction } from 'passport-jwt';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const jwtFromRequest: JwtFromRequestFunction =
      ExtractJwt.fromAuthHeaderAsBearerToken();
    super({
      jwtFromRequest, // Authorization 헤더에서 토큰 추출
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'SECRET_KEY', // 환경변수로 관리 권장
    });
  }

  validate(payload: JwtPayload) {
    console.log('✅ JwtStrategy payload:', payload);
    return { id: payload.id, email: payload.email };
  }
}
