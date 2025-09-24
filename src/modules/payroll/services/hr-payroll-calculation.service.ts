import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Employee } from '../../employees/employees.model';
import { User } from '../../users/users.model';
import { PayComponent } from '../models/pay-components.model';
import { EmployeePayrollRecord, PayrollStatus } from '../models/employee-payroll-record.model';
import { StatutorySettings } from '../models/statutory-settings.model';
import { LeaveService } from '../../leave/leave.service';
import { CalendarService } from '../../leave/calendar.service';
import { EmployeeMonthlyLeaveRecord } from '../../leave/models/employee-monthly-leave-record.model';

export interface PayrollCalculationInput {
  employeeIds: string[];
  month: string; // YYYY-MM
  calculatedBy: string;
  tenantId: string;
}

export interface PayrollCalculationResult {
  success: boolean;
  processed: number;
  failed: number;
  records: EmployeePayrollRecord[];
  errors: string[];
}

@Injectable()
export class HRPayrollCalculationService {
  private readonly logger = new Logger(HRPayrollCalculationService.name);

  constructor(
    @InjectModel(Employee)
    private readonly employeeModel: typeof Employee,
    @InjectModel(PayComponent)
    private readonly payComponentModel: typeof PayComponent,
    @InjectModel(EmployeePayrollRecord)
    private readonly payrollRecordModel: typeof EmployeePayrollRecord,
    @InjectModel(StatutorySettings)
    private readonly statutorySettingsModel: typeof StatutorySettings,
    private readonly leaveService: LeaveService,
    private readonly calendarService: CalendarService,
  ) {}

  async calculatePayrollBatch(input: PayrollCalculationInput): Promise<PayrollCalculationResult> {
    const { employeeIds, month, calculatedBy, tenantId } = input;
    const [year, monthNum] = month.split('-').map(Number);
    
    console.log('🔍 DEBUG - HR Payroll Calculation Input:', {
      employeeIds,
      month,
      calculatedBy,
      tenantId,
      year,
      monthNum,
    });
    
    this.logger.log(`Starting payroll calculation for ${employeeIds.length} employees, month: ${month}`);

    const result: PayrollCalculationResult = {
      success: true,
      processed: 0,
      failed: 0,
      records: [],
      errors: [],
    };

    // Get all active pay components for the tenant
    const payComponents = await this.payComponentModel.findAll({
      where: { tenantId, isActive: true },
    });

    this.logger.log(`Found ${payComponents.length} active pay components`);

    // Process each employee
    for (const employeeId of employeeIds) {
      try {
        console.log(`🔍 DEBUG - Processing employee ${employeeId}`);
        
        const record = await this.calculateEmployeePayroll(
          employeeId,
          month,
          year,
          payComponents,
          calculatedBy,
          tenantId,
        );
        
        console.log(`✅ DEBUG - Successfully processed employee ${employeeId}:`, {
          recordId: record.id,
          netSalary: record.netSalary,
          status: record.status,
        });
        
        result.records.push(record);
        result.processed++;
      } catch (error) {
        console.error(`❌ DEBUG - Failed to calculate payroll for employee ${employeeId}:`, error);
        this.logger.error(`Failed to calculate payroll for employee ${employeeId}:`, error);
        result.errors.push(`Employee ${employeeId}: ${error.message}`);
        result.failed++;
      }
    }

    result.success = result.failed === 0;
    this.logger.log(`Payroll calculation completed. Processed: ${result.processed}, Failed: ${result.failed}`);
    
    return result;
  }

