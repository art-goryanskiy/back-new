import { registerEnumType } from '@nestjs/graphql';
import { UserRole } from '../../schemas/user.schema';

registerEnumType(UserRole, { name: 'UserRole' });

export { UserRole };
