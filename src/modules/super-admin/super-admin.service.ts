import { Injectable, ConflictException, NotFoundException, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { SuperAdmin } from './super-admin.model';
import { Company } from '../companies/companies.model';
import { User } from '../users/users.model';
import { Employee } from '../employees/employees.model';
import { CreateSuperAdminDto } from './dto/create-super-admin.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyAdminDto } from './dto/create-company-admin.dto';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name);

  constructor(
    @InjectModel(SuperAdmin)
    private superAdminModel: typeof SuperAdmin,
    @InjectModel(Company)
    private companyModel: typeof Company,
    @InjectModel(User)
    private userModel: typeof User,
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
    private jwtService: JwtService,
  ) {}

  // Create Super Admin (Registration)
  async createSuperAdmin(createSuperAdminDto: CreateSuperAdminDto): Promise<SuperAdmin> {
    const { email, password, name } = createSuperAdminDto;

    // Check if super admin already exists
    const existingSuperAdmin = await this.superAdminModel.findOne({
      where: { email },
    });

    if (existingSuperAdmin) {
      throw new ConflictException('Super admin with this email already exists');
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create super admin
    const superAdmin = await this.superAdminModel.create({
      email,
      passwordHash,
      name,
    });

    return superAdmin;
  }

  // Create Company
  async createCompany(createCompanyDto: CreateCompanyDto): Promise<Company> {
    try {
      this.logger.log('Creating company with data:', createCompanyDto);
      
      // Generate company code manually
      const companyCode = await this.generateCompanyCode(createCompanyDto.name);
      this.logger.log('Generated company code:', companyCode);
      
      const company = await this.companyModel.create({
        name: createCompanyDto.name,
        companyCode: companyCode, // Set the generated code
        address: createCompanyDto.address,
        phone: createCompanyDto.phone,
        email: createCompanyDto.email,
        website: createCompanyDto.website,
        logoUrl: createCompanyDto.logoUrl,
      });
      
      this.logger.log('Company created successfully:', company.toJSON());
      return company;
    } catch (error) {
      this.logger.error('Error creating company:', error.message);
      this.logger.error('Stack trace:', error.stack);
      throw error;
    }
  }

  // Generate unique company code
  private async generateCompanyCode(companyName: string): Promise<string> {
    try {
      this.logger.log('Generating company code for:', companyName);
      
      const words = companyName.trim().split(/\s+/);
      let baseCode = '';
      
      if (words.length === 1) {
        // Single word: take first 2-3 characters
        baseCode = words[0].substring(0, 3).toUpperCase();
      } else {
        // Multiple words: take first letter of each word (max 4)
        baseCode = words
          .slice(0, 4)
          .map(word => word.charAt(0).toUpperCase())
          .join('');
      }

      this.logger.log('Base code generated:', baseCode);

      // Ensure uniqueness by adding numbers if needed
      let finalCode = baseCode;
      let counter = 1;
      
      while (await this.companyModel.findOne({ where: { companyCode: finalCode } })) {
        counter++;
        finalCode = `${baseCode}${counter}`;
        this.logger.log('Code exists, trying:', finalCode);
      }
      
      this.logger.log('Final company code:', finalCode);
      return finalCode;
    } catch (error) {
      this.logger.error('Error generating company code:', error);
      throw error;
    }
  }

  // Get All Companies
  async getAllCompanies(): Promise<Company[]> {
    return this.companyModel.findAll({
      order: [['createdAt', 'DESC']],
    });
  }

  // Get Company by ID
  async getCompanyById(id: string): Promise<Company> {
    const company = await this.companyModel.findByPk(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  // Validate Super Admin (for authentication)
  async validateSuperAdmin(email: string, password: string): Promise<SuperAdmin | null> {
    const superAdmin = await this.superAdminModel.findOne({
      where: { email, isActive: true },
    });

    if (superAdmin && await bcrypt.compare(password, superAdmin.passwordHash)) {
      return superAdmin;
    }

    return null;
  }

  // Find Super Admin by ID
  async findSuperAdminById(id: string): Promise<SuperAdmin | null> {
    return this.superAdminModel.findByPk(id);
  }

  // Generate JWT Token for Super Admin
  generateToken(superAdmin: SuperAdmin): string {
    const payload = {
      userId: superAdmin.id,
      email: superAdmin.email,
      role: Role.SUPER_ADMIN,
      tenantId: null, // Super admin has no tenant
      userType: 'super_admin',
    };

    return this.jwtService.sign(payload);
  }

  // Super Admin Login
  async login(email: string, password: string): Promise<{ superAdmin: SuperAdmin; token: string }> {
    const superAdmin = await this.validateSuperAdmin(email, password);
    
    if (!superAdmin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await superAdmin.update({ lastLoginAt: new Date() });

    const token = this.generateToken(superAdmin);

    return { superAdmin, token };
  }

  // Create Company Admin
  async createCompanyAdmin(createCompanyAdminDto: CreateCompanyAdminDto & { companyId: string }): Promise<{ user: User; employee: Employee }> {
    try {
      this.logger.log('Creating company admin:', createCompanyAdminDto);

      // Verify company exists
      const company = await this.companyModel.findByPk(createCompanyAdminDto.companyId);
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      // Check if user already exists
      const existingUser = await this.userModel.findOne({
        where: { email: createCompanyAdminDto.email }
      });
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // Generate employee ID with company prefix
      const employeeId = await this.generateEmployeeId(company.companyCode);
      this.logger.log('Generated employee ID:', employeeId);

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(createCompanyAdminDto.password, saltRounds);

      // Create user record
      this.logger.log('Creating user record with tenantId:', createCompanyAdminDto.companyId);
      const user = await this.userModel.create({
        email: createCompanyAdminDto.email,
        passwordHash,
        firstName: createCompanyAdminDto.firstName,
        lastName: createCompanyAdminDto.lastName,
        role: Role.ADMIN, // Company Admin role
        tenantId: createCompanyAdminDto.companyId,
        isActive: true,
        isFirstLogin: true,
      });
      this.logger.log('User record created successfully');

      // Create employee record
      this.logger.log('Creating employee record with tenantId:', createCompanyAdminDto.companyId);
      const employee = await this.employeeModel.create({
        employeeId,
        name: createCompanyAdminDto.name,
        email: createCompanyAdminDto.email,
        phone: createCompanyAdminDto.phone,
        department: createCompanyAdminDto.department,
        designation: createCompanyAdminDto.designation,
        joiningDate: new Date().toISOString().split('T')[0], // Today
        status: 'active',
        tenantId: createCompanyAdminDto.companyId,
      });
      this.logger.log('Employee record created successfully');

      this.logger.log('Company admin created successfully');
      return { user, employee };
    } catch (error) {
      this.logger.error('Error creating company admin:', error.message);
      throw error;
    }
  }

  // Generate employee ID with company prefix
  private async generateEmployeeId(companyCode: string): Promise<string> {
    try {
      // Find the highest employee number for this company
      const lastEmployee = await this.employeeModel.findOne({
        where: {
          employeeId: {
            [require('sequelize').Op.like]: `${companyCode}_EMP%`
          }
        },
        order: [['employeeId', 'DESC']]
      });

      let nextNumber = 1;
      if (lastEmployee) {
        // Extract number from employeeId like "HI_EMP001"
        const match = lastEmployee.employeeId.match(/EMP(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      // Format with leading zeros (e.g., 001, 002, etc.)
      const formattedNumber = nextNumber.toString().padStart(3, '0');
      return `${companyCode}_EMP${formattedNumber}`;
    } catch (error) {
      this.logger.error('Error generating employee ID:', error);
      throw error;
    }
  }

  // Get Company Admins
  async getCompanyAdmins(companyId: string): Promise<User[]> {
    return this.userModel.findAll({
      where: {
        tenantId: companyId,
        role: Role.ADMIN
      },
      include: [
        {
          model: Employee,
          as: 'employee'
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }
}
