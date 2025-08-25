import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Employee } from './employees.model';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { UsersService } from '../users/users.service';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectModel(Employee)
    private readonly employeeModel: typeof Employee,
    private readonly usersService: UsersService,
  ) {}

  private async generateUniqueEmployeeId(): Promise<string> {
    // EMP + 6 random digits, retry a few times for uniqueness
    for (let i = 0; i < 5; i++) {
      const candidate = `EMP${Math.floor(100000 + Math.random() * 900000)}`;
      const exists = await this.employeeModel.findOne({ where: { employeeId: candidate } });
      if (!exists) return candidate;
    }
    // Fallback to timestamp-based
    const fallback = `EMP${Date.now().toString().slice(-6)}`;
    return fallback;
  }

  async create(dto: CreateEmployeeDto): Promise<any> {
    // Enforce unique email
    const emailExists = await this.employeeModel.findOne({ where: { email: dto.email } });
    if (emailExists) throw new ConflictException('Email already exists');
    // Generate an employeeId on the server
    const employeeId = await this.generateUniqueEmployeeId();
    try {
      const employee = await this.employeeModel.create({ ...dto, employeeId } as any);

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
          } as any);
        }
      } catch (e) {
        // Do not fail employee creation if user creation fails
      }

      // Return employee plus temp password info
      return { ...employee.toJSON(), temporaryPassword };
    } catch (e) {
      throw new InternalServerErrorException('Failed to create employee');
    }
  }

  async findAll(limit = 50, offset = 0): Promise<{ rows: Employee[]; count: number }> {
    return this.employeeModel.findAndCountAll({ limit, offset, order: [['createdAt', 'DESC']] });
  }

  async findOne(id: string): Promise<Employee> {
    const emp = await this.employeeModel.findByPk(id);
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const emp = await this.findOne(id);
    // Disallow changing employeeId via update
    if ((dto as any).employeeId) delete (dto as any).employeeId;
    // If email is being updated, ensure uniqueness
    if (dto.email && dto.email !== emp.email) {
      const emailExists = await this.employeeModel.findOne({ where: { email: dto.email } });
      if (emailExists) throw new ConflictException('Email already exists');
    }
    try {
      await emp.update({ ...dto });
      return emp;
    } catch (e) {
      throw new InternalServerErrorException('Failed to update employee');
    }
  }

  async remove(id: string): Promise<void> {
    const emp = await this.findOne(id);
    try {
      await emp.destroy();
    } catch (e) {
      throw new InternalServerErrorException('Failed to delete employee');
    }
  }
}
