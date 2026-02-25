export enum AdminNotificationType {
  USER_REGISTERED = 'USER_REGISTERED',
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_PAID = 'ORDER_PAID',
  CHAT_CREATED = 'CHAT_CREATED',
  CHAT_MESSAGE = 'CHAT_MESSAGE',
}

export enum AdminNotificationEntityType {
  USER = 'user',
  ORDER = 'order',
  CHAT = 'chat',
  MESSAGE = 'message',
}
