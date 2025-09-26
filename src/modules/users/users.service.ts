import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from './users.model';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User)
    private readonly userModel: typeof User,
  ) {
    this.logger.log('🔧 UsersService initialized');
  }

  async create(dto: CreateUserDto): Promise<User> {
    // Check for duplicate email
    const existing = await this.userModel.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }
    const hash = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.userModel.create({
        email: dto.email,
        passwordHash: hash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role,
        avatarUrl: dto.avatarUrl,
        tenantId: dto.tenantId, // Include tenant ID
      } as any);
      return user; // passwordHash is hidden by model toJSON
    } catch (e) {
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async findAll(
    limit = 25,
    offset = 0,
  ): Promise<{ rows: User[]; count: number }> {
    return this.userModel.findAndCountAll({
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.userModel.findByPk(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      this.logger.log(`🔍 Finding user by email: ${email}`);
      
      if (!email) {
        this.logger.error('❌ Email is null or undefined');
        return null;
      }

      const user = await this.userModel.findOne({ where: { email } });
      
      if (user) {
        this.logger.log(`✅ User found: ${email} (ID: ${user.id})`);
      } else {
        this.logger.log(`❌ User not found: ${email}`);
      }
      
      return user;
    } catch (error) {
      this.logger.error(`💥 Database error finding user ${email}:`, error.message);
      this.logger.error(`📊 Error stack:`, error.stack);
      throw error;
    }
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    // If email is being updated, ensure uniqueness
    if (dto.email && dto.email !== user.email) {
      const exists = await this.userModel.findOne({
        where: { email: dto.email },
      });
      if (exists) throw new ConflictException('Email already exists');
    }
    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
      delete (dto as any).password;
    }
    try {
      await user.update({ ...dto });
      return user;
    } catch (e) {
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    try {
      await user.destroy();
    } catch (e) {
      throw new InternalServerErrorException('Failed to delete user');
    }
  }
}
