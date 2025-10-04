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
import { User } from '../users/users.model';
import { Op, QueryTypes } from 'sequelize';
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

  // Enhanced employee listing with pagination, search and filters
  async findAllWithFilters(
    queryParams: {
      page: number;
      limit: number;
      search: string;
      department: string;
      status: string;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    },
    tenantId: string,
  ): Promise<{
    employees: Employee[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalRecords: number;
      limit: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    filters: {
      departments: string[];
      statuses: string[];
    };
  }> {
    // Always require tenantId
    if (!tenantId) {
      this.logger.warn('No tenantId provided - returning empty result');
      return {
        employees: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalRecords: 0,
          limit: queryParams.limit,
          hasNext: false,
          hasPrev: false,
        },
        filters: { departments: [], statuses: [] },
      };
    }

    const { page, limit, search, department, status, sortBy, sortOrder } = queryParams;
    const offset = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {
      // Always filter by tenantId and exclude null values
      tenantId: {
        [Op.and]: [
          { [Op.ne]: null }, // Not null
          { [Op.eq]: tenantId } // Equals the provided tenantId
        ]
      },
      // Exclude Administration department employees (where admin users are typically placed)
      department: {
        [Op.ne]: 'Administration'
      }
    };

    // Add search filter
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { employeeId: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Add department filter
    if (department) {
      whereClause.department = { [Op.iLike]: `%${department}%` };
    }

    // Add status filter
    if (status) {
      whereClause.status = status;
    }

    // Validate and set sort field
    const allowedSortFields = ['name', 'email', 'employeeId', 'department', 'joiningDate', 'createdAt'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'joiningDate';

    this.logger.log('Enhanced query filters:', {
      tenantId,
      search,
      department,
      status,
      sortBy: validSortBy,
      sortOrder,
      page,
      limit,
      offset
    });

    console.log('🔍 === EMPLOYEE API DEBUG - Admin Filter Applied ===');
    console.log('📊 Query Parameters:', { page, limit, search, department, status });
    console.log('🚫 Admin Filter: Excluding employees with user.role = "admin" AND department = "Administration"');

    // Execute main query
    const result = await this.employeeModel.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      order: [[validSortBy, sortOrder.toUpperCase()]],
      include: [
        {
          model: Company,
          as: 'company',
          attributes: ['name', 'companyCode']
        },
        {
          model: User,
          as: 'user',
          attributes: ['role'],
          where: {
            [Op.or]: [
              { role: { [Op.ne]: 'admin' } }, // Include employees with non-admin roles
              { role: { [Op.is]: null } }     // Include employees without user accounts
            ]
          },
          required: false // LEFT JOIN but with proper OR condition
        }
      ]
    });

    console.log('📈 Query Results:');
    console.log('📊 Total Records Found:', result.count);
    console.log('👥 Employees Returned:', result.rows.length);
    console.log('🏢 Employee Details:', result.rows.map(emp => ({
      id: emp.id,
      name: emp.name,
      email: emp.email,
      department: emp.department,
      userRole: emp.user?.role || 'NO_USER'
    })));

    // Get filter options (departments and statuses) - exclude admin users
    const filterOptionsQuery = await this.employeeModel.findAll({
      where: {
        tenantId: {
          [Op.and]: [
            { [Op.ne]: null },
            { [Op.eq]: tenantId }
          ]
        },
        // Exclude Administration department employees
        department: {
          [Op.ne]: 'Administration'
        }
      },
      attributes: ['department', 'status'],
      include: [
        {
          model: User,
          as: 'user',
          attributes: [],
          where: {
            [Op.or]: [
              { role: { [Op.ne]: 'admin' } }, // Include employees with non-admin roles
              { role: { [Op.is]: null } }     // Include employees without user accounts
            ]
          },
          required: false // LEFT JOIN but with proper OR condition
        }
      ],
      group: ['department', 'status'],
      raw: true
    });

    const departments = [...new Set(
      filterOptionsQuery
        .map(item => item.department)
        .filter(dept => dept && dept.trim())
    )].sort();

    const statuses = [...new Set(
      filterOptionsQuery
        .map(item => item.status)
        .filter(status => status && status.trim())
    )].sort();

    // Calculate pagination
    const totalRecords = result.count;
    const totalPages = Math.ceil(totalRecords / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    const finalResponse = {
      employees: result.rows,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords,
        limit,
        hasNext,
        hasPrev,
      },
      filters: {
        departments,
        statuses,
      },
    };

    console.log('✅ Final API Response:');
    console.log('📊 Pagination:', finalResponse.pagination);
    console.log('🏢 Departments Available:', finalResponse.filters.departments);
    console.log('📈 Statuses Available:', finalResponse.filters.statuses);
    console.log('🚫 Admin Users Excluded: YES');
    console.log('🔍 === END EMPLOYEE API DEBUG ===\n');

    return finalResponse;
  }

  // Keep the original findAll method for backward compatibility
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
      },
      // Exclude Administration department employees (where admin users are typically placed)
      department: {
        [Op.ne]: 'Administration'
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
        },
        {
          model: User,
          as: 'user',
          attributes: ['role'],
          where: {
            [Op.or]: [
              { role: { [Op.ne]: 'admin' } }, // Include employees with non-admin roles
              { role: { [Op.is]: null } }     // Include employees without user accounts
            ]
          },
          required: false // LEFT JOIN but with proper OR condition
        }
      ]
    });
  }

  // Tenant-aware employee lookup - only find employees with valid tenantId
  async findOne(id: string, tenantId?: string): Promise<Employee> {
    const whereClause: any = { 
      id,
      // Exclude Administration department employees (where admin users are typically placed)
      department: {
        [Op.ne]: 'Administration'
      }
    };
    
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

    const emp = await this.employeeModel.findOne({ 
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['role'],
          where: {
            [Op.or]: [
              { role: { [Op.ne]: 'admin' } }, // Include employees with non-admin roles
              { role: { [Op.is]: null } }     // Include employees without user accounts
            ]
          },
          required: false // LEFT JOIN but with proper OR condition
        }
      ]
    });
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
    console.log('🗑️ === EMPLOYEE DELETION WITH CASCADE START ===');
    console.log('🆔 Employee ID to delete:', id);
    console.log('🏢 TenantId:', tenantId);
    console.log('💾 Using non-transactional approach for better error handling');
    this.logger.log(`Starting cascading deletion of employee ${id} for tenant: ${tenantId}`);
    
    try {

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

      // Step 2: Delete all related records in correct order (child tables first)
      console.log('🔗 Step 2: Deleting related records in cascade order...');
      
      // 2.1 Delete employee monthly leave records
      try {
        const { EmployeeMonthlyLeaveRecord } = require('../leave/models/employee-monthly-leave-record.model');
        const deletedLeaveRecords = await EmployeeMonthlyLeaveRecord.destroy({
          where: { employeeId: emp.id }
        });
        console.log('📋 Deleted employee monthly leave records:', deletedLeaveRecords);
      } catch (leaveRecordError) {
        console.log('⚠️ Could not delete employee monthly leave records:', leaveRecordError.message);
        console.log('⚠️ Leave record error details:', leaveRecordError);
        // Don't abort transaction for this error
      }

      // 2.2 Delete leave status histories (where employee is changer)
      try {
        const { LeaveStatusHistory } = require('../leave/leave.model');
        const deletedStatusHistories = await LeaveStatusHistory.destroy({
          where: { changedBy: emp.id }
        });
        console.log('📝 Deleted leave status histories:', deletedStatusHistories);
      } catch (statusError) {
        console.log('⚠️ Could not delete leave status histories:', statusError.message);
      }

      // 2.3 Delete leave CC records
      try {
        const { LeaveCc } = require('../leave/leave.model');
        const deletedCcRecords = await LeaveCc.destroy({
          where: { employeeId: emp.id }
        });
        console.log('📧 Deleted leave CC records:', deletedCcRecords);
      } catch (ccError) {
        console.log('⚠️ Could not delete leave CC records:', ccError.message);
      }

      // 2.4 Delete leave approvers
      try {
        const { LeaveApprover } = require('../leave/leave.model');
        const deletedApprovers = await LeaveApprover.destroy({
          where: { employeeId: emp.id }
        });
        console.log('✅ Deleted leave approvers:', deletedApprovers);
      } catch (approverError) {
        console.log('⚠️ Could not delete leave approvers:', approverError.message);
      }

      // 2.5 Update leave requests (set approvedBy to null where employee is approver)
      try {
        const { LeaveRequest } = require('../leave/leave.model');
        const updatedApprovals = await LeaveRequest.update(
          { approvedBy: null },
          { where: { approvedBy: emp.id } }
        );
        console.log('🔄 Updated leave requests (removed as approver):', updatedApprovals[0]);
      } catch (approvalError) {
        console.log('⚠️ Could not update leave approvals:', approvalError.message);
      }

      // 2.6 Delete leave requests (where employee is requester)
      try {
        const { LeaveRequest } = require('../leave/leave.model');
        const deletedLeaveRequests = await LeaveRequest.destroy({
          where: { employeeId: emp.id }
        });
        console.log('📋 Deleted leave requests:', deletedLeaveRequests);
      } catch (leaveError) {
        console.log('⚠️ Could not delete leave requests:', leaveError.message);
      }

      // 2.7 Delete leave credits
      try {
        const { LeaveCredit } = require('../leave/leave-credit.model');
        const deletedCredits = await LeaveCredit.destroy({
          where: { employeeId: emp.id }
        });
        console.log('💳 Deleted leave credits:', deletedCredits);
      } catch (creditError) {
        console.log('⚠️ Could not delete leave credits:', creditError.message);
      }

      // 2.8 Delete compensatory leave records
      try {
        const { CompensatoryLeave } = require('../leave/compensatory-leave.model');
        const deletedCompLeave = await CompensatoryLeave.destroy({
          where: { employeeId: emp.employeeId } // Note: uses string employeeId
        });
        console.log('🏆 Deleted compensatory leave records:', deletedCompLeave);
      } catch (compError) {
        console.log('⚠️ Could not delete compensatory leave records:', compError.message);
      }

      // 2.9 Delete employee bank details
      try {
        const { EmployeeBankDetails } = require('../payroll/models/employee-payroll-record.model');
        const deletedBankDetails = await EmployeeBankDetails.destroy({
          where: { employeeId: emp.id }
        });
        console.log('🏦 Deleted employee bank details:', deletedBankDetails);
      } catch (bankError) {
        console.log('⚠️ Could not delete employee bank details:', bankError.message);
      }

      // 2.10 Delete payroll approvals (child records that reference payroll records)
      try {
        // First, get all payroll record IDs for this employee
        const { EmployeePayrollRecord } = require('../payroll/models/employee-payroll-record.model');
        const payrollRecords = await EmployeePayrollRecord.findAll({
          where: { employeeId: emp.id },
          attributes: ['id']
        });
        
        if (payrollRecords.length > 0) {
          const payrollRecordIds = payrollRecords.map((record: any) => record.id);
          console.log('🔍 Found payroll records to clean:', payrollRecordIds);
          
          // Delete payroll approvals that reference these payroll records
          try {
            const { PayrollApproval } = require('../payroll/models/employee-payroll-record.model');
            const deletedApprovals = await PayrollApproval.destroy({
              where: { payrollRecordId: { [Op.in]: payrollRecordIds } }
            });
            console.log('✅ Deleted payroll approvals:', deletedApprovals);
          } catch (approvalError) {
            console.log('⚠️ Could not delete payroll approvals:', approvalError.message);
          }

          // Delete payroll adjustments that reference these payroll records
          try {
            const { PayrollAdjustment } = require('../payroll/models/employee-payroll-record.model');
            const deletedAdjustments = await PayrollAdjustment.destroy({
              where: { payrollRecordId: { [Op.in]: payrollRecordIds } }
            });
            console.log('⚖️ Deleted payroll adjustments:', deletedAdjustments);
          } catch (adjustmentError) {
            console.log('⚠️ Could not delete payroll adjustments:', adjustmentError.message);
          }
        }
      } catch (payrollLookupError) {
        console.log('⚠️ Could not lookup payroll records for approval cleanup:', payrollLookupError.message);
      }


      // 2.11 Delete employee payroll records
      try {
        const { EmployeePayrollRecord } = require('../payroll/models/employee-payroll-record.model');
        
        // First, check what payroll records exist
        const existingRecords = await EmployeePayrollRecord.findAll({
          where: { employeeId: emp.id },
          attributes: ['id', 'employeeId', 'month', 'year', 'status']
        });
        console.log('🔍 Found existing payroll records:', existingRecords.length);
        existingRecords.forEach((record: any) => {
          console.log(`   - Record ID: ${record.id}, Month: ${record.month}, Status: ${record.status}`);
        });
        
        const deletedPayrollRecords = await EmployeePayrollRecord.destroy({
          where: { employeeId: emp.id } // FIXED: uses UUID employeeId, not string
        });
        console.log('💰 Deleted employee payroll records:', deletedPayrollRecords);
      } catch (payrollError) {
        console.log('⚠️ Could not delete payroll records:', payrollError.message);
        console.log('⚠️ Payroll error details:', payrollError);
      }

      // 2.12 Delete old payroll records (legacy table)
      try {
        const { PayrollRecord } = require('../payroll/payroll.model');
        const deletedOldPayroll = await PayrollRecord.destroy({
          where: { employeeId: emp.id }
        });
        console.log('📊 Deleted legacy payroll records:', deletedOldPayroll);
      } catch (oldPayrollError) {
        console.log('⚠️ Could not delete legacy payroll records:', oldPayrollError.message);
      }

      // 2.13 Delete attendance sessions first (child records)
      try {
        const { AttendanceSession } = require('../attendance/attendance-session.model');
        const deletedSessions = await AttendanceSession.destroy({
          where: { userId: emp.id } // Sessions reference userId, not employeeId
        });
        console.log('⏰ Deleted attendance sessions:', deletedSessions);
      } catch (sessionError) {
        console.log('⚠️ Could not delete attendance sessions:', sessionError.message);
      }

      // 2.14 Delete attendance records
      try {
        const { Attendance } = require('../attendance/attendance.model');
        const deletedAttendance = await Attendance.destroy({
          where: { employeeId: emp.id }
        });
        console.log('📅 Deleted attendance records:', deletedAttendance);
      } catch (attendanceError) {
        console.log('⚠️ Could not delete attendance records:', attendanceError.message);
      }

      // 2.15 Delete notifications
      try {
        const { Notification } = require('../notifications/entities/notification.entity');
        const deletedNotifications = await Notification.destroy({
          where: { employeeId: emp.employeeId } // Notifications use string employeeId
        });
        console.log('🔔 Deleted notifications:', deletedNotifications);
      } catch (notificationError) {
        console.log('⚠️ Could not delete notifications:', notificationError.message);
      }

      // Step 3: Finally delete the employee record
      console.log('🗑️ Step 3: Deleting employee record...');
      console.log('🔍 Employee details before deletion:', {
        id: emp.id,
        employeeId: emp.employeeId,
        email: emp.email,
        name: emp.name
      });
      await emp.destroy();
      console.log('✅ Employee record deleted successfully');

      // Step 4: Delete the user account (if exists)
      console.log('👤 Step 4: Deleting user account...');
      console.log('🔍 Looking for user with email:', emp.email);
      
      try {
        // Method 1: Try to find user by email using the service
        const userAccount = await this.usersService.findByEmail(emp.email);
        if (userAccount) {
          console.log('✅ Found user account:', {
            id: userAccount.id,
            email: userAccount.email,
            role: userAccount.role
          });
          await this.usersService.remove(userAccount.id);
          console.log('✅ User account deleted via service:', userAccount.email);
        } else {
          console.log('⚠️ No user account found via service, trying direct database query...');
          
          // Method 2: Direct database query as fallback
          const { User } = require('../users/users.model');
          const directUser = await User.findOne({
            where: { email: emp.email }
          });
          
          if (directUser) {
            console.log('✅ Found user via direct query:', {
              id: directUser.id,
              email: directUser.email,
              role: directUser.role
            });
            await directUser.destroy();
            console.log('✅ User account deleted via direct query:', directUser.email);
          } else {
            console.log('ℹ️ No user account found in database for email:', emp.email);
          }
        }
      } catch (userError) {
        console.log('⚠️ Could not delete user account:', userError.message);
        console.log('⚠️ User deletion error details:', userError);
        
        // Method 3: Last resort - direct SQL deletion
        try {
          console.log('🔄 Attempting direct SQL deletion as last resort...');
          await this.employeeModel.sequelize?.query(
            'DELETE FROM users WHERE email = ?',
            {
              replacements: [emp.email],
              type: QueryTypes.DELETE
            }
          );
          console.log('✅ User deleted via direct SQL query');
        } catch (sqlError) {
          console.log('⚠️ Direct SQL deletion also failed:', sqlError.message);
          console.log('ℹ️ Employee deletion completed but user account may still exist');
        }
      }
      
      console.log('✅ === EMPLOYEE DELETION COMPLETED SUCCESSFULLY ===');
      console.log('🎉 Employee and all related records deleted successfully');
      this.logger.log(`Successfully deleted employee ${id} and all related records`);

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
          `Cannot delete employee: Foreign key constraint error. ` +
          `Constraint: ${error.index} on table ${error.table}. ` +
          `Some related records may still exist that need manual cleanup.`
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
        `Failed to delete employee: ${error.message}. ` +
        `Check server logs for details about which deletion steps succeeded or failed.`
      );
    }
  }
}
