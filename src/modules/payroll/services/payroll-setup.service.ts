import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { PayComponent } from '../models/pay-components.model';
import { CompanyBankAccount } from '../models/company-bank-accounts.model';
import { SalaryTemplate, SalaryTemplateComponent } from '../models/salary-templates.model';
import { StatutorySettings } from '../models/statutory-settings.model';
import { CompanyPayrollInfo } from '../models/company-payroll-info.model';
import { Company } from '../../companies/companies.model';
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

@Injectable()
export class PayrollSetupService {
  constructor(
    @InjectModel(PayComponent)
    private readonly payComponentModel: typeof PayComponent,
    @InjectModel(CompanyBankAccount)
    private readonly companyBankAccountModel: typeof CompanyBankAccount,
    @InjectModel(SalaryTemplate)
    private readonly salaryTemplateModel: typeof SalaryTemplate,
    @InjectModel(SalaryTemplateComponent)
    private readonly salaryTemplateComponentModel: typeof SalaryTemplateComponent,
    @InjectModel(StatutorySettings)
    private readonly statutorySettingsModel: typeof StatutorySettings,
    @InjectModel(CompanyPayrollInfo)
    private readonly companyPayrollInfoModel: typeof CompanyPayrollInfo,
    @InjectModel(Company)
    private readonly companyModel: typeof Company,
    private readonly sequelize: Sequelize,
  ) {}

  // Pay Components CRUD
  async createPayComponent(tenantId: string, dto: CreatePayComponentDto) {
    try {
      // Check for duplicate component name within tenant
      const existingComponent = await this.payComponentModel.findOne({
        where: { tenantId, name: dto.name, isActive: true },
      });

      if (existingComponent) {
        throw new ConflictException(`Pay component '${dto.name}' already exists`);
      }

      const component = await this.payComponentModel.create({
        ...dto,
        tenantId,
      });

      return component;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new BadRequestException('Failed to create pay component');
    }
  }

  async getPayComponents(tenantId: string, includeInactive = false) {
    const whereClause: any = { tenantId };
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    return await this.payComponentModel.findAll({
      where: whereClause,
      order: [['type', 'ASC'], ['name', 'ASC']],
    });
  }

  async getPayComponent(tenantId: string, id: string) {
    const component = await this.payComponentModel.findOne({
      where: { id, tenantId },
    });

    if (!component) {
      throw new NotFoundException('Pay component not found');
    }

    return component;
  }

  async updatePayComponent(tenantId: string, id: string, dto: UpdatePayComponentDto) {
    const component = await this.getPayComponent(tenantId, id);

    // Check for duplicate name if name is being updated
    if (dto.name && dto.name !== component.name) {
      const existingComponent = await this.payComponentModel.findOne({
        where: { tenantId, name: dto.name, isActive: true, id: { [Op.ne]: id } },
      });

      if (existingComponent) {
        throw new ConflictException(`Pay component '${dto.name}' already exists`);
      }
    }

    await component.update(dto);
    return component;
  }

  async deletePayComponent(tenantId: string, id: string) {
    const component = await this.getPayComponent(tenantId, id);

    // Check if component is used in any salary templates
    const templatesUsingComponent = await this.salaryTemplateComponentModel.count({
      where: { componentId: id },
    });

    if (templatesUsingComponent > 0) {
      throw new ConflictException('Cannot delete component that is used in salary templates');
    }

    await component.update({ isActive: false });
    return { message: 'Pay component deleted successfully' };
  }

  // Company Bank Accounts CRUD
  async createCompanyBankAccount(tenantId: string, dto: CreateCompanyBankAccountDto) {
    return await this.sequelize.transaction(async (transaction: Transaction) => {
      // If this is set as default, unset other defaults
      if (dto.isDefault) {
        await this.companyBankAccountModel.update(
          { isDefault: false },
          { where: { tenantId, isActive: true }, transaction }
        );
      }

      const bankAccount = await this.companyBankAccountModel.create(
        { ...dto, tenantId },
        { transaction }
      );

      return bankAccount;
    });
  }

  async getCompanyBankAccounts(tenantId: string, includeInactive = false) {
    const whereClause: any = { tenantId };
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    return await this.companyBankAccountModel.findAll({
      where: whereClause,
      order: [['isDefault', 'DESC'], ['bankName', 'ASC']],
    });
  }

