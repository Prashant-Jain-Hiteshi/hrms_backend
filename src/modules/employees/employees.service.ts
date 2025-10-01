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
import { AuthService } from '../auth/auth.service';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    @InjectModel(Employee)
    private readonly employeeModel: typeof Employee,
    @InjectModel(Company)
    private readonly companyModel: typeof Company,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
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
    try {
      console.log('🚀 === EMPLOYEE CREATION START ===');
      console.log('📝 DTO received:', JSON.stringify(dto, null, 2));
      console.log('🏢 TenantId:', tenantId);
      this.logger.log('Creating employee with tenantId:', tenantId);
    
      // Check if email exists within the same tenant (or globally if no tenant)
      console.log('📧 Step 1: Checking email uniqueness...');
      const whereClause: any = { email: dto.email };
      if (tenantId) {
        whereClause.tenantId = tenantId;
      }
      console.log('🔍 Email check where clause:', whereClause);
      
      const emailExists = await this.employeeModel.findOne({
        where: whereClause,
      });
      
      if (emailExists) {
        console.log('❌ Email already exists:', dto.email);
        throw new ConflictException('Email already exists in this company');
      }
      console.log('✅ Email is unique, proceeding...');

      // Generate tenant-aware employeeId
      console.log('🆔 Step 2: Generating employee ID...');
      let employeeId: string;
      if (tenantId) {
        console.log('🏢 Using tenant-aware ID generation');
        employeeId = await this.generateTenantEmployeeId(tenantId);
      } else {
        console.log('🔄 Using legacy ID generation');
        employeeId = await this.generateUniqueEmployeeId();
      }
      console.log('✅ Generated employee ID:', employeeId);

      // Derive role from department
      const mapDepartmentToRole = (department?: string): Role => {
        const dept = (department || '').toLowerCase();
        if (dept.includes('admin')) return Role.ADMIN;
        if (dept.includes('human') || dept.includes('hr')) return Role.HR;
        if (dept.includes('finance')) return Role.FINANCE;
        return Role.EMPLOYEE;
      };

      const role = mapDepartmentToRole(dto.department);
      console.log('🎭 Step 3: Role mapping - Department:', dto.department, '→ Role:', role);

      // Build temporary password: Firstname@123
      console.log('🔐 Step 4: Generating temporary password...');
      const parts = (dto.name || '').trim().split(/\s+/);
      const firstName = (parts[0] || 'User').replace(/[^a-zA-Z]/g, '');
      const capFirst = firstName
        ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
        : 'User';
      const temporaryPassword = `${capFirst}@123`;
      console.log('✅ Generated password:', temporaryPassword);

      // Split first/last name for user profile
      const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
      console.log('👤 Name parts - First:', capFirst, 'Last:', lastName);

      // IMPORTANT: Create User account FIRST (due to foreign key constraint)
      console.log('👥 Step 5: Creating user account FIRST...');
      try {
        const existingUser = await this.usersService.findByEmail(dto.email);
        if (!existingUser) {
          console.log('👥 User does not exist, creating new user...');
          console.log('📊 User data to create:', {
            email: dto.email,
            password: temporaryPassword,
            firstName: capFirst,
            lastName: lastName || capFirst,
            role,
            tenantId
          });
          
          await this.usersService.create({
            email: dto.email,
            password: temporaryPassword,
            firstName: capFirst,
            lastName: lastName || capFirst,
            role,
            tenantId, // Set tenant ID for user as well
          } as any);
          console.log('✅ User account created successfully');
        } else {
          console.log('👥 User already exists, skipping user creation');
        }
      } catch (error) {
        console.log('⚠️ Failed to create user account:', error.message);
        console.log('📊 User creation error stack:', error.stack);
        this.logger.warn('Failed to create user account:', error.message);
        // IMPORTANT: Fail employee creation if user creation fails (due to foreign key constraint)
        throw new InternalServerErrorException(`Failed to create user account: ${error.message}`);
      }

      // Now create employee record (after user exists)
      console.log('👤 Step 6: Creating employee record...');
      console.log('📊 Employee data to create:', {
        ...dto,
        employeeId,
        tenantId
      });
      
      const employee = await this.employeeModel.create({
        ...dto,
        employeeId,
        tenantId, // Set the tenant ID
      } as any);
      
      console.log('✅ Employee record created successfully:', employee.id);

      // Send welcome email to the new employee
      console.log('📧 Step 7: Sending welcome email...');
      try {
        console.log('📧 Email recipient:', dto.email);
        const userName = dto.name || `${capFirst} ${lastName}`.trim();
        const roleDisplayName = this.getRoleDisplayName(role);
        console.log('📧 Email data:', { userName, email: dto.email, password: temporaryPassword, role: roleDisplayName });
        
        const emailSent = await this.authService.sendWelcomeEmail(
          userName,
          dto.email,
          temporaryPassword,
          roleDisplayName
        );
        
        if (emailSent) {
          console.log('✅ Welcome email sent successfully to:', dto.email);
          this.logger.log('✅ Welcome email sent successfully to:', dto.email);
        } else {
          console.log('⚠️ Failed to send welcome email to:', dto.email);
          this.logger.warn('⚠️ Failed to send welcome email to:', dto.email);
        }
      } catch (emailError) {
        // Don't fail the entire operation if email fails
        console.log('💥 Error sending welcome email:', emailError.message);
        console.log('📊 Email error stack:', emailError.stack);
        this.logger.error('💥 Error sending welcome email:', emailError.message);
      }

      // Return employee plus temp password info
      console.log('🎉 Step 8: Employee creation completed successfully');
      console.log('📊 Final result:', { employeeId: employee.id, temporaryPassword });
      return { ...employee.toJSON(), temporaryPassword };
      
    } catch (error) {
      console.log('💥 === EMPLOYEE CREATION FAILED ===');
      console.log('❌ Error name:', error.name);
      console.log('❌ Error message:', error.message);
      console.log('📊 Error stack:', error.stack);
      console.log('📝 DTO that failed:', JSON.stringify(dto, null, 2));
      console.log('🏢 TenantId that failed:', tenantId);
      
      this.logger.error('💥 Employee creation failed:', error.message);
      this.logger.error('📊 Error stack:', error.stack);
      
      // Re-throw the original error if it's a known exception
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      
      // For unknown errors, throw a generic 500 error
      throw new InternalServerErrorException(`Failed to create employee: ${error.message}`);
    }
  }

  // Helper method to get user-friendly role display name
  private getRoleDisplayName(role: Role): string {
    switch (role) {
      case Role.ADMIN:
        return 'Administrator';
      case Role.HR:
        return 'HR Manager';
      case Role.FINANCE:
        return 'Finance Manager';
      case Role.EMPLOYEE:
        return 'Employee';
      default:
        return 'Employee';
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
    try {
      console.log('🗑️ === EMPLOYEE DELETION START ===');
      console.log('🆔 Employee ID to delete:', id);
      console.log('🏢 TenantId:', tenantId);
      this.logger.log(`Starting deletion of employee ${id} for tenant: ${tenantId}`);

      // Step 1: Find the employee
      console.log('🔍 Step 1: Finding employee...');
      const emp = await this.findOne(id, tenantId);
      console.log('✅ Employee found:', {
        id: emp.id,
        employeeId: emp.employeeId,
        name: emp.name,
        email: emp.email,
        tenantId: emp.tenantId
      });

      // Step 2: Check for related records that might prevent deletion
      console.log('🔗 Step 2: Checking for related records...');
      
      // Check if employee has any leave requests
      try {
        const { LeaveRequest } = require('../leave/leave.model');
        const leaveCount = await LeaveRequest.count({
          where: { employeeId: emp.id }
        });
        console.log('📋 Leave requests found:', leaveCount);
      } catch (leaveError) {
        console.log('⚠️ Could not check leave requests:', leaveError.message);
      }

      // Check if employee has any payroll records
      try {
        const { EmployeePayrollRecord } = require('../payroll/models/employee-payroll-record.model');
        const payrollCount = await EmployeePayrollRecord.count({
          where: { employeeId: emp.employeeId }
        });
        console.log('💰 Payroll records found:', payrollCount);
      } catch (payrollError) {
        console.log('⚠️ Could not check payroll records:', payrollError.message);
      }

      // Check if employee has any attendance records
      try {
        const { Attendance } = require('../attendance/attendance.model');
        const attendanceCount = await Attendance.count({
          where: { employeeId: emp.id }
        });
        console.log('📅 Attendance records found:', attendanceCount);
      } catch (attendanceError) {
        console.log('⚠️ Could not check attendance records:', attendanceError.message);
      }

      // Check if employee has a user account
      try {
        const userAccount = await this.usersService.findByEmail(emp.email);
        if (userAccount) {
          console.log('👤 User account found:', {
            id: userAccount.id,
            email: userAccount.email,
            role: userAccount.role
          });
        } else {
          console.log('👤 No user account found for this employee');
        }
      } catch (userError) {
        console.log('⚠️ Could not check user account:', userError.message);
      }

      // Step 3: Attempt deletion
      console.log('🗑️ Step 3: Attempting to delete employee...');
      await emp.destroy();
      
      console.log('✅ Employee deleted successfully');
      this.logger.log(`Successfully deleted employee ${id}`);

    } catch (error) {
      console.log('💥 === EMPLOYEE DELETION FAILED ===');
      console.log('❌ Error name:', error.name);
      console.log('❌ Error message:', error.message);
      console.log('📊 Error stack:', error.stack);
      console.log('🆔 Employee ID that failed:', id);
      console.log('🏢 TenantId that failed:', tenantId);
      
      // Log specific database constraint errors
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        console.log('🔗 FOREIGN KEY CONSTRAINT ERROR:');
        console.log('   - Table:', error.table);
        console.log('   - Fields:', error.fields);
        console.log('   - Value:', error.value);
        console.log('   - Index:', error.index);
        console.log('   - SQL:', error.sql);
        
        this.logger.error('Foreign key constraint violation during employee deletion:', {
          table: error.table,
          fields: error.fields,
          value: error.value,
          index: error.index
        });
        
        throw new InternalServerErrorException(
          `Cannot delete employee: This employee has related records that must be deleted first. ` +
          `Constraint: ${error.index} on table ${error.table}`
        );
      }
      
      if (error.name === 'SequelizeValidationError') {
        console.log('✅ VALIDATION ERROR:');
        console.log('   - Errors:', error.errors);
        this.logger.error('Validation error during employee deletion:', error.errors);
      }
      
      if (error.name === 'SequelizeDatabaseError') {
        console.log('🗄️ DATABASE ERROR:');
        console.log('   - SQL:', error.sql);
        console.log('   - Parameters:', error.parameters);
        this.logger.error('Database error during employee deletion:', {
          sql: error.sql,
          parameters: error.parameters
        });
      }
      
      this.logger.error('💥 Employee deletion failed:', error.message);
      this.logger.error('📊 Error stack:', error.stack);
      
      // Re-throw known exceptions
      if (error instanceof NotFoundException) {
        throw error;
      }
      
      // For unknown errors, provide detailed error message
      throw new InternalServerErrorException(
        `Failed to delete employee: ${error.message}. Check server logs for details.`
      );
    }
  }
}
