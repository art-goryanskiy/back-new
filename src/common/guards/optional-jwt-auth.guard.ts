import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { UserRole } from 'src/user/schemas/user.schema';

type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  type?: 'access' | 'refresh';
};

type GqlCtx = {
  req: Request & { user?: { id: string; email: string; role: UserRole } };
};

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);

    const request = ctx.getContext<GqlCtx>().req;

    const token = (request.cookies as { token?: string } | undefined)?.token;
    if (!token) return true;

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      if (payload.role !== UserRole.ADMIN && payload.role !== UserRole.USER)
        return true;
      if (payload.type && payload.type !== 'access') return true;

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      // ignore
    }

    return true;
  }
}
