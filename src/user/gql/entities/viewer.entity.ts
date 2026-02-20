import { Field, ID, ObjectType } from '@nestjs/graphql';
import { UserRole } from './user-role.gql';

/**
 * Минимальный профиль текущей сессии из контекста (cookie).
 * Для стабильного первого экрана: layout может запросить viewer и передать в клиент
 * без ожидания полного me (без доп. запросов в БД в резолвере).
 */
@ObjectType()
export class ViewerEntity {
  @Field(() => ID)
  id: string;

  @Field(() => String)
  email: string;

  @Field(() => UserRole)
  role: UserRole;
}
