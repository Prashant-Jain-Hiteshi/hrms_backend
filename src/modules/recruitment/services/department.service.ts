import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  BadRequestException,
  InternalServerErrorException 
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Department } from '../models/department.model';
import { Job } from '../models/job.model';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectModel(Department)
    private departmentModel: typeof Department,
    @InjectModel(Job)
    private jobModel: typeof Job,
  ) {}

  async getOrCreateDefaultDepartments(tenantId: string): Promise<Department[]> {
    try {
      const defaultDepartments = ['Engineering', 'HR', 'Finance'];
      const departments: Department[] = [];

      for (const name of defaultDepartments) {
        const [department] = await this.departmentModel.findOrCreate({
          where: { name, tenantId },
          defaults: { 
            name, 
            tenantId, 
            isActive: true,
            description: `${name} department` 
          }
        });
        departments.push(department);
      }

      return departments;
    } catch (error) {
      console.error('Error creating default departments:', error);
      throw new InternalServerErrorException('Failed to initialize default departments');
    }
  }

  async findAll(tenantId: string): Promise<Department[]> {
    try {
      // Ensure default departments exist
      await this.getOrCreateDefaultDepartments(tenantId);

      const departments = await this.departmentModel.findAll({
        where: { 
          tenantId, 
          isActive: true 
        },
        order: [['name', 'ASC']],
      });

      return departments;
    } catch (error) {
      console.error('Error fetching departments:', error);
      throw new InternalServerErrorException('Failed to fetch departments');
    }
  }

  async findOne(id: string, tenantId: string): Promise<Department> {
    try {
      const department = await this.departmentModel.findOne({
        where: { id, tenantId, isActive: true },
      });

      if (!department) {
        throw new NotFoundException(`Department with ID ${id} not found`);
      }

      return department;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error fetching department:', error);
      throw new InternalServerErrorException('Failed to fetch department');
    }
  }

  async create(createDepartmentDto: CreateDepartmentDto, tenantId: string): Promise<Department> {
    try {
      // Check if department name already exists for this tenant
      const existingDepartment = await this.departmentModel.findOne({
        where: { 
          name: createDepartmentDto.name, 
          tenantId,
          isActive: true 
        },
      });

      if (existingDepartment) {
        throw new ConflictException(`Department '${createDepartmentDto.name}' already exists`);
      }

      const department = await this.departmentModel.create({
        ...createDepartmentDto,
        tenantId,
        isActive: true,
      });

      return department;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      console.error('Error creating department:', error);
      throw new InternalServerErrorException('Failed to create department');
    }
  }

  async update(id: string, updateDepartmentDto: UpdateDepartmentDto, tenantId: string): Promise<Department> {
    try {
      const department = await this.findOne(id, tenantId);

      // Check if new name conflicts with existing department
      if (updateDepartmentDto.name && updateDepartmentDto.name !== department.name) {
        const existingDepartment = await this.departmentModel.findOne({
          where: { 
            name: updateDepartmentDto.name, 
            tenantId,
            isActive: true,
            id: { [Op.ne]: id } // Exclude current department
          },
        });

        if (existingDepartment) {
          throw new ConflictException(`Department '${updateDepartmentDto.name}' already exists`);
        }
      }

      await department.update(updateDepartmentDto);
      return department;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      console.error('Error updating department:', error);
      throw new InternalServerErrorException('Failed to update department');
    }
  }

  async remove(id: string, tenantId: string): Promise<void> {
    try {
      const department = await this.findOne(id, tenantId);

      // Check if department has active jobs
      const jobCount = await this.jobModel.count({
        where: { 
          departmentId: id, 
          tenantId,
          status: { [Op.in]: ['active', 'inactive'] }
        },
      });

      if (jobCount > 0) {
        throw new BadRequestException(
          `Cannot delete department. It has ${jobCount} active job(s). Please close or reassign jobs first.`
        );
      }

      // Soft delete
      await department.update({ isActive: false });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error deleting department:', error);
      throw new InternalServerErrorException('Failed to delete department');
    }
  }
}
