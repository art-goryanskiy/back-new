import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  AdminNotification,
  AdminNotificationSchema,
} from './admin-notification.schema';
import { AdminNotificationService } from './admin-notification.service';
import { AdminNotificationResolver } from './admin-notification.resolver';
import { AdminGuard } from '../common/guards/admin.guard';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    forwardRef(() => ChatModule),
    MongooseModule.forFeature([
      { name: AdminNotification.name, schema: AdminNotificationSchema },
    ]),
  ],
  providers: [AdminNotificationService, AdminNotificationResolver, AdminGuard],
  exports: [AdminNotificationService],
})
export class AdminNotificationModule {}
