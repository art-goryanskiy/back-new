import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { MongooseModule } from '@nestjs/mongoose';
import type { Request, Response } from 'express';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GraphqlOptionsFactory } from './graphql/graphql-options.factory';
import { CategoryModule } from './category/category.module';
import { CacheModule } from './cache/cache.module';
import { ProgramsModule } from './programs/programs.module';
import { UploadModule } from './upload/upload.module';
import { UserModule } from './user/user.module';
import { OrganizationModule } from './organization/organization.module';
import { EducationDocumentModule } from './education-document/education-document.module';
import { CartModule } from './cart/cart.module';
import { OrderModule } from './order/order.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env: Record<string, unknown>) => {
        const requireString = (key: string) => {
          const value = env[key];
          if (typeof value !== 'string' || !value.trim()) {
            throw new Error(`Environment variable ${key} must be a string`);
          }
          return value.trim();
        };
        requireString('JWT_SECRET');
        requireString('MONGODB_URI');
        return env;
      },
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useClass: GraphqlOptionsFactory,
      imports: [UserModule, OrderModule],
    }),
    CategoryModule,
    CacheModule,
    ProgramsModule,
    UserModule,
    OrganizationModule,
    EducationDocumentModule,
    UploadModule,
    CartModule,
    OrderModule,
  ],
  controllers: [AppController],
  providers: [AppService, GraphqlOptionsFactory],
})
export class AppModule {}
