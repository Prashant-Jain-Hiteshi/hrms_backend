import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Employee } from './employees.model';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UsersService } from '../users/users.service';
import { Role } from '../../common/enums/role.enum';
import { Company } from '../companies/companies.model';
import { Op } from 'sequelize';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    @InjectModel(Employee)
    private readonly employeeModel: typeof Employee,
    @InjectModel(Company)
    private readonly companyModel: typeof Company,
    private readonly usersService: UsersService,
  ) {}

  // Generate tenant-aware employee ID with company prefix
  private async generateTenantEmployeeId(tenantId: string): Promise<string> {
    try {
      this.logger.log('Generating employee ID for tenant:', tenantId);
      
      // Get company details
      const company = await this.companyModel.findByPk(tenantId);
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      const companyCode = company.companyCode;
      this.logger.log('Company code:', companyCode);

      // Find the highest employee number for this company
      const lastEmployee = await this.employeeModel.findOne({
        where: {
          employeeId: {
            [Op.like]: `${companyCode}_EMP%`
          },
          tenantId: tenantId
        },
        order: [['employeeId', 'DESC']]
      });

      let nextNumber = 1;
      if (lastEmployee) {
        // Extract number from employeeId like "HN_EMP001"
        const match = lastEmployee.employeeId.match(/EMP(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      // Format with leading zeros (e.g., 001, 002, etc.)
      const formattedNumber = nextNumber.toString().padStart(3, '0');
      const employeeId = `${companyCode}_EMP${formattedNumber}`;
      
      this.logger.log('Generated employee ID:', employeeId);
      return employeeId;
    } catch (error) {
      this.logger.error('Error generating employee ID:', error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  private async generateUniqueEmployeeId(): Promise<string> {
    // EMP + 6 random digits, retry a few times for uniqueness
    for (let i = 0; i < 5; i++) {
      const candidate = `EMP${Math.floor(100000 + Math.random() * 900000)}`;
      const exists = await this.employeeModel.findOne({
        where: { employeeId: candidate },
      });
      if (!exists) return candidate;
    }
    // Fallback to timestamp-based
    const fallback = `EMP${Date.now().toString().slice(-6)}`;
    return fallback;
  }

  // Tenant-aware employee creation
  async create(dto: CreateEmployeeDto, tenantId?: string): Promise<any> {
    this.logger.log('Creating employee with tenantId:', tenantId);
    
    // Check if email exists within the same tenant (or globally if no tenant)
    const whereClause: any = { email: dto.email };
    if (tenantId) {
      whereClause.tenantId = tenantId;
    }
    
    const emailExists = await this.employeeModel.findOne({
      where: whereClause,
    });
    if (emailExists) throw new ConflictException('Email already exists in this company');

    // Generate tenant-aware employeeId
    let employeeId: string;
    if (tenantId) {
      employeeId = await this.generateTenantEmployeeId(tenantId);
    } else {
      // Fallback to legacy method for backward compatibility
      employeeId = await this.generateUniqueEmployeeId();
    }

    try {
      const employee = await this.employeeModel.create({
        ...dto,
        employeeId,
        tenantId, // Set the tenant ID
      } as any);

      // Derive role from department
      const mapDepartmentToRole = (department?: string): Role => {
        const dept = (department || '').toLowerCase();
        if (dept.includes('admin')) return Role.ADMIN;
        if (dept.includes('human') || dept.includes('hr')) return Role.HR;
        if (dept.includes('finance')) return Role.FINANCE;
        return Role.EMPLOYEE;
      };

      const role = mapDepartmentToRole(dto.department);

      // Build temporary password: Firstname@123
      const parts = (dto.name || '').trim().split(/\s+/);
      const firstName = (parts[0] || 'User').replace(/[^a-zA-Z]/g, '');
      const capFirst = firstName
        ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
        : 'User';
      const temporaryPassword = `${capFirst}@123`;

      // Split first/last name for user profile
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';

      // Auto-create User account if not existing
      try {
        const existingUser = await this.usersService.findByEmail(dto.email);
        if (!existingUser) {
          await this.usersService.create({
            email: dto.email,
            password: temporaryPassword,
            firstName: capFirst,
            lastName: lastName || capFirst,
            role,
            tenantId, // Set tenant ID for user as well
          } as any);
        }
      } catch (error) {
        this.logger.warn('Failed to create user account:', error.message);
        // Do not fail employee creation if user creation fails
      }

      // Return employee plus temp password info
      return { ...employee.toJSON(), temporaryPassword };
    } catch {
      throw new InternalServerErrorException('Failed to create employee');
    }
  }

  // Tenant-aware employee listing - ALWAYS filter by tenantId
  async findAll(
    limit = 50,
    offset = 0,
    tenantId: string,
  ): Promise<{ rows: Employee[]; count: number }> {
    // Always require tenantId - never show employees with null tenantId
    if (!tenantId) {
      this.logger.warn('No tenantId provided - returning empty result');
      return { rows: [], count: 0 };
    }

    const whereClause: any = {
      // Always filter by tenantId and exclude null values
      tenantId: {
        [Op.and]: [
          { [Op.ne]: null }, // Not null
          { [Op.eq]: tenantId } // Equals the provided tenantId
        ]
      }
    };

    this.logger.log('Filtering employees by tenantId:', tenantId);

    return this.employeeModel.findAndCountAll({
      where: whereClause,
      limit,
      offset,
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

  // Tenant-aware employee lookup - only find employees with valid tenantId
  async findOne(id: string, tenantId?: string): Promise<Employee> {
    const whereClause: any = { id };
    
    // If tenantId provided, filter by it and exclude null tenantId
    if (tenantId) {
      whereClause.tenantId = {
        [Op.and]: [
          { [Op.ne]: null }, // Not null
          { [Op.eq]: tenantId } // Equals the provided tenantId
        ]
      };
    } else {
      // If no tenantId provided, at least exclude null tenantId employees
      whereClause.tenantId = { [Op.ne]: null };
    }

    const emp = await this.employeeModel.findOne({ where: whereClause });
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  async update(id: string, dto: UpdateEmployeeDto, tenantId?: string): Promise<Employee> {
    const emp = await this.findOne(id, tenantId);
    
    // Remove fields that should not be updated
    const updateData = { ...dto };
    delete (updateData as any).id; // Remove id from update data
    delete (updateData as any).employeeId; // Remove employeeId from update data
    // If email is being updated, ensure uniqueness within tenant
    if (updateData.email && updateData.email !== emp.email) {
      const whereClause: any = { email: updateData.email };
      if (tenantId) {
        whereClause.tenantId = tenantId;
      }
      const emailExists = await this.employeeModel.findOne({
        where: whereClause,
      });
      if (emailExists) throw new ConflictException('Email already exists in this company');
    }
    try {
      await emp.update(updateData);
      return emp;
    } catch {
      throw new InternalServerErrorException('Failed to update employee');
    }
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const emp = await this.findOne(id, tenantId);
    try {
      await emp.destroy();
    } catch {
      throw new InternalServerErrorException('Failed to delete employee');
    }
  }
}
