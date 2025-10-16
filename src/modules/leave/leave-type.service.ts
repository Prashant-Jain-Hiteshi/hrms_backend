import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { LeaveType } from './leave-type.model';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave-type.dto';
import { Company } from '../companies/companies.model';
import { Op } from 'sequelize';

@Injectable()
export class LeaveTypeService {
  private readonly logger = new Logger(LeaveTypeService.name);

  constructor(
    @InjectModel(LeaveType)
    private leaveTypeModel: typeof LeaveType,
  ) {}

  // Tenant-aware leave type creation
  async createLeaveType(
    createLeaveTypeDto: CreateLeaveTypeDto,
    tenantId: string,
  ): Promise<LeaveType> {
    try {
      this.logger.log(`Creating leave type for tenant: ${tenantId}`);
      
      // Check if leave type with same name already exists within the same tenant
      const existingLeaveType = await this.leaveTypeModel.findOne({
        where: {
          name: {
            [Op.iLike]: createLeaveTypeDto.name.trim(),
          },
          tenantId: tenantId,
          isActive: true,
        },
      });

      if (existingLeaveType) {
        throw new ConflictException('Leave type with this name already exists in your company');
      }

      const leaveType = await this.leaveTypeModel.create({
        ...createLeaveTypeDto,
        name: createLeaveTypeDto.name.trim(),
        tenantId: tenantId,
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

  // Tenant-aware leave types listing
  async getAllLeaveTypes(tenantId: string): Promise<LeaveType[]> {
    this.logger.log(`Getting leave types for tenant: ${tenantId}`);
    
    return this.leaveTypeModel.findAll({
      where: { 
        isActive: true,
        tenantId: tenantId 
      },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['name', 'companyCode']
        }
      ]
    });
  }

  // Tenant-aware leave type by ID
  async getLeaveTypeById(id: number, tenantId?: string): Promise<LeaveType> {
    const whereClause: any = { id, isActive: true };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    const leaveType = await this.leaveTypeModel.findOne({
      where: whereClause,
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['name', 'companyCode']
        }
      ]
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    return leaveType;
  }

  // Tenant-aware leave type update
  async updateLeaveType(
    id: number,
    updateLeaveTypeDto: UpdateLeaveTypeDto,
    tenantId: string,
  ): Promise<LeaveType> {
    const leaveType = await this.getLeaveTypeById(id, tenantId);

    // Check if name is being updated and if it conflicts with existing active records within tenant
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
          tenantId: tenantId,
          isActive: true,
        },
      });

      if (existingLeaveType) {
        throw new ConflictException('Leave type with this name already exists in your company');
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

  // Tenant-aware leave type deletion
  async deleteLeaveType(id: number, tenantId: string): Promise<{ message: string }> {
    const leaveType = await this.getLeaveTypeById(id, tenantId);

    try {
      // Hard delete to avoid unique constraint issues
      await leaveType.destroy();
      return { message: 'Leave type deleted successfully' };
    } catch (error) {
      console.error('Error deleting leave type:', error);
      throw new BadRequestException('Failed to delete leave type');
    }
  }

  // Tenant-aware search leave types
  async searchLeaveTypes(searchTerm: string, tenantId: string): Promise<LeaveType[]> {
    if (!searchTerm || searchTerm.trim() === '') {
      return this.getAllLeaveTypes(tenantId);
    }

    return this.leaveTypeModel.findAll({
      where: {
        isActive: true,
        tenantId: tenantId,
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
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['name', 'companyCode']
        }
      ]
    });
  }

  // Tenant-aware leave types by eligibility
  async getLeaveTypesByEligibility(eligibility: string, tenantId: string): Promise<LeaveType[]> {
    return this.leaveTypeModel.findAll({
      where: {
        isActive: true,
        tenantId: tenantId,
        [Op.or]: [{ eligibility: 'all' }, { eligibility }],
      },
      order: [['name', 'ASC']],
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['name', 'companyCode']
        }
      ]
    });
  }

  // Tenant-aware toggle leave type status
  async toggleLeaveTypeStatus(id: number, tenantId: string): Promise<LeaveType> {
    const leaveType = await this.getLeaveTypeById(id, tenantId);

    await leaveType.update({ isActive: !leaveType.isActive });
    return leaveType.reload();
  }
}
