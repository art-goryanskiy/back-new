import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('AdminOrderCounts')
export class AdminOrderCountsEntity {
  @Field(() => Int, { description: 'Ожидают оплаты' })
  awaitingPayment: number;

  @Field(() => Int, { description: 'Оплачены' })
  paid: number;

  @Field(() => Int, { description: 'В работе' })
  inProgress: number;

  @Field(() => Int, { description: 'Выполнены' })
  completed: number;

  @Field(() => Int, { description: 'Отменены' })
  cancelled: number;
}

@ObjectType('AdminChatCounts')
export class AdminChatCountsEntity {
  @Field(() => Int, { description: 'Открытые чаты' })
  open: number;

  @Field(() => Int, { description: 'Закрытые чаты' })
  closed: number;

  @Field(() => Int, { description: 'Открытые без назначенного админа' })
  openUnassigned: number;
}

@ObjectType('AdminMetrics')
export class AdminMetricsEntity {
  @Field(() => AdminOrderCountsEntity, {
    description: 'Количество заказов по статусам',
  })
  orderCounts: AdminOrderCountsEntity;

  @Field(() => Int, { description: 'Всего заказов' })
  ordersTotal: number;

  @Field(() => Int, {
    description: 'Сумма оплаченных заказов (выручка), руб.',
  })
  revenuePaid: number;

  @Field(() => Int, { description: 'Всего пользователей (роль user)' })
  usersTotal: number;

  @Field(() => Int, { description: 'Новые пользователи за последние 30 дней' })
  usersNewLast30Days: number;

  @Field(() => AdminChatCountsEntity, {
    description: 'Количество чатов по статусам',
  })
  chatCounts: AdminChatCountsEntity;

  @Field(() => Int, { description: 'Корзин с товарами (непустых)' })
  cartsWithItems: number;
}
