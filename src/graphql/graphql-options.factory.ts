import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { UserRole } from '../user/schemas/user.schema';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault,
} from '@apollo/server/plugin/landingPage/default';
import { ApolloDriverConfig } from '@nestjs/apollo';
import { GqlOptionsFactory } from '@nestjs/graphql';
import { CategoryModule } from '../category/category.module';
import { ProgramsModule } from '../programs/programs.module';
import { UserModule } from '../user/user.module';
import { OrganizationModule } from '../organization/organization.module';
import { EducationDocumentModule } from '../education-document/education-document.module';
import { CartModule } from '../cart/cart.module';
import { OrderModule } from '../order/order.module';
import { OrderDocumentModule } from '../order-document/order-document.module';
import { NewsModule } from '../news/news.module';
import { ChatModule } from '../chat/chat.module';

@Injectable()
export class GraphqlOptionsFactory implements GqlOptionsFactory<ApolloDriverConfig> {
  private readonly logger = new Logger(GraphqlOptionsFactory.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  createGqlOptions(): ApolloDriverConfig | Promise<ApolloDriverConfig> {
    const { jwtService, userService } = this;

    return {
      autoSchemaFile: true,
      transformAutoSchemaFile: true,
      sortSchema: true,
      playground: false,
      introspection: true,
      plugins: [
        process.env.NODE_ENV === 'production'
          ? ApolloServerPluginLandingPageProductionDefault({ footer: false })
          : ApolloServerPluginLandingPageLocalDefault({ footer: false }),
      ],
      formatError: (formattedError) => {
        this.logger.warn(`GraphQL error: ${formattedError.message}`);
        return formattedError;
      },
      context: async (ctx: {
        req: {
          cookies?: { token?: string };
          user?: { id: string; email: string; role: UserRole };
        };
      }) => {
        const { req } = ctx;
        try {
          const token = req?.cookies?.token;
          if (token) {
            const payload = await jwtService.verifyAsync<{
              sub: string;
              email: string;
              role: UserRole;
              type?: string;
            }>(token);
            if (
              (payload.role === UserRole.ADMIN ||
                payload.role === UserRole.USER) &&
              (!payload.type || payload.type === 'access')
            ) {
              const dbUser = await userService.findById(payload.sub);
              if (!dbUser.isBlocked) {
                (
                  req as {
                    user?: { id: string; email: string; role: UserRole };
                  }
                ).user = {
                  id: payload.sub,
                  email: payload.email,
                  role: payload.role,
                };
              }
            }
          }
        } catch {
          // ignore JWT/DB errors — guarded resolvers will validate
        }
        return ctx;
      },
      include: [
        CategoryModule,
        ProgramsModule,
        UserModule,
        OrganizationModule,
        EducationDocumentModule,
        CartModule,
        OrderModule,
        OrderDocumentModule,
        NewsModule,
        ChatModule,
      ],
    };
  }
}
