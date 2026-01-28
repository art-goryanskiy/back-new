import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';

type GqlCtx = { req?: Request };

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    let method = 'UNKNOWN';
    let url = 'UNKNOWN';

    try {
      const gqlContext = GqlExecutionContext.create(context);
      const ctx = gqlContext.getContext<GqlCtx>(); // <-- больше не any
      const request = ctx.req;

      const info = gqlContext.getInfo<{ fieldName?: string }>();

      if (request) {
        method = request.method || 'GRAPHQL';
        url = request.url || info.fieldName || 'GRAPHQL';
      }
    } catch {
      const request = context.switchToHttp().getRequest<Request>(); // <-- больше не any
      method = request.method;
      url = request.url;
    }

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - now;
          this.logger.log(`${method} ${url} - ${responseTime}ms`);
        },
        error: (error: unknown) => {
          const responseTime = Date.now() - now;
          const message =
            error instanceof Error ? error.message : String(error);

          this.logger.error(
            `${method} ${url} - ${responseTime}ms - Error: ${message}`,
          );
        },
      }),
    );
  }
}
