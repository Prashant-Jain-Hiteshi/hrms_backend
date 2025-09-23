import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../../common/decorators/tenant.decorator';
import { UserRole } from '../../users/user-role.enum';
import { PayrollSetupService } from '../services/payroll-setup.service';
import {
  CreatePayComponentDto,
  UpdatePayComponentDto,
  CreateCompanyBankAccountDto,
  UpdateCompanyBankAccountDto,
  CreateSalaryTemplateDto,
  UpdateSalaryTemplateDto,
  UpdateStatutorySettingsDto,
  PayrollTestCalculationDto,
} from '../dto/payroll-setup.dto';
import { UpdateCompanyPayrollInfoDto } from '../dto/company-payroll-info.dto';

@ApiTags('payroll-setup')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('payroll-setup')
export class PayrollSetupController {
  constructor(private readonly payrollSetupService: PayrollSetupService) {}

  // Pay Components Endpoints
  @Post('components')
  @ApiOperation({ summary: 'Create a new pay component (Admin only)' })
  @ApiResponse({ status: 201, description: 'Pay component created successfully' })
  @ApiResponse({ status: 409, description: 'Pay component already exists' })
  async createPayComponent(
    @TenantId() tenantId: string,
    @Body() dto: CreatePayComponentDto,
  ) {
    return this.payrollSetupService.createPayComponent(tenantId, dto);
  }

  @Get('components')
  @ApiOperation({ summary: 'Get all pay components (Admin only)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Pay components retrieved successfully' })
  async getPayComponents(
    @TenantId() tenantId: string,
    @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive = false,
  ) {
    return this.payrollSetupService.getPayComponents(tenantId, includeInactive);
  }

