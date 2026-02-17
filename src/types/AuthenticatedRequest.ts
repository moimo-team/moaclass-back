import { Request } from 'express';
import { JwtPayload } from '../auth/jwt-payload.interface';

export interface AuthenticatedRequest extends Request {
    user: JwtPayload;
}
