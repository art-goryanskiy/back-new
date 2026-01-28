import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import { UserRole } from 'src/user/schemas/user.schema';

export interface CurrentUserPayload {
  id: string;
  email: string;
  role: UserRole;
}

type GqlCtxWithUser = { req: { user: CurrentUserPayload } };
type GqlCtxOptionalUser = { req: Request & { user?: CurrentUserPayload } };

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const { req } =
      GqlExecutionContext.create(ctx).getContext<GqlCtxWithUser>();
    return req.user;
  },
);

export const OptionalUser = createParamDecorator(
  (
    data: { role?: UserRole },
    ctx: ExecutionContext,
  ): CurrentUserPayload | null => {
    const { req } =
      GqlExecutionContext.create(ctx).getContext<GqlCtxOptionalUser>();

    if (!req.user) return null;

    const requiredRole = data?.role;
    if (requiredRole && req.user.role !== requiredRole) return null;

    return req.user;
  },
);
