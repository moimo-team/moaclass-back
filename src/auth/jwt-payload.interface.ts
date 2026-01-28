// auth/jwt-payload.interface.ts
export interface JwtPayload {
  id: number; // 토큰 발급 시 user.id를 sub에 넣음
  email: string; // 토큰 발급 시 user.email을 넣음
  iat?: number;
  exp?: number;
}
