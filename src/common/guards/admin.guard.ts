import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from 'src/user/schemas/user.schema';

type GqlCtx = { req: { user?: { role: UserRole } } };

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context).getContext<GqlCtx>();
    const user = ctx.req?.user;
    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }
    return true;
  }
}
