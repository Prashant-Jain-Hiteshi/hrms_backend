import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { LeaveType } from './leave-type.model';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave-type.dto';
import { Op } from 'sequelize';

@Injectable()
export class LeaveTypeService {
  constructor(
    @InjectModel(LeaveType)
    private leaveTypeModel: typeof LeaveType,
  ) {}

  async createLeaveType(
    createLeaveTypeDto: CreateLeaveTypeDto,
  ): Promise<LeaveType> {
    try {
      // Check if leave type with same name already exists (only among active records)
      const existingLeaveType = await this.leaveTypeModel.findOne({
        where: {
          name: {
            [Op.iLike]: createLeaveTypeDto.name.trim(),
          },
          isActive: true,
        },
      });

      if (existingLeaveType) {
        throw new ConflictException('Leave type with this name already exists');
      }

      const leaveType = await this.leaveTypeModel.create({
        ...createLeaveTypeDto,
        name: createLeaveTypeDto.name.trim(),
      });

      return leaveType;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      console.error('LeaveType creation error:', error);

      // Provide more specific error messages
      if (error.name === 'SequelizeDatabaseError') {
        throw new BadRequestException(`Database error: ${error.message}`);
      }
      if (error.name === 'SequelizeValidationError') {
        throw new BadRequestException(
          `Validation error: ${error.errors?.map((e: any) => e.message).join(', ')}`,
        );
      }
      if (error.name === 'SequelizeUniqueConstraintError') {
        throw new ConflictException('Leave type with this name already exists');
      }

      throw new BadRequestException(
        `Failed to create leave type: ${error.message}`,
      );
    }
  }

  async getAllLeaveTypes(): Promise<LeaveType[]> {
    return this.leaveTypeModel.findAll({
      where: { isActive: true },
      order: [['createdAt', 'DESC']],
    });
  }

  async getLeaveTypeById(id: number): Promise<LeaveType> {
    const leaveType = await this.leaveTypeModel.findOne({
      where: { id, isActive: true },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    return leaveType;
  }

  async updateLeaveType(
    id: number,
    updateLeaveTypeDto: UpdateLeaveTypeDto,
  ): Promise<LeaveType> {
    const leaveType = await this.getLeaveTypeById(id);

    // Check if name is being updated and if it conflicts with existing active records
    if (
      updateLeaveTypeDto.name &&
      updateLeaveTypeDto.name.trim() !== leaveType.name
    ) {
      const existingLeaveType = await this.leaveTypeModel.findOne({
        where: {
          name: {
            [Op.iLike]: updateLeaveTypeDto.name.trim(),
          },
          id: { [Op.ne]: id },
          isActive: true,
        },
      });

      if (existingLeaveType) {
        throw new ConflictException('Leave type with this name already exists');
      }
    }

    try {
      await leaveType.update({
        ...updateLeaveTypeDto,
        name: updateLeaveTypeDto.name
          ? updateLeaveTypeDto.name.trim()
          : leaveType.name,
      });

      return leaveType.reload();
    } catch (error) {
      throw new BadRequestException('Failed to update leave type');
    }
  }

  async deleteLeaveType(id: number): Promise<{ message: string }> {
    const leaveType = await this.getLeaveTypeById(id);

    try {
      // Hard delete to avoid unique constraint issues
      await leaveType.destroy();
      return { message: 'Leave type deleted successfully' };
    } catch (error) {
      console.error('Error deleting leave type:', error);
      throw new BadRequestException('Failed to delete leave type');
    }
  }

  async searchLeaveTypes(searchTerm: string): Promise<LeaveType[]> {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAllLeaveTypes();
    }

    return this.leaveTypeModel.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          {
            name: {
              [Op.iLike]: `%${searchTerm.trim()}%`,
            },
          },
          {
            description: {
              [Op.iLike]: `%${searchTerm.trim()}%`,
            },
          },
        ],
      },
      order: [['createdAt', 'DESC']],
    });
  }

  async getLeaveTypesByEligibility(eligibility: string): Promise<LeaveType[]> {
    return this.leaveTypeModel.findAll({
      where: {
        isActive: true,
        [Op.or]: [{ eligibility: 'all' }, { eligibility }],
      },
      order: [['name', 'ASC']],
    });
  }

  async toggleLeaveTypeStatus(id: number): Promise<LeaveType> {
    const leaveType = await this.leaveTypeModel.findByPk(id);

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    await leaveType.update({ isActive: !leaveType.isActive });
    return leaveType.reload();
  }
}