  private async calculateEmployeePayroll(
    employeeId: string,
    month: string,
    year: number,
    payComponents: PayComponent[],
    calculatedBy: string,
    tenantId: string,
  ): Promise<EmployeePayrollRecord> {
    console.log(`🔍 DEBUG - calculateEmployeePayroll called with:`, {
      employeeId,
      month,
      year,
      calculatedBy,
      tenantId,
    });
    
    // 1. Get employee details
    const employee = await this.employeeModel.findOne({
      where: { id: employeeId, tenantId },
    });

    console.log(`🔍 DEBUG - Employee lookup result:`, {
      found: !!employee,
      employeeId: employee?.id,
      employeeName: employee?.name,
      employeeStringId: employee?.employeeId,
    });

    if (!employee) {
      throw new NotFoundException(`Employee not found: ${employeeId}`);
    }

    if (!employee.salary) {
      throw new Error(`Employee ${employee.name} has no base salary configured`);
    }

    // 2. Get working days from calendar/admin settings (fetch from backend)
    const workingDays = await this.getWorkingDaysForMonth(month, year, tenantId);
    
    console.log(`🔍 DEBUG - Working days for ${month}:`, workingDays);

    // 3. Get paid days directly from stored monthly leave records table
    const storedPaidDays = await this.leaveService.getStoredPaidDays(employee.employeeId, month);
    
    if (storedPaidDays <= 0) {
      // No stored data found - employee hasn't used Leave Balance feature yet
      throw new Error(`No paid days data found for ${employee.name} in ${month}. Employee must visit Leave Balance tab first to calculate and save monthly records.`);
    }

    // Use stored paid days from employee_monthly_leave_records table
    const finalPaidDays = storedPaidDays;
    const finalUnpaidDays = Math.max(0, workingDays - finalPaidDays);
    
    console.log(`✅ DEBUG - Using stored paid days from employee_monthly_leave_records table:`, {
      employeeId: employee.employeeId,
      employeeName: employee.name,
      month,
      storedPaidDays,
      finalPaidDays,
      finalUnpaidDays,
      workingDays,
      source: 'employee_monthly_leave_records table (calculated by Leave Balance UI)',
    });

    this.logger.log(`Employee ${employee.name}: Working Days: ${workingDays}, Paid Days: ${finalPaidDays}, Unpaid Days: ${finalUnpaidDays}`);

    // 4. Initialize salary calculation variables
    const baseSalary = Number(employee.salary);
    const allowances: Record<string, number> = {};
    const deductions: Record<string, number> = {};
    let totalDeductions = 0;

    // 4. Calculate pro-rated base salary based on actual paid days
    const proRatedBaseSalary = (baseSalary / workingDays) * finalPaidDays;
    
    console.log(`🔍 DEBUG - Complete salary calculation for ${employee.name}:`, {
      baseSalary,
      workingDays,
      finalPaidDays,
      finalUnpaidDays,
      proRatedBaseSalary: Math.round(proRatedBaseSalary * 100) / 100,
      formula: `(${baseSalary} / ${workingDays}) × ${finalPaidDays} = ${Math.round(proRatedBaseSalary * 100) / 100}`,
      paidDaysSource: 'Stored from employee_monthly_leave_records table',
    });

    // 5. Set allowances to 0 by default (as per user requirement)
    const proRatedAllowances = 0;
    // Note: Allowances are set to 0 by default for all employees
    
    console.log(`🔍 DEBUG - Allowances set to 0 for ${employee.name} (default policy)`);

    // 6. Calculate gross salary (pro-rated base + allowances = pro-rated base only)
    const grossSalary = proRatedBaseSalary + proRatedAllowances;
    
    // 7. Calculate deductions (PF, ESI, etc.) based on gross salary
    for (const component of payComponents) {
      if (component.type === 'DEDUCTION') {
        const componentValue = this.calculateComponentValue(component, grossSalary);
        const componentKey = component.name.toLowerCase().replace(/\s+/g, '_');
        deductions[componentKey] = componentValue;
        totalDeductions += componentValue;
      }
    }

    // 8. Get statutory settings (PF, ESI, etc.) from admin configuration
    const statutoryDeductions = await this.getStatutoryDeductions(grossSalary, tenantId);
    Object.assign(deductions, statutoryDeductions.deductions);
    totalDeductions += statutoryDeductions.total;
    
    // 9. Calculate final amounts
    const lwpDeduction = 0; // Already calculated in pro-rated salary
    const finalTotalDeductions = totalDeductions;
    const netSalary = grossSalary - finalTotalDeductions;

    this.logger.log(`Employee ${employee.name} calculation:`, {
      originalBaseSalary: baseSalary,
      proRatedBaseSalary: Math.round(proRatedBaseSalary * 100) / 100,
      proRatedAllowances,
      grossSalary: Math.round(grossSalary * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100,
      lwpDeduction,
      finalTotalDeductions: Math.round(finalTotalDeductions * 100) / 100,
      netSalary: Math.round(netSalary * 100) / 100,
    });

    // 6. Check if record already exists
    console.log(`🔍 DEBUG - Checking for existing payroll record:`, {
      employeeId,
      month,
      year,
      tenantId,
    });
    
    const existingRecord = await this.payrollRecordModel.findOne({
      where: { employeeId, month, year, tenantId },
    });

    console.log(`🔍 DEBUG - Existing record found:`, !!existingRecord);

    if (existingRecord) {
      console.log(`🔍 DEBUG - Updating existing record with calculatedBy:`, calculatedBy);
      
      // Update existing record
      await existingRecord.update({
        baseSalary: proRatedBaseSalary, // Use pro-rated base salary
        allowances,
        grossSalary,
        deductions,
        lwpDeduction,
        totalDeductions: finalTotalDeductions,
        netSalary,
        workingDays,
        paidDays: finalPaidDays,
        unpaidDays: finalUnpaidDays,
        status: PayrollStatus.CALCULATED,
        calculatedBy,
        calculatedAt: new Date(),
      });
      return existingRecord;
    } else {
      console.log(`🔍 DEBUG - Creating new payroll record with:`, {
        tenantId,
        employeeId,
        month,
        year,
        calculatedBy,
        baseSalary,
        netSalary,
      });
      
      // Create new record
      const newRecord = await this.payrollRecordModel.create({
        tenantId,
        employeeId,
        month,
        year,
        baseSalary: proRatedBaseSalary, // Use pro-rated base salary
        allowances,
        grossSalary,
        deductions,
        lwpDeduction,
        totalDeductions: finalTotalDeductions,
        netSalary,
        workingDays,
        paidDays: finalPaidDays,
        unpaidDays: finalUnpaidDays,
        status: PayrollStatus.CALCULATED,
        calculatedBy,
        calculatedAt: new Date(),
      });
      return newRecord;
    }
  }

  private calculateComponentValue(component: PayComponent, baseSalary: number): number {
    switch (component.calculationMethod) {
      case 'FIXED':
        return Number(component.value);
      
      case 'PERCENTAGE_OF_BASIC':
        return (baseSalary * Number(component.value)) / 100;
      
      case 'PERCENTAGE_OF_CTC':
        // For now, using baseSalary as CTC. You can enhance this later
        return (baseSalary * Number(component.value)) / 100;
      
      default:
        return Number(component.value);
    }
  }

  async getPayrollRecords(month: string, tenantId: string): Promise<EmployeePayrollRecord[]> {
    return this.payrollRecordModel.findAll({
      where: { month, tenantId },
      include: [
        {
          model: Employee,
          attributes: ['id', 'employeeId', 'name', 'department', 'designation'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  async getPayrollSummary(month: string, tenantId: string) {
    const records = await this.getPayrollRecords(month, tenantId);
    
    const summary = {
      totalEmployees: records.length,
      totalGrossSalary: records.reduce((sum, r) => sum + Number(r.grossSalary), 0),
      totalDeductions: records.reduce((sum, r) => sum + Number(r.totalDeductions), 0),
      totalNetSalary: records.reduce((sum, r) => sum + Number(r.netSalary), 0),
      statusBreakdown: {
        draft: records.filter(r => r.status === PayrollStatus.DRAFT).length,
        calculated: records.filter(r => r.status === PayrollStatus.CALCULATED).length,
        approved: records.filter(r => r.status === PayrollStatus.HR_APPROVED).length,
        processed: records.filter(r => r.status === PayrollStatus.PROCESSED).length,
      },
    };

    return summary;
  }

  // Helper method to get working days for a month (from calendar/admin settings)
  private async getWorkingDaysForMonth(month: string, year: number, tenantId: string): Promise<number> {
    try {
      // Use the existing CalendarService to get working days
      const result = await this.calendarService.workingDays(month, tenantId);
      
      console.log(`🔍 DEBUG - Working days from CalendarService for ${month}:`, result);
      
      return result.workingDays;
    } catch (error) {
      console.error(`❌ ERROR - Failed to get working days for ${month}:`, error);
      
      // Fallback: calculate basic working days (weekdays only)
      const daysInMonth = new Date(year, parseInt(month.split('-')[1]), 0).getDate();
      const firstDay = new Date(year, parseInt(month.split('-')[1]) - 1, 1);
      
      let workingDays = 0;
      for (let i = 0; i < daysInMonth; i++) {
        const currentDay = new Date(firstDay);
        currentDay.setDate(firstDay.getDate() + i);
        const dayOfWeek = currentDay.getDay();
        
        // Count weekdays (Monday to Friday)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          workingDays++;
        }
      }
      
      console.log(`🔍 DEBUG - Fallback working days for ${month}: ${workingDays}`);
      return workingDays;
    }
  }

  // Helper method to get statutory deductions (PF, ESI, etc.) from admin-configured settings
  private async getStatutoryDeductions(grossSalary: number, tenantId: string): Promise<{
    deductions: Record<string, number>;
    total: number;
  }> {
    console.log(`🚀 STATUTORY DEDUCTIONS CALCULATION STARTED:`, {
      grossSalary: `₹${grossSalary}`,
      tenantId: tenantId,
      method: 'getStatutoryDeductions',
      purpose: 'Calculate PF, ESI, Professional Tax using admin-configured settings'
    });

    const deductions: Record<string, number> = {};
    let total = 0;

    try {
      // Fetch admin-configured statutory settings from database
      const statutorySettings = await this.statutorySettingsModel.findOne({
        where: { tenantId, isActive: true },
      });

      if (statutorySettings) {
        console.log(`✅ DEBUG - ADMIN STATUTORY SETTINGS LOADED for tenant ${tenantId}:`, {
          pfMinimumSalary: statutorySettings.pfMinimumSalary,
          pfEmployeeRate: statutorySettings.pfEmployeeRate,
          esiMinimumSalary: statutorySettings.esiMinimumSalary,
          esiEmployeeRate: statutorySettings.esiEmployeeRate,
          professionalTaxAmount: statutorySettings.professionalTaxAmount,
          professionalTaxMinimumSalary: statutorySettings.professionalTaxMinimumSalary,
          tdsExemptionLimit: statutorySettings.tdsExemptionLimit,
          source: 'DYNAMIC - Admin configured via Tax & Compliance UI'
        });

        console.log(`🔍 DEBUG - STARTING CALCULATIONS for gross salary ₹${grossSalary}:`);

        // PF (Provident Fund) - Admin configured rate and minimum salary
        const pfMinSalary = Number(statutorySettings.pfMinimumSalary);
        const pfRate = Number(statutorySettings.pfEmployeeRate);
        const pfApplicable = grossSalary > pfMinSalary;
        
        console.log(`💰 PF CALCULATION:`, {
          grossSalary: `₹${grossSalary}`,
          pfApplicableAbove: `₹${pfMinSalary} (admin configured)`,
          pfEmployeeRate: `${pfRate}% (admin configured)`,
          pfApplicable: pfApplicable ? 'YES' : 'NO',
          reason: pfApplicable ? `₹${grossSalary} > ₹${pfMinSalary}` : `₹${grossSalary} ≤ ₹${pfMinSalary}`
        });

        if (pfApplicable) {
          const pfDeduction = Math.round((grossSalary * (pfRate / 100)) * 100) / 100;
          console.log(`💰 PF DEDUCTION:`, {
            calculation: `₹${grossSalary} × ${pfRate}% = ₹${pfDeduction}`,
            pfDeduction: `₹${pfDeduction}`
          });
          deductions['pf'] = pfDeduction;
          total += pfDeduction;
        } else {
          console.log(`💰 PF DEDUCTION: ₹0 (salary is below PF threshold)`);
          deductions['pf'] = 0;
        }

        // ESI (Employee State Insurance) - Admin configured rate and minimum salary
        const esiMinSalary = Number(statutorySettings.esiMinimumSalary);
        const esiRate = Number(statutorySettings.esiEmployeeRate);
        const esiApplicable = grossSalary <= esiMinSalary;
        
        console.log(`🏥 ESI CALCULATION:`, {
          grossSalary: `₹${grossSalary}`,
          esiApplicableUpTo: `₹${esiMinSalary} (admin configured)`,
          esiEmployeeRate: `${esiRate}% (admin configured)`,
          esiApplicable: esiApplicable ? 'YES' : 'NO',
          reason: esiApplicable ? `₹${grossSalary} ≤ ₹${esiMinSalary}` : `₹${grossSalary} > ₹${esiMinSalary}`
        });

        if (esiApplicable) {
          const esiDeduction = Math.round((grossSalary * (esiRate / 100)) * 100) / 100;
          console.log(`🏥 ESI DEDUCTION:`, {
            calculation: `₹${grossSalary} × ${esiRate}% = ₹${esiDeduction}`,
            esiDeduction: `₹${esiDeduction}`
          });
          deductions['esi'] = esiDeduction;
          total += esiDeduction;
        } else {
          console.log(`🏥 ESI DEDUCTION: ₹0 (salary exceeds ESI limit)`);
          deductions['esi'] = 0;
        }

        // Professional Tax - Admin configured amount and minimum salary
        const ptAmount = Number(statutorySettings.professionalTaxAmount);
        const ptMinSalary = Number(statutorySettings.professionalTaxMinimumSalary);
        const ptApplicable = grossSalary > ptMinSalary;
        
        console.log(`📊 PROFESSIONAL TAX CALCULATION:`, {
          grossSalary: `₹${grossSalary}`,
          professionalTaxAmount: `₹${ptAmount} (admin configured)`,
          professionalTaxMinSalary: `₹${ptMinSalary} (admin configured)`,
          ptApplicable: ptApplicable ? 'YES' : 'NO',
          reason: ptApplicable ? `₹${grossSalary} > ₹${ptMinSalary}` : `₹${grossSalary} ≤ ₹${ptMinSalary}`
        });

        if (ptApplicable) {
          console.log(`📊 PROFESSIONAL TAX DEDUCTION: ₹${ptAmount} (fixed amount)`);
          deductions['professional_tax'] = ptAmount;
          total += ptAmount;
        } else {
          console.log(`📊 PROFESSIONAL TAX DEDUCTION: ₹0 (salary below minimum threshold)`);
          deductions['professional_tax'] = 0;
        }

        console.log(`📋 FINAL STATUTORY DEDUCTIONS SUMMARY:`, {
          grossSalary: `₹${grossSalary}`,
          pfDeduction: `₹${deductions['pf'] || 0}`,
          esiDeduction: `₹${deductions['esi'] || 0}`,
          professionalTax: `₹${deductions['professional_tax'] || 0}`,
          totalStatutoryDeductions: `₹${Math.round(total * 100) / 100}`,
          source: 'DYNAMIC - Admin configured via Tax & Compliance UI',
          configuredBy: 'Admin through frontend interface'
        });

      } else {
        // No admin settings found - use 0 for all statutory deductions
        console.log(`⚠️ DEBUG - No admin statutory settings found for tenant ${tenantId}, setting all statutory deductions to 0`);
        
        deductions['pf'] = 0;
        deductions['esi'] = 0;
        deductions['professional_tax'] = 0;
        total = 0;

        console.log(`⚠️ DEBUG - Applied zero statutory deductions for gross salary ₹${grossSalary}:`, {
          deductions,
          total: 0,
          source: 'No admin settings - using zero values',
        });
      }

    } catch (error) {
      console.error(`❌ ERROR - Failed to fetch statutory settings for tenant ${tenantId}:`, error);
      
      // Use zero values on database error
      deductions['pf'] = 0;
      deductions['esi'] = 0;
      deductions['professional_tax'] = 0;
      total = 0;

      console.log(`❌ DEBUG - Database error occurred, setting all statutory deductions to 0:`, {
        deductions,
        total: 0,
        source: 'Database error - using zero values',
      });
    }

    return {
      deductions,
      total: Math.round(total * 100) / 100,
    };
  }

  // Note: Removed old complex calculation methods since we now use stored paid days directly from employee_monthly_leave_records table
}
