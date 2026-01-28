import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    cookies: {
      [key: string]: string | undefined;
      refreshToken?: string;
      accessToken?: string;
    };
  }
}