  @Get('components/:id')
  @ApiOperation({ summary: 'Get a pay component by ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'Pay component ID' })
  @ApiResponse({ status: 200, description: 'Pay component retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Pay component not found' })
  async getPayComponent(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.payrollSetupService.getPayComponent(tenantId, id);
  }

  @Put('components/:id')
  @ApiOperation({ summary: 'Update a pay component (Admin only)' })
  @ApiParam({ name: 'id', description: 'Pay component ID' })
  @ApiResponse({ status: 200, description: 'Pay component updated successfully' })
  @ApiResponse({ status: 404, description: 'Pay component not found' })
  @ApiResponse({ status: 409, description: 'Pay component name already exists' })
  async updatePayComponent(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePayComponentDto,
  ) {
    return this.payrollSetupService.updatePayComponent(tenantId, id, dto);
  }

  @Delete('components/:id')
  @ApiOperation({ summary: 'Delete a pay component (Admin only)' })
  @ApiParam({ name: 'id', description: 'Pay component ID' })
  @ApiResponse({ status: 200, description: 'Pay component deleted successfully' })
  @ApiResponse({ status: 404, description: 'Pay component not found' })
  @ApiResponse({ status: 409, description: 'Pay component is used in salary templates' })
  async deletePayComponent(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.payrollSetupService.deletePayComponent(tenantId, id);
  }

  // Company Bank Accounts Endpoints
  @Post('bank-accounts')
  @ApiOperation({ summary: 'Create a new company bank account (Admin only)' })
  @ApiResponse({ status: 201, description: 'Bank account created successfully' })
  async createCompanyBankAccount(
    @TenantId() tenantId: string,
    @Body() dto: CreateCompanyBankAccountDto,
  ) {
    return this.payrollSetupService.createCompanyBankAccount(tenantId, dto);
  }

  @Get('bank-accounts')
  @ApiOperation({ summary: 'Get all company bank accounts (Admin only)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Bank accounts retrieved successfully' })
  async getCompanyBankAccounts(
    @TenantId() tenantId: string,
    @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive = false,
  ) {
    return this.payrollSetupService.getCompanyBankAccounts(tenantId, includeInactive);
  }

  @Get('bank-accounts/:id')
  @ApiOperation({ summary: 'Get a bank account by ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'Bank account ID' })
  @ApiResponse({ status: 200, description: 'Bank account retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Bank account not found' })
  async getCompanyBankAccount(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.payrollSetupService.getCompanyBankAccount(tenantId, id);
  }

  @Put('bank-accounts/:id')
  @ApiOperation({ summary: 'Update a bank account (Admin only)' })
  @ApiParam({ name: 'id', description: 'Bank account ID' })
  @ApiResponse({ status: 200, description: 'Bank account updated successfully' })
  @ApiResponse({ status: 404, description: 'Bank account not found' })
  async updateCompanyBankAccount(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyBankAccountDto,
  ) {
    return this.payrollSetupService.updateCompanyBankAccount(tenantId, id, dto);
  }

  @Delete('bank-accounts/:id')
  @ApiOperation({ summary: 'Delete a bank account (Admin only)' })
  @ApiParam({ name: 'id', description: 'Bank account ID' })
  @ApiResponse({ status: 200, description: 'Bank account deleted successfully' })
  @ApiResponse({ status: 404, description: 'Bank account not found' })
  async deleteCompanyBankAccount(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.payrollSetupService.deleteCompanyBankAccount(tenantId, id);
  }

  // Salary Templates Endpoints
  @Post('salary-templates')
  @ApiOperation({ summary: 'Create a new salary template (Admin only)' })
  @ApiResponse({ status: 201, description: 'Salary template created successfully' })
  @ApiResponse({ status: 409, description: 'Salary template already exists' })
  @ApiResponse({ status: 400, description: 'Invalid components provided' })
  async createSalaryTemplate(
    @TenantId() tenantId: string,
    @Body() dto: CreateSalaryTemplateDto,
  ) {
    return this.payrollSetupService.createSalaryTemplate(tenantId, dto);
  }

  @Get('salary-templates')
  @ApiOperation({ summary: 'Get all salary templates (Admin only)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Salary templates retrieved successfully' })
  async getSalaryTemplates(
    @TenantId() tenantId: string,
    @Query('includeInactive', new ParseBoolPipe({ optional: true })) includeInactive = false,
  ) {
    return this.payrollSetupService.getSalaryTemplates(tenantId, includeInactive);
  }

  @Get('salary-templates/:id')
  @ApiOperation({ summary: 'Get a salary template by ID (Admin only)' })
  @ApiParam({ name: 'id', description: 'Salary template ID' })
  @ApiResponse({ status: 200, description: 'Salary template retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Salary template not found' })
  async getSalaryTemplate(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.payrollSetupService.getSalaryTemplate(tenantId, id);
  }

  @Put('salary-templates/:id')
  @ApiOperation({ summary: 'Update a salary template (Admin only)' })
  @ApiParam({ name: 'id', description: 'Salary template ID' })
  @ApiResponse({ status: 200, description: 'Salary template updated successfully' })
  @ApiResponse({ status: 404, description: 'Salary template not found' })
  @ApiResponse({ status: 409, description: 'Salary template name already exists' })
  @ApiResponse({ status: 400, description: 'Invalid components provided' })
  async updateSalaryTemplate(
    @TenantId() tenantId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSalaryTemplateDto,
  ) {
    return this.payrollSetupService.updateSalaryTemplate(tenantId, id, dto);
  }

  @Delete('salary-templates/:id')
  @ApiOperation({ summary: 'Delete a salary template (Admin only)' })
  @ApiParam({ name: 'id', description: 'Salary template ID' })
  @ApiResponse({ status: 200, description: 'Salary template deleted successfully' })
  @ApiResponse({ status: 404, description: 'Salary template not found' })
  async deleteSalaryTemplate(
    @TenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.payrollSetupService.deleteSalaryTemplate(tenantId, id);
  }

  // Statutory Settings Endpoints
  @Get('statutory-settings')
  @ApiOperation({ summary: 'Get statutory settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Statutory settings retrieved successfully' })
  async getStatutorySettings(@TenantId() tenantId: string) {
    return this.payrollSetupService.getStatutorySettings(tenantId);
  }

  @Put('statutory-settings')
  @ApiOperation({ summary: 'Update statutory settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Statutory settings updated successfully' })
  async updateStatutorySettings(
    @TenantId() tenantId: string,
    @Body() dto: UpdateStatutorySettingsDto,
  ) {
    return this.payrollSetupService.updateStatutorySettings(tenantId, dto);
  }

  // Company Payroll Info Endpoints
  @Get('company-info')
  @ApiOperation({ summary: 'Get company payroll information (Admin only)' })
  @ApiResponse({ status: 200, description: 'Company payroll info retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Company payroll info not found' })
  async getCompanyPayrollInfo(
    @TenantId() tenantId: string,
  ) {
    console.log('🎯 CONTROLLER - GET company-info called');
    console.log('🎯 CONTROLLER - tenantId from decorator:', tenantId);
    
    try {
      const result = await this.payrollSetupService.getCompanyPayrollInfo(tenantId);
      console.log('✅ CONTROLLER - GET company-info success');
      return result;
    } catch (error) {
      console.error('❌ CONTROLLER - GET company-info error:', error);
      throw error;
    }
  }

  @Put('company-info')
  @ApiOperation({ summary: 'Update company payroll information (Admin only)' })
  @ApiResponse({ status: 200, description: 'Company payroll info updated successfully' })
  @ApiResponse({ status: 404, description: 'Company not found' })
  async updateCompanyPayrollInfo(
    @TenantId() tenantId: string,
    @Body() dto: UpdateCompanyPayrollInfoDto,
  ) {
    console.log('🎯 CONTROLLER - PUT company-info called');
    console.log('🎯 CONTROLLER - tenantId from decorator:', tenantId);
    console.log('🎯 CONTROLLER - request body:', JSON.stringify(dto, null, 2));
    
    try {
      const result = await this.payrollSetupService.updateCompanyPayrollInfo(tenantId, dto);
      console.log('✅ CONTROLLER - PUT company-info success');
      return result;
    } catch (error) {
      console.error('❌ CONTROLLER - PUT company-info error:', error);
      throw error;
    }
  }

  // Payroll Test Calculation Endpoint
  @Post('test-calculation')
  @ApiOperation({ summary: 'Test payroll calculation (Admin only)' })
  @ApiResponse({ status: 200, description: 'Payroll calculation completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid calculation parameters' })
  async testPayrollCalculation(
    @TenantId() tenantId: string,
    @Body() dto: PayrollTestCalculationDto,
  ) {
    return this.payrollSetupService.calculatePayrollTest(tenantId, dto);
  }
}