  async getCompanyBankAccount(tenantId: string, id: string) {
    const bankAccount = await this.companyBankAccountModel.findOne({
      where: { id, tenantId },
    });

    if (!bankAccount) {
      throw new NotFoundException('Bank account not found');
    }

    return bankAccount;
  }

  async updateCompanyBankAccount(tenantId: string, id: string, dto: UpdateCompanyBankAccountDto) {
    return await this.sequelize.transaction(async (transaction: Transaction) => {
      const bankAccount = await this.getCompanyBankAccount(tenantId, id);

      // If setting as default, unset other defaults
      if (dto.isDefault) {
        await this.companyBankAccountModel.update(
          { isDefault: false },
          { where: { tenantId, isActive: true, id: { [Op.ne]: id } }, transaction }
        );
      }

      await bankAccount.update(dto, { transaction });
      return bankAccount;
    });
  }

  async deleteCompanyBankAccount(tenantId: string, id: string) {
    const bankAccount = await this.getCompanyBankAccount(tenantId, id);
    await bankAccount.update({ isActive: false });
    return { message: 'Bank account deleted successfully' };
  }

  // Salary Templates CRUD
  async createSalaryTemplate(tenantId: string, dto: CreateSalaryTemplateDto) {
    return await this.sequelize.transaction(async (transaction: Transaction) => {
      // Check for duplicate template name
      const existingTemplate = await this.salaryTemplateModel.findOne({
        where: { tenantId, templateName: dto.templateName, isActive: true },
      });

      if (existingTemplate) {
        throw new ConflictException(`Salary template '${dto.templateName}' already exists`);
      }

      // Validate that all components exist and belong to the tenant
      const componentIds = dto.components.map(c => c.componentId);
      const validComponents = await this.payComponentModel.findAll({
        where: { id: componentIds, tenantId, isActive: true },
      });

      if (validComponents.length !== componentIds.length) {
        throw new BadRequestException('One or more components are invalid');
      }

      // Create template
      const template = await this.salaryTemplateModel.create(
        {
          templateName: dto.templateName,
          description: dto.description,
          tenantId,
        },
        { transaction }
      );

      // Create template components
      const templateComponents = dto.components.map(component => ({
        templateId: template.id,
        componentId: component.componentId,
        value: component.value,
      }));

      await this.salaryTemplateComponentModel.bulkCreate(templateComponents, { transaction });

      // Return template with components
      return await this.getSalaryTemplate(tenantId, template.id);
    });
  }

  async getSalaryTemplates(tenantId: string, includeInactive = false) {
    const whereClause: any = { tenantId };
    if (!includeInactive) {
      whereClause.isActive = true;
    }

    return await this.salaryTemplateModel.findAll({
      where: whereClause,
      include: [
        {
          model: SalaryTemplateComponent,
          include: [{ model: PayComponent }],
          where: { isActive: true },
          required: false,
        },
      ],
      order: [['templateName', 'ASC']],
    });
  }

  async getSalaryTemplate(tenantId: string, id: string) {
    const template = await this.salaryTemplateModel.findOne({
      where: { id, tenantId },
      include: [
        {
          model: SalaryTemplateComponent,
          include: [{ model: PayComponent }],
          where: { isActive: true },
          required: false,
        },
      ],
    });

    if (!template) {
      throw new NotFoundException('Salary template not found');
    }

    return template;
  }

  async updateSalaryTemplate(tenantId: string, id: string, dto: UpdateSalaryTemplateDto) {
    return await this.sequelize.transaction(async (transaction: Transaction) => {
      const template = await this.getSalaryTemplate(tenantId, id);

      // Check for duplicate name if name is being updated
      if (dto.templateName && dto.templateName !== template.templateName) {
        const existingTemplate = await this.salaryTemplateModel.findOne({
          where: { tenantId, templateName: dto.templateName, isActive: true, id: { [Op.ne]: id } },
        });

        if (existingTemplate) {
          throw new ConflictException(`Salary template '${dto.templateName}' already exists`);
        }
      }

      // Update template basic info
      await template.update({
        templateName: dto.templateName,
        description: dto.description,
        isActive: dto.isActive,
      }, { transaction });

      // Update components if provided
      if (dto.components) {
        // Validate components
        const componentIds = dto.components.map(c => c.componentId);
        const validComponents = await this.payComponentModel.findAll({
          where: { id: componentIds, tenantId, isActive: true },
        });

        if (validComponents.length !== componentIds.length) {
          throw new BadRequestException('One or more components are invalid');
        }

        // Delete existing components
        await this.salaryTemplateComponentModel.update(
          { isActive: false },
          { where: { templateId: id }, transaction }
        );

        // Create new components
        const templateComponents = dto.components.map(component => ({
          templateId: id,
          componentId: component.componentId,
          value: component.value,
        }));

        await this.salaryTemplateComponentModel.bulkCreate(templateComponents, { transaction });
      }

      return await this.getSalaryTemplate(tenantId, id);
    });
  }

