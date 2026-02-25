import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AdminNotification,
  AdminNotificationSchema,
} from './admin-notification.schema';
import { AdminNotificationService } from './admin-notification.service';
import { AdminNotificationResolver } from './admin-notification.resolver';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminNotification.name, schema: AdminNotificationSchema },
    ]),
  ],
  providers: [AdminNotificationService, AdminNotificationResolver, AdminGuard],
  exports: [AdminNotificationService],
})
export class AdminNotificationModule {}
