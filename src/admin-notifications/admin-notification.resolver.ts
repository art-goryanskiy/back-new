import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { AdminGuard } from 'src/common/guards/admin.guard';
import {
  CurrentUser,
  type CurrentUserPayload,
} from 'src/common/decorators/current-user.decorator';
import {
  AdminNotificationEntity,
  AdminNotificationsUnreadCountEntity,
} from './admin-notification.entity';
import { AdminNotificationService } from './admin-notification.service';
import { AdminNotificationsFilterInput } from './admin-notification.input';

function toEntity(
  doc: {
    _id: unknown;
    type: AdminNotificationEntity['type'];
    entityType: AdminNotificationEntity['entityType'];
    entityId: string;
    title: string;
    message: string;
    readBy?: Array<{ toString: () => string } | string>;
    createdAt?: Date;
  },
  adminId: string,
): AdminNotificationEntity {
  const readBy = (doc.readBy ?? []).map((id) =>
    typeof id === 'string' ? id : id.toString(),
  );
  return {
    id: (doc._id as { toString: () => string }).toString(),
    type: doc.type,
    entityType: doc.entityType,
    entityId: doc.entityId,
    title: doc.title,
    message: doc.message,
    isRead: readBy.includes(adminId),
    createdAt: doc.createdAt ?? new Date(),
  };
}

@Resolver(() => AdminNotificationEntity)
export class AdminNotificationResolver {
  constructor(
    private readonly adminNotificationService: AdminNotificationService,
  ) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Query(() => [AdminNotificationEntity], {
    name: 'adminNotifications',
    description: 'Уведомления для админа (общая лента для всех админов).',
  })
  async adminNotifications(
    @Args('filter', {
      nullable: true,
      type: () => AdminNotificationsFilterInput,
    })
    filter: AdminNotificationsFilterInput | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AdminNotificationEntity[]> {
    const docs = await this.adminNotificationService.findManyForAdmin(user.id, {
      limit: filter?.limit,
      offset: filter?.offset,
      unreadOnly: filter?.unreadOnly,
    });
    return docs.map((doc) =>
      toEntity(doc as unknown as Parameters<typeof toEntity>[0], user.id),
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Query(() => AdminNotificationsUnreadCountEntity, {
    name: 'adminNotificationsUnreadCount',
    description:
      'Количество непрочитанных уведомлений для текущего админа (число на колокольчике).',
  })
  async adminNotificationsUnreadCount(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<AdminNotificationsUnreadCountEntity> {
    const count = await this.adminNotificationService.getUnreadCountForAdmin(
      user.id,
    );
    return { count };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Mutation(() => Boolean, {
    name: 'adminMarkNotificationRead',
    description: 'Пометить уведомление как прочитанное текущим админом.',
  })
  async adminMarkNotificationRead(
    @Args('notificationId', { type: () => ID }) notificationId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<boolean> {
    return this.adminNotificationService.markReadForAdmin(
      notificationId,
      user.id,
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Mutation(() => Boolean, {
    name: 'adminMarkAllNotificationsRead',
    description: 'Пометить все уведомления как прочитанные текущим админом.',
  })
  async adminMarkAllNotificationsRead(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<boolean> {
    await this.adminNotificationService.markAllReadForAdmin(user.id);
    return true;
  }
}