  async deleteSalaryTemplate(tenantId: string, id: string) {
    const template = await this.getSalaryTemplate(tenantId, id);
    await template.update({ isActive: false });
    return { message: 'Salary template deleted successfully' };
  }

  // Statutory Settings
  async getStatutorySettings(tenantId: string) {
    let settings = await this.statutorySettingsModel.findOne({
      where: { tenantId, isActive: true },
    });

    // Create default settings if none exist
    if (!settings) {
      settings = await this.statutorySettingsModel.create({ tenantId });
    }

    return settings;
  }

  async updateStatutorySettings(tenantId: string, dto: UpdateStatutorySettingsDto) {
    const settings = await this.getStatutorySettings(tenantId);
    await settings.update(dto);
    return settings;
  }

  // Company Payroll Info (using separate table)
  async getCompanyPayrollInfo(tenantId: string) {
    try {
      console.log('🔍 DEBUG - getCompanyPayrollInfo called with tenantId:', tenantId);
      
      // Find company first to validate
      const company = await this.companyModel.findByPk(tenantId);
      if (!company) {
        console.log('❌ DEBUG - Company not found for tenantId:', tenantId);
        throw new NotFoundException('Company not found');
      }

      // Find or create company payroll info
      let payrollInfo = await this.companyPayrollInfoModel.findOne({
        where: { companyId: tenantId },
        include: [{ model: this.companyModel, as: 'company' }]
      });

      if (!payrollInfo) {
        console.log('🔍 DEBUG - No payroll info found, creating default record');
        payrollInfo = await this.companyPayrollInfoModel.create({
          companyId: tenantId,
          tenantId: tenantId,
          companyName: company.name,
          payrollCycle: 'MONTHLY',
          payrollProcessingDate: 1,
          salaryDisbursementDate: 5
        });
      }

      console.log('✅ DEBUG - Returning payroll info:', {
        companyId: payrollInfo.companyId,
        companyName: payrollInfo.companyName,
        payrollCycle: payrollInfo.payrollCycle
      });
      
      return payrollInfo;
    } catch (error) {
      console.error('❌ DEBUG - Error in getCompanyPayrollInfo:', error);
      throw error;
    }
  }

  async updateCompanyPayrollInfo(tenantId: string, dto: UpdateCompanyPayrollInfoDto) {
    try {
      console.log('🔍 DEBUG - updateCompanyPayrollInfo called');
      console.log('🔍 DEBUG - tenantId:', tenantId);
      console.log('🔍 DEBUG - dto:', JSON.stringify(dto, null, 2));
      
      // Find company first to validate
      const company = await this.companyModel.findByPk(tenantId);
      if (!company) {
        console.log('❌ DEBUG - Company not found for tenantId:', tenantId);
        throw new NotFoundException('Company not found');
      }

      // Find or create company payroll info
      let payrollInfo = await this.companyPayrollInfoModel.findOne({
        where: { companyId: tenantId }
      });

      if (payrollInfo) {
        console.log('🔍 DEBUG - Updating existing payroll info');
        await payrollInfo.update(dto);
      } else {
        console.log('🔍 DEBUG - Creating new payroll info');
        payrollInfo = await this.companyPayrollInfoModel.create({
          companyId: tenantId,
          tenantId: tenantId,
          companyName: company.name,
          payrollCycle: dto.payrollCycle || 'MONTHLY',
          payrollProcessingDate: dto.payrollProcessingDate || 1,
          salaryDisbursementDate: dto.salaryDisbursementDate || 5,
          ...dto
        });
      }
      
      console.log('✅ DEBUG - Payroll info updated successfully');
      
      return payrollInfo;
    } catch (error) {
      console.error('❌ DEBUG - Error in updateCompanyPayrollInfo:', error);
      console.error('❌ DEBUG - Error name:', error.name);
      console.error('❌ DEBUG - Error message:', error.message);
      console.error('❌ DEBUG - Error stack:', error.stack);
      throw error;
    }
  }

