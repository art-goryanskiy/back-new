import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UserRole } from 'src/user/user.schema'; // ИСПРАВЛЕНО: абсолютный импорт
import { UserService } from 'src/user/user.service'; // ИСПРАВЛЕНО: абсолютный импорт

type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  type?: 'access' | 'refresh';
  iat?: number;
  exp?: number;
};

type GqlCtx = {
  req: Request & { user?: { id: string; email: string; role: UserRole } };
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);

    const request = ctx.getContext<GqlCtx>().req;

    const token = (request.cookies as { token?: string })?.token;

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (payload.role !== UserRole.ADMIN && payload.role !== UserRole.USER) {
        throw new UnauthorizedException('Invalid role');
      }

      if (payload.type && payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      // NEW: проверка блокировки из БД (моментально)
      const dbUser = await this.userService.findById(payload.sub);
      if (dbUser.isBlocked) {
        throw new ForbiddenException('User is blocked');
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      return true;
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new UnauthorizedException('Invalid token');
    }
  }
}
