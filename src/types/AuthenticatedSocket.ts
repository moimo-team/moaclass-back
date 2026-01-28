import { Socket } from 'socket.io';
import { JwtPayload } from 'src/auth/jwt-payload.interface';

export interface AuthenticatedSocket extends Socket {
  handshake: Socket['handshake'] & {
    auth: {
      token?: string;
    };
  };
  data: {
    user: JwtPayload;
  };
}
