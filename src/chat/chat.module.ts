import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Chat, ChatSchema } from './chat.schema';
import { Message, MessageSchema } from './chat.schema';
import { ChatService } from './chat.service';
import { ChatResolver } from './chat.resolver';
import { ChatAdminResolver } from './chat-admin.resolver';
import { ChatGateway } from './chat.gateway';
import { UserModule } from '../user/user.module';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    forwardRef(() => UserModule),
  ],
  providers: [
    ChatService,
    ChatResolver,
    ChatAdminResolver,
    ChatGateway,
    AdminGuard,
  ],
  exports: [ChatService],
})
export class ChatModule {}
