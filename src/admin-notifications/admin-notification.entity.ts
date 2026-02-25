import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import {
  AdminNotificationEntityType,
  AdminNotificationType,
} from './admin-notification.enums';

registerEnumType(AdminNotificationType, { name: 'AdminNotificationType' });
registerEnumType(AdminNotificationEntityType, {
  name: 'AdminNotificationEntityType',
});

@ObjectType('AdminNotification')
export class AdminNotificationEntity {
  @Field(() => ID)
  id: string;

  @Field(() => AdminNotificationType)
  type: AdminNotificationType;

  @Field(() => AdminNotificationEntityType)
  entityType: AdminNotificationEntityType;

  @Field(() => ID)
  entityId: string;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field(() => Boolean)
  isRead: boolean;

  @Field(() => GraphQLISODateTime)
  createdAt: Date;
}

@ObjectType('AdminNotificationsUnreadCount')
export class AdminNotificationsUnreadCountEntity {
  @Field(() => Int)
  count: number;
}