  // Payroll Test Calculation
  async calculatePayrollTest(tenantId: string, dto: PayrollTestCalculationDto) {
    try {
      let components: any[] = [];

      if (dto.templateId) {
        // Use template components
        const template = await this.getSalaryTemplate(tenantId, dto.templateId);
        components = template.components.map(tc => ({
          component: tc.component,
          value: tc.value,
        }));
      } else if (dto.components) {
        // Use manual components
        const componentIds = dto.components.map(c => c.componentId);
        const payComponents = await this.payComponentModel.findAll({
          where: { id: componentIds, tenantId, isActive: true },
        });

        components = dto.components.map(c => {
          const component = payComponents.find(pc => pc.id === c.componentId);
          return { component, value: c.value };
        });
      }

      // Get statutory settings
      const statutorySettings = await this.getStatutorySettings(tenantId);

      // Calculate earnings and deductions
      let grossSalary = 0;
      let totalEarnings = 0;
      let totalDeductions = 0;
      const earningsBreakdown: any[] = [];
      const deductionsBreakdown: any[] = [];

      // Process each component
      for (const { component, value } of components) {
        if (!component) continue;

        let calculatedAmount = 0;

        switch (component.calculationMethod) {
          case 'FIXED':
            calculatedAmount = value;
            break;
          case 'PERCENTAGE_OF_BASIC':
            calculatedAmount = (dto.basicSalary * value) / 100;
            break;
          case 'PERCENTAGE_OF_CTC':
            // For CTC percentage, we need to calculate iteratively
            // For simplicity, using basic salary as base
            calculatedAmount = (dto.basicSalary * value) / 100;
            break;
        }

        if (component.type === 'EARNING') {
          totalEarnings += calculatedAmount;
          earningsBreakdown.push({
            name: component.name,
            amount: calculatedAmount,
            taxable: component.taxable,
          });
        } else {
          totalDeductions += calculatedAmount;
          deductionsBreakdown.push({
            name: component.name,
            amount: calculatedAmount,
          });
        }
      }

      grossSalary = totalEarnings;

      // Calculate statutory deductions
      const statutoryDeductions: any[] = [];

      // PF Calculation
      if (grossSalary >= statutorySettings.pfMinimumSalary) {
        const pfAmount = Math.min(
          (dto.basicSalary * statutorySettings.pfEmployeeRate) / 100,
          1800 // Max PF contribution
        );
        statutoryDeductions.push({
          name: 'Provident Fund',
          amount: pfAmount,
        });
        totalDeductions += pfAmount;
      }

      // ESI Calculation
      if (grossSalary <= statutorySettings.esiMinimumSalary) {
        const esiAmount = (grossSalary * statutorySettings.esiEmployeeRate) / 100;
        statutoryDeductions.push({
          name: 'ESI',
          amount: esiAmount,
        });
        totalDeductions += esiAmount;
      }

      // Professional Tax
      if (grossSalary >= statutorySettings.professionalTaxMinimumSalary) {
        statutoryDeductions.push({
          name: 'Professional Tax',
          amount: statutorySettings.professionalTaxAmount,
        });
        totalDeductions += statutorySettings.professionalTaxAmount;
      }

      const netSalary = grossSalary - totalDeductions;

      return {
        basicSalary: dto.basicSalary,
        grossSalary,
        totalEarnings,
        totalDeductions,
        netSalary,
        earningsBreakdown,
        deductionsBreakdown,
        statutoryDeductions,
        calculation: {
          pfApplicable: grossSalary >= statutorySettings.pfMinimumSalary,
          esiApplicable: grossSalary <= statutorySettings.esiMinimumSalary,
          professionalTaxApplicable: grossSalary >= statutorySettings.professionalTaxMinimumSalary,
        },
      };
    } catch (error) {
      throw new BadRequestException('Failed to calculate payroll test');
    }
  }
}
