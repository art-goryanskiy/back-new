import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';

import { User, type UserDocument } from '../schemas/user.schema';
import { UserValidators } from 'src/common/validators/user.validators';

@Injectable()
export class UserCoreService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  assertNotBlocked(user: UserDocument): void {
    if (user.isBlocked) {
      throw new ForbiddenException('User is blocked');
    }
  }

  async findByEmail(email: string): Promise<UserDocument> {
    const normalized = UserValidators.normalizeEmail(email);
    const user = await this.userModel.findOne({ email: normalized });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async validatePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
