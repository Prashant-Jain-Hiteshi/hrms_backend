import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpStatus,
  HttpCode,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { CreateSuperAdminDto } from './dto/create-super-admin.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyAdminDto } from './dto/create-company-admin.dto';
import { LoginSuperAdminDto } from './dto/login-super-admin.dto';
import { SuperAdminGuard } from './guards/super-admin.guard';

@Controller('api/super-admin')
export class SuperAdminController {
  private readonly logger = new Logger(SuperAdminController.name);

  constructor(private readonly superAdminService: SuperAdminService) {}

  // Register Super Admin (Initial setup - should be secured in production)
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() createSuperAdminDto: CreateSuperAdminDto) {
    const superAdmin = await this.superAdminService.createSuperAdmin(createSuperAdminDto);
    const token = this.superAdminService.generateToken(superAdmin);
    
    return {
      message: 'Super admin created successfully',
      data: superAdmin,
      token: token,
    };
  }

  // Super Admin Login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginSuperAdminDto: LoginSuperAdminDto) {
    const { superAdmin, token } = await this.superAdminService.login(
      loginSuperAdminDto.email,
      loginSuperAdminDto.password,
    );
    
    return {
      message: 'Login successful',
      data: superAdmin,
      token: token,
    };
  }

  // Create Company
  @Post('companies')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCompany(@Body() createCompanyDto: CreateCompanyDto) {
    try {
      this.logger.log('Received request to create company:', createCompanyDto);
      const company = await this.superAdminService.createCompany(createCompanyDto);
      this.logger.log('Company created successfully in controller');
      return {
        message: 'Company created successfully',
        data: company,
      };
    } catch (error) {
      this.logger.error('Error in createCompany controller:', error.message);
      throw error;
    }
  }

  // Get All Companies
  @Get('companies')
  @UseGuards(SuperAdminGuard)
  async getAllCompanies() {
    const companies = await this.superAdminService.getAllCompanies();
    return {
      message: 'Companies retrieved successfully',
      data: companies,
    };
  }

  // Get Company by ID
  @Get('companies/:id')
  @UseGuards(SuperAdminGuard)
  async getCompanyById(@Param('id') id: string) {
    const company = await this.superAdminService.getCompanyById(id);
    return {
      message: 'Company retrieved successfully',
      data: company,
    };
  }

  // Create Company Admin
  @Post('companies/:id/admins')
  @UseGuards(SuperAdminGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCompanyAdmin(
    @Param('id') companyId: string,
    @Body() createCompanyAdminDto: CreateCompanyAdminDto
  ) {
    try {
      this.logger.log('Creating company admin for company:', companyId);
      this.logger.log('Request body:', createCompanyAdminDto);
      
      // Set company ID from URL parameter
      const adminData = {
        ...createCompanyAdminDto,
        companyId: companyId
      };
      
      const { user, employee } = await this.superAdminService.createCompanyAdmin(adminData);
      return {
        message: 'Company admin created successfully',
        data: {
          user,
          employee
        },
      };
    } catch (error) {
      this.logger.error('Error creating company admin:', error.message);
      throw error;
    }
  }

  // Get Company Admins
  @Get('companies/:id/admins')
  @UseGuards(SuperAdminGuard)
  async getCompanyAdmins(@Param('id') companyId: string) {
    const admins = await this.superAdminService.getCompanyAdmins(companyId);
    return {
      message: 'Company admins retrieved successfully',
      data: admins,
    };
  }
}
