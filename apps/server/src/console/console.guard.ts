import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConsoleAuthService } from './console-auth.service.js';

/** The token from `Authorization: Bearer …`, or ''. */
export const bearer = (header: unknown) =>
  typeof header === 'string' ? header.replace(/^Bearer /, '') : '';

/** Lets a console request through only with a token from `POST /api/console/login`. */
@Injectable()
export class ConsoleGuard implements CanActivate {
  constructor(private readonly auth: ConsoleAuthService) {}

  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
    if (!this.auth.check(bearer(req.headers.authorization))) {
      throw new UnauthorizedException('Cần trả lời câu hỏi trước');
    }
    return true;
  }
}
