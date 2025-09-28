import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Employee } from '../../employees/employees.model';
import { User } from '../../users/users.model';
import { PayComponent } from '../models/pay-components.model';
import { EmployeePayrollRecord, PayrollStatus, PayrollApproval, EmployeeBankDetails } from '../models/employee-payroll-record.model';
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
    @InjectModel(PayrollApproval)
    private readonly payrollApprovalModel: typeof PayrollApproval,
    @InjectModel(EmployeeBankDetails)
    private readonly employeeBankDetailsModel: typeof EmployeeBankDetails,
    private readonly leaveService: LeaveService,
    private readonly calendarService: CalendarService,
    private readonly sequelize: Sequelize,
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
    
    let finalPaidDays: number;
    let finalUnpaidDays: number;
    
    if (storedPaidDays <= 0) {
      // No stored data found - use default values (0 paid days)
      console.log(`⚠️  WARNING - No paid days data found for ${employee.name} in ${month}. Using default 0 paid days.`);
      finalPaidDays = 0; // Default to 0 paid days
      finalUnpaidDays = workingDays; // All days are unpaid
    } else {
      // Use stored paid days from employee_monthly_leave_records table
      finalPaidDays = storedPaidDays;
      finalUnpaidDays = Math.max(0, workingDays - finalPaidDays);
    }
    
    console.log(`✅ DEBUG - Paid days calculation result:`, {
      employeeId: employee.employeeId,
      employeeName: employee.name,
      month,
      storedPaidDays,
      finalPaidDays,
      finalUnpaidDays,
      workingDays,
      source: storedPaidDays > 0 ? 'employee_monthly_leave_records table (calculated by Leave Balance UI)' : 'default values (0 paid days)',
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

    // 5. Calculate allowances from pay components (EARNING type)
    let totalAllowances = 0;
    
    console.log(`🔍 DEBUG - Pay components available for ${employee.name}:`, {
      totalComponents: payComponents.length,
      components: payComponents.map(c => ({ name: c.name, type: c.type, value: c.value, calculationMethod: c.calculationMethod }))
    });
    
    for (const component of payComponents) {
      if (component.type === 'EARNING') {
        const componentValue = this.calculateComponentValue(component, proRatedBaseSalary);
        const componentKey = component.name.toLowerCase().replace(/\s+/g, '_');
        allowances[componentKey] = componentValue;
        totalAllowances += componentValue;
        
        console.log(`💰 EARNING component added:`, {
          name: component.name,
          key: componentKey,
          value: componentValue,
          calculationMethod: component.calculationMethod,
          baseSalary: proRatedBaseSalary
        });
      }
    }
    
    console.log(`🔍 DEBUG - Final allowances calculated for ${employee.name}:`, {
      allowances,
      totalAllowances,
      source: 'Pay components configuration',
      isEmpty: Object.keys(allowances).length === 0
    });

    // 6. Calculate gross salary (pro-rated base + total allowances)
    let grossSalary = proRatedBaseSalary + totalAllowances;
    
    // Note: Allowances start empty and are added by HR through the Adjust modal in the UI
    // This follows the same pattern as deductions - HR can add allowances as needed
    if (totalAllowances === 0 && Object.keys(allowances).length === 0) {
      console.log(`📝 INFO - No initial allowances for ${employee.name}. HR can add allowances via Adjust modal.`, {
        proRatedBaseSalary,
        totalAllowances,
        grossSalary,
        note: 'Allowances can be added through UI adjustment feature'
      });
    }
    
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

    // 10. Detailed calculation breakdown for verification
    console.log(`📊 DETAILED SALARY CALCULATION FOR ${employee.name}:`, {
      step1_baseSalary: `₹${baseSalary}`,
      step2_proRatedBaseSalary: `₹${Math.round(proRatedBaseSalary * 100) / 100}`,
      step3_allowancesBreakdown: allowances,
      step4_totalAllowances: `₹${Math.round(totalAllowances * 100) / 100}`,
      step5_grossSalary: `₹${Math.round(grossSalary * 100) / 100} (${Math.round(proRatedBaseSalary * 100) / 100} + ${Math.round(totalAllowances * 100) / 100})`,
      step6_deductionsBreakdown: deductions,
      step7_totalDeductions: `₹${Math.round(finalTotalDeductions * 100) / 100}`,
      step8_netSalary: `₹${Math.round(netSalary * 100) / 100} (${Math.round(grossSalary * 100) / 100} - ${Math.round(finalTotalDeductions * 100) / 100})`,
      verification: `${Math.round(proRatedBaseSalary * 100) / 100} + ${Math.round(totalAllowances * 100) / 100} - ${Math.round(finalTotalDeductions * 100) / 100} = ${Math.round(netSalary * 100) / 100}`
    });

    this.logger.log(`Employee ${employee.name} calculation:`, {
      originalBaseSalary: baseSalary,
      proRatedBaseSalary: Math.round(proRatedBaseSalary * 100) / 100,
      totalAllowances: Math.round(totalAllowances * 100) / 100,
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
        totalAllowances,
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
        totalAllowances,
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

    return { deductions, total: Math.round(total * 100) / 100 };
  }

  // Adjust payroll record without creating new table - use existing JSON fields
  async adjustPayroll(recordId: string, adjustmentData: {
    adjustmentType: 'ALLOWANCE' | 'DEDUCTION';
    adjustmentName: string;
    amount: number;
    reason?: string;
  }, tenantId: string): Promise<any> {
    console.log(`🔧 PAYROLL ADJUSTMENT STARTED:`, {
      recordId,
      adjustmentData,
      tenantId,
      method: 'adjustPayroll'
    });

    try {
      // Find the payroll record
      const payrollRecord = await this.payrollRecordModel.findOne({
        where: { id: recordId, tenantId },
        include: [{ model: this.employeeModel, as: 'employee' }]
      });

      if (!payrollRecord) {
        throw new Error(`Payroll record not found: ${recordId}`);
      }

      console.log(`✅ PAYROLL RECORD FOUND:`, {
        employeeId: payrollRecord.employeeId,
        month: payrollRecord.month,
        year: payrollRecord.year,
        currentNetSalary: payrollRecord.netSalary,
        currentAllowances: payrollRecord.allowances,
        currentDeductions: payrollRecord.deductions
      });

      // Parse existing allowances and deductions
      const currentAllowances = payrollRecord.allowances as Record<string, number> || {};
      const currentDeductions = payrollRecord.deductions as Record<string, number> || {};

      const adjustmentAmount = Number(adjustmentData.amount);

      if (adjustmentData.adjustmentType === 'ALLOWANCE') {
        // Add to allowances
        const allowanceKey = adjustmentData.adjustmentName.toLowerCase().replace(/\s+/g, '_');
        currentAllowances[allowanceKey] = adjustmentAmount;
        
        console.log(`💰 ALLOWANCE ADJUSTMENT:`, {
          originalName: adjustmentData.adjustmentName,
          allowanceKey: allowanceKey,
          amount: `₹${adjustmentAmount}`,
          reason: adjustmentData.reason || 'No reason provided',
          currentAllowancesBefore: JSON.stringify(payrollRecord.allowances),
          currentAllowancesAfter: JSON.stringify(currentAllowances)
        });

      } else if (adjustmentData.adjustmentType === 'DEDUCTION') {
        // Add to deductions
        const deductionKey = adjustmentData.adjustmentName.toLowerCase().replace(/\s+/g, '_');
        currentDeductions[deductionKey] = adjustmentAmount;
        
        console.log(`💸 DEDUCTION ADJUSTMENT:`, {
          originalName: adjustmentData.adjustmentName,
          deductionKey: deductionKey,
          amount: `₹${adjustmentAmount}`,
          reason: adjustmentData.reason || 'No reason provided',
          currentDeductionsBefore: JSON.stringify(payrollRecord.deductions),
          currentDeductionsAfter: JSON.stringify(currentDeductions)
        });
      }

      // Recalculate totals from all components
      const newTotalAllowances = Object.values(currentAllowances).reduce((sum: number, amount) => sum + Number(amount), 0);
      const newTotalDeductions = Object.values(currentDeductions).reduce((sum: number, amount) => sum + Number(amount), 0);
      
      // Recalculate gross and net salary properly
      const baseSalary = Number(payrollRecord.baseSalary || 0);
      const newGrossSalary = baseSalary + newTotalAllowances;
      const newNetSalary = newGrossSalary - newTotalDeductions;

      console.log(`🧮 SALARY RECALCULATION:`, {
        baseSalary: `₹${baseSalary}`,
        totalAllowances: `₹${newTotalAllowances}`,
        grossSalary: `₹${newGrossSalary}`,
        totalDeductions: `₹${newTotalDeductions}`,
        netSalary: `₹${newNetSalary}`,
        calculation: `₹${baseSalary} + ₹${newTotalAllowances} - ₹${newTotalDeductions} = ₹${newNetSalary}`
      });

      // Update the payroll record with all recalculated values
      console.log(`🔄 DATABASE UPDATE ATTEMPT:`, {
        recordId,
        allowancesToUpdate: JSON.stringify(currentAllowances),
        deductionsToUpdate: JSON.stringify(currentDeductions),
        newGrossSalary: Math.round(newGrossSalary * 100) / 100,
        newTotalDeductions: Math.round(newTotalDeductions * 100) / 100,
        newNetSalary: Math.round(newNetSalary * 100) / 100
      });

      // Force JSON field updates by setting them explicitly and marking as changed
      payrollRecord.allowances = currentAllowances;
      payrollRecord.deductions = currentDeductions;
      payrollRecord.totalAllowances = Math.round(newTotalAllowances * 100) / 100;
      payrollRecord.grossSalary = Math.round(newGrossSalary * 100) / 100;
      payrollRecord.totalDeductions = Math.round(newTotalDeductions * 100) / 100;
      payrollRecord.netSalary = Math.round(newNetSalary * 100) / 100;
      
      // Explicitly mark JSON fields as changed to force Sequelize to update them
      payrollRecord.changed('allowances', true);
      payrollRecord.changed('deductions', true);
      
      console.log(`🔍 BEFORE SAVE - Changed fields:`, payrollRecord.changed());
      
      // Save the record
      await payrollRecord.save();
      
      console.log(`🔍 AFTER SAVE - Record state:`, {
        allowances: payrollRecord.allowances,
        deductions: payrollRecord.deductions,
        grossSalary: payrollRecord.grossSalary,
        netSalary: payrollRecord.netSalary
      });

      console.log(`✅ DATABASE UPDATE COMPLETED:`, {
        recordId,
        finalAllowances: JSON.stringify(payrollRecord.allowances),
        finalDeductions: JSON.stringify(payrollRecord.deductions)
      });

      console.log(`✅ PAYROLL ADJUSTMENT COMPLETED:`, {
        recordId,
        adjustmentType: adjustmentData.adjustmentType,
        adjustmentName: adjustmentData.adjustmentName,
        adjustmentAmount: `₹${adjustmentAmount}`,
        oldNetSalary: `₹${payrollRecord.netSalary}`,
        newNetSalary: `₹${Math.round(newNetSalary * 100) / 100}`,
        updatedAllowances: currentAllowances,
        updatedDeductions: currentDeductions,
        newTotalDeductions: `₹${newTotalDeductions}`
      });

      return {
        success: true,
        message: 'Payroll adjusted successfully',
        recordId,
        adjustmentType: adjustmentData.adjustmentType,
        adjustmentName: adjustmentData.adjustmentName,
        adjustmentAmount: adjustmentAmount,
        oldNetSalary: Number(payrollRecord.netSalary),
        newNetSalary: Math.round(newNetSalary * 100) / 100,
        updatedRecord: {
          allowances: currentAllowances,
          deductions: currentDeductions,
          grossSalary: Math.round(newGrossSalary * 100) / 100,
          totalDeductions: Math.round(newTotalDeductions * 100) / 100,
          netSalary: Math.round(newNetSalary * 100) / 100
        }
      };

    } catch (error: any) {
      console.error(`❌ PAYROLL ADJUSTMENT FAILED:`, {
        recordId,
        adjustmentData,
        error: error.message
      });
      throw error;
    }
  }

  // Get employees eligible for payroll calculation for specific month
  async getEligibleEmployees(month: string, tenantId: string): Promise<any[]> {
    console.log(`🔍 GETTING ELIGIBLE EMPLOYEES:`, {
      month,
      tenantId,
      method: 'getEligibleEmployees'
    });

    try {
      // Parse the month (format: YYYY-MM)
      const [year, monthNum] = month.split('-');
      const payrollDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1); // First day of payroll month
      
      console.log(`📅 PAYROLL DATE FILTER:`, {
        inputMonth: month,
        payrollDate: payrollDate.toISOString(),
        filterLogic: 'joiningDate <= payrollDate'
      });

      // Get employees who joined on or before the payroll month
      const eligibleEmployees = await this.employeeModel.findAll({
        where: {
          tenantId,
          status: 'active',
          department:"Engineering",
          joiningDate: {
            [Op.lte]: payrollDate // Joining date <= payroll month
          }
        },
        attributes: [
          'id',
          'employeeId', 
          'name',
          'department',
          'designation',
          'salary',
          'joiningDate'
        ],
        order: [['name', 'ASC']]
      });

      console.log(`✅ ELIGIBLE EMPLOYEES FOUND:`, {
        totalCount: eligibleEmployees.length,
        employees: eligibleEmployees.map(emp => ({
          name: emp.name,
          joiningDate: emp.joiningDate,
          eligible: new Date(emp.joiningDate) <= payrollDate
        }))
      });

      return eligibleEmployees;

    } catch (error) {
      console.error(`❌ ERROR GETTING ELIGIBLE EMPLOYEES:`, error);
      throw new Error(`Failed to get eligible employees: ${error.message}`);
    }
  }

  // Bulk approve payroll records
  async bulkApprovePayroll(payrollRecordIds: string[], approvalNotes: string, approverId: string, tenantId: string): Promise<any> {
    console.log(`🔍 BULK APPROVE PAYROLL:`, {
      payrollRecordIds,
      approvalNotes,
      approverId,
      tenantId,
      recordCount: payrollRecordIds.length
    });

    try {
      // 1. Validate that all records exist and are in CALCULATED status
      const records = await this.payrollRecordModel.findAll({
        where: {
          id: payrollRecordIds,
          tenantId,
          status: PayrollStatus.CALCULATED // Only approve CALCULATED records
        },
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['name', 'employeeId']
          }
        ]
      });

      if (records.length === 0) {
        throw new Error('No eligible records found for approval. Records must be in CALCULATED status.');
      }

      if (records.length !== payrollRecordIds.length) {
        const foundIds = records.map(r => r.id);
        const missingIds = payrollRecordIds.filter(id => !foundIds.includes(id));
        console.log(`⚠️  WARNING - Some records not found or not eligible:`, {
          requestedCount: payrollRecordIds.length,
          foundCount: records.length,
          missingIds
        });
      }

      // 2. Update all eligible records to HR_APPROVED status
      const approvalTime = new Date();
      const updateResults = await Promise.all(
        records.map(async (record) => {
          try {
            await record.update({
              status: PayrollStatus.HR_APPROVED,
              approvedBy: approverId,
              approvedAt: approvalTime
            });

            console.log(`✅ APPROVED:`, {
              recordId: record.id,
              employeeName: record.employee?.name,
              employeeId: record.employee?.employeeId,
              previousStatus: PayrollStatus.CALCULATED,
              newStatus: PayrollStatus.HR_APPROVED,
              approvedBy: approverId,
              approvedAt: approvalTime
            });

            return {
              success: true,
              recordId: record.id,
              employeeName: record.employee?.name,
              employeeId: record.employee?.employeeId
            };
          } catch (error) {
            console.error(`❌ FAILED TO APPROVE RECORD ${record.id}:`, error);
            return {
              success: false,
              recordId: record.id,
              employeeName: record.employee?.name,
              employeeId: record.employee?.employeeId,
              error: error.message
            };
          }
        })
      );

      // 3. Prepare response summary
      const successful = updateResults.filter(r => r.success);
      const failed = updateResults.filter(r => !r.success);

      const result = {
        message: `Bulk approval completed`,
        summary: {
          requested: payrollRecordIds.length,
          eligible: records.length,
          successful: successful.length,
          failed: failed.length
        },
        approvalDetails: {
          approvedBy: approverId,
          approvedAt: approvalTime,
          approvalNotes: approvalNotes || 'Bulk approved by HR'
        },
        results: {
          successful: successful.map(r => ({
            recordId: r.recordId,
            employeeName: r.employeeName,
            employeeId: r.employeeId,
            status: 'APPROVED'
          })),
          failed: failed.map(r => ({
            recordId: r.recordId,
            employeeName: r.employeeName,
            employeeId: r.employeeId,
            error: r.error
          }))
        }
      };

      console.log(`✅ BULK APPROVAL COMPLETED:`, result.summary);
      return result;

    } catch (error) {
      console.error(`❌ BULK APPROVAL FAILED:`, {
        payrollRecordIds,
        error: error.message
      });
      throw new Error(`Bulk approval failed: ${error.message}`);
    }
  }

  // Get dashboard summary for HR overview
  async getDashboardSummary(month: string, tenantId: string): Promise<any> {
    console.log(`🔍 DASHBOARD SUMMARY:`, { month, tenantId });

    try {
      const records = await this.payrollRecordModel.findAll({
        where: { month, tenantId },
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['name', 'department', 'employeeId']
          }
        ]
      });

      console.log(`📊 Found ${records.length} payroll records for dashboard`);

      const totalPayroll = records.reduce((sum, r) => sum + Number(r.netSalary || 0), 0);
      const employeesPaid = records.filter(r => 
        r.status === 'HR_APPROVED' || r.status === 'PROCESSED'
      ).length;
      const totalEmployees = records.length;
      const avgSalary = totalEmployees > 0 ? totalPayroll / totalEmployees : 0;

      const summary = {
        totalPayroll: Math.round(totalPayroll),
        employeesPaid,
        totalEmployees,
        avgSalary: Math.round(avgSalary),
        pendingReimbursements: 1250, // Mock data as requested
        pendingReimbursementCount: 5 // Mock data as requested
      };

      console.log(`✅ Dashboard summary:`, summary);
      return summary;

    } catch (error) {
      console.error(`❌ ERROR GETTING DASHBOARD SUMMARY:`, error);
      throw new Error(`Failed to get dashboard summary: ${error.message}`);
    }
  }

  // Get department breakdown for salary distribution
  async getDepartmentBreakdown(month: string, tenantId: string): Promise<any> {
    console.log(`🔍 DEPARTMENT BREAKDOWN:`, { month, tenantId });

    try {
      const records = await this.payrollRecordModel.findAll({
        where: { month, tenantId },
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['department']
          }
        ]
      });

      console.log(`📊 Found ${records.length} records for department breakdown`);

      // Group by department
      const departmentTotals: { [key: string]: number } = {};
      const departmentCounts: { [key: string]: number } = {};
      let totalPayroll = 0;

      records.forEach(record => {
        const dept = record.employee?.department || 'Unknown';
        const salary = Number(record.netSalary || 0);
        
        if (!departmentTotals[dept]) {
          departmentTotals[dept] = 0;
          departmentCounts[dept] = 0;
        }
        
        departmentTotals[dept] += salary;
        departmentCounts[dept] += 1;
        totalPayroll += salary;
      });

      // Convert to array with percentages
      const departments = Object.keys(departmentTotals).map(dept => ({
        department: dept,
        amount: Math.round(departmentTotals[dept]),
        percentage: totalPayroll > 0 ? Math.round((departmentTotals[dept] / totalPayroll) * 100) : 0,
        employeeCount: departmentCounts[dept]
      }));

      // Sort by amount descending
      departments.sort((a, b) => b.amount - a.amount);

      console.log(`✅ Department breakdown:`, departments);
      return { departments };

    } catch (error) {
      console.error(`❌ ERROR GETTING DEPARTMENT BREAKDOWN:`, error);
      throw new Error(`Failed to get department breakdown: ${error.message}`);
    }
  }

  // Finance Approval Methods
  async financeApprovePayroll(
    recordId: string,
    approverId: string,
    approvalNotes: string,
    tenantId: string
  ): Promise<any> {
    console.log(`🔍 FINANCE APPROVE PAYROLL:`, { recordId, approverId, tenantId });

    try {
      const record = await this.payrollRecordModel.findOne({
        where: { id: recordId, tenantId },
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['name', 'employeeId']
          }
        ]
      });

      if (!record) {
        throw new Error('Payroll record not found');
      }

      if (record.status !== 'HR_APPROVED') {
        throw new Error('Only HR-approved payroll can be approved by Finance');
      }

      // Update record with Finance approval
      await record.update({
        status: 'FINANCE_APPROVED',
        financeApprovedBy: approverId,
        financeApprovedAt: new Date(),
        financeApprovalNotes: approvalNotes,
        paymentStatus: 'PENDING'
      });

      // Create approval record
      await this.payrollApprovalModel.create({
        tenantId,
        payrollRecordId: recordId,
        approvedBy: approverId,
        approvalStatus: 'APPROVED',
        approvalNotes: `Finance approval: ${approvalNotes}`,
        approvedAt: new Date()
      });

      // AUTO-CREATE BANK DETAILS FOR APPROVED PAYROLL (NEW)
      await this.createBankDetailsForApprovedPayroll(record, tenantId);

      console.log(`✅ Finance approved payroll for ${record.employee?.name}`);
      
      return {
        success: true,
        message: `Payroll approved for ${record.employee?.name}`,
        record: {
          id: record.id,
          employeeName: record.employee?.name,
          status: record.status,
          netSalary: record.netSalary
        }
      };

    } catch (error) {
      console.error(`❌ ERROR FINANCE APPROVING PAYROLL:`, error);
      throw new Error(`Failed to approve payroll: ${error.message}`);
    }
  }

  async financeBulkApprovePayroll(
    recordIds: string[],
    approverId: string,
    approvalNotes: string,
    tenantId: string
  ): Promise<any> {
    console.log(`🔍 FINANCE BULK APPROVE PAYROLL:`, { recordIds, approverId, tenantId });

    try {
      const records = await this.payrollRecordModel.findAll({
        where: { 
          id: recordIds, 
          tenantId,
          status: 'HR_APPROVED' // Only approve HR-approved records
        },
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['name', 'employeeId']
          }
        ]
      });

      if (records.length === 0) {
        throw new Error('No HR-approved payroll records found for bulk approval');
      }

      const results = {
        successful: 0,
        failed: 0,
        details: [] as any[]
      };

      // Process each record
      for (const record of records) {
        try {
          // Update record with Finance approval
          await record.update({
            status: 'FINANCE_APPROVED',
            financeApprovedBy: approverId,
            financeApprovedAt: new Date(),
            financeApprovalNotes: approvalNotes,
            paymentStatus: 'PENDING'
          });

          // Create approval record
          await this.payrollApprovalModel.create({
            tenantId,
            payrollRecordId: record.id,
            approvedBy: approverId,
            approvalStatus: 'APPROVED',
            approvalNotes: `Finance bulk approval: ${approvalNotes}`,
            approvedAt: new Date()
          });

          results.successful++;
          results.details.push({
            id: record.id,
            employeeName: record.employee?.name,
            status: 'success',
            netSalary: record.netSalary
          });

          console.log(`✅ Finance approved payroll for ${record.employee?.name}`);

        } catch (error) {
          results.failed++;
          results.details.push({
            id: record.id,
            employeeName: record.employee?.name,
            status: 'failed',
            error: error.message
          });
          console.error(`❌ Failed to approve payroll for ${record.employee?.name}:`, error);
        }
      }

      console.log(`✅ Finance bulk approval completed:`, results);
      
      return {
        success: true,
        message: `Finance approved ${results.successful} payroll records`,
        summary: results
      };

    } catch (error) {
      console.error(`❌ ERROR FINANCE BULK APPROVING PAYROLL:`, error);
      throw new Error(`Failed to bulk approve payroll: ${error.message}`);
    }
  }

  // Get pending Finance approvals
  async getPendingFinanceApprovals(month: string, tenantId: string): Promise<any> {
    console.log(`🔍 GET PENDING FINANCE APPROVALS:`, { month, tenantId });

    try {
      const records = await this.payrollRecordModel.findAll({
        where: { 
          month, 
          tenantId,
          status: 'HR_APPROVED' // Only HR-approved records pending Finance approval
        },
        include: [
          {
            model: Employee,
            as: 'employee',
            attributes: ['name', 'employeeId', 'department']
          },
          {
            model: User,
            as: 'approver',
            attributes: ['firstName', 'lastName', 'email']
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      console.log(`📊 Found ${records.length} records pending Finance approval`);

      return records.map(record => ({
        id: record.id,
        employee: {
          name: record.employee?.name,
          employeeId: record.employee?.employeeId,
          department: record.employee?.department
        },
        baseSalary: record.baseSalary,
        totalAllowances: record.totalAllowances,
        totalDeductions: record.totalDeductions,
        netSalary: record.netSalary,
        status: record.status,
        hrApprover: record.approver ? `${record.approver.firstName} ${record.approver.lastName}` : null,
        hrApprovedAt: record.approvedAt,
        createdAt: record.createdAt
      }));

    } catch (error) {
      console.error(`❌ ERROR GETTING PENDING FINANCE APPROVALS:`, error);
      throw new Error(`Failed to get pending Finance approvals: ${error.message}`);
    }
  }

  // Bank Transfer Methods - NEW

  // Auto-create bank details when Finance approves payroll
  async createBankDetailsForApprovedPayroll(payrollRecord: any, tenantId: string): Promise<void> {
    console.log(`🏦 Creating bank details for approved payroll:`, payrollRecord.id);

    try {
      // Check if bank details already exist
      const existingBankDetails = await this.employeeBankDetailsModel.findOne({
        where: { payrollRecordId: payrollRecord.id, tenantId }
      });

      if (existingBankDetails) {
        console.log(`✅ Bank details already exist for payroll record:`, payrollRecord.id);
        return;
      }

      // Generate dummy bank details
      const bankDetails = this.generateDummyBankDetails(payrollRecord.employee);

      // Create bank details record
      await this.employeeBankDetailsModel.create({
        tenantId,
        payrollRecordId: payrollRecord.id,
        employeeId: payrollRecord.employeeId,
        transferAmount: payrollRecord.netSalary,
        ...bankDetails
      });

      console.log(`✅ Created bank details for employee:`, payrollRecord.employee?.name);

    } catch (error) {
      console.error(`❌ Error creating bank details:`, error);
      throw new Error(`Failed to create bank details: ${error.message}`);
    }
  }

  // Generate dummy bank details with Indian banks
  private generateDummyBankDetails(employee: any): any {
    const banks = [
      { name: 'State Bank of India', ifsc: 'SBIN0001234' },
      { name: 'HDFC Bank', ifsc: 'HDFC0001234' },
      { name: 'ICICI Bank', ifsc: 'ICIC0001234' },
      { name: 'Axis Bank', ifsc: 'UTIB0001234' },
      { name: 'Punjab National Bank', ifsc: 'PUNB0001234' }
    ];

    const randomBank = banks[Math.floor(Math.random() * banks.length)];
    const accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();

    return {
      bankName: randomBank.name,
      accountNumber,
      accountHolderName: employee?.name || 'Account Holder',
      ifscCode: randomBank.ifsc,
      branchName: 'Main Branch',
      accountType: 'SALARY'
    };
  }

  // Get bank transfer data for Finance
  async getBankTransferData(month: string, tenantId: string): Promise<any> {
    console.log(`🔍 GET BANK TRANSFER DATA:`, { month, tenantId });

    try {
      const bankDetails = await this.employeeBankDetailsModel.findAll({
        where: { tenantId },
        include: [
          {
            model: EmployeePayrollRecord,
            as: 'payrollRecord',
            where: { month, status: 'FINANCE_APPROVED' },
            include: [
              {
                model: Employee,
                as: 'employee',
                attributes: ['name', 'employeeId', 'department']
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      console.log(`📊 Found ${bankDetails.length} bank transfer records`);

      return bankDetails.map(detail => ({
        id: detail.id,
        employee: {
          id: detail.payrollRecord?.employee?.employeeId || '',
          name: detail.payrollRecord?.employee?.name || 'Unknown',
          department: detail.payrollRecord?.employee?.department || 'Unknown'
        },
        bankDetails: {
          bankName: detail.bankName,
          accountNumber: `****${detail.accountNumber.slice(-4)}`, // Masked
          fullAccountNumber: detail.accountNumber, // For backend use
          ifscCode: detail.ifscCode,
          accountHolderName: detail.accountHolderName,
          branchName: detail.branchName
        },
        transferAmount: detail.transferAmount,
        transferStatus: detail.transferStatus,
        transactionId: detail.transactionId,
        transferredAt: detail.transferredAt,
        payrollRecordId: detail.payrollRecordId
      }));

    } catch (error) {
      console.error(`❌ ERROR GETTING BANK TRANSFER DATA:`, error);
      throw new Error(`Failed to get bank transfer data: ${error.message}`);
    }
  }

  // Initiate bank transfers
  async initiateBankTransfer(bankDetailIds: string[], financeUserId: string, tenantId: string): Promise<any> {
    console.log(`🔍 INITIATE BANK TRANSFER:`, { bankDetailIds, financeUserId, tenantId });

    try {
      const results = { successful: 0, failed: 0, details: [] as any[] };

      for (const bankDetailId of bankDetailIds) {
        try {
          const bankDetail = await this.employeeBankDetailsModel.findOne({
            where: { id: bankDetailId, tenantId, transferStatus: 'PENDING' },
            include: [
              {
                model: Employee,
                as: 'employee',
                attributes: ['name', 'employeeId']
              }
            ]
          });

          if (!bankDetail) {
            results.failed++;
            results.details.push({
              id: bankDetailId,
              status: 'failed',
              error: 'Bank detail not found or not in PENDING status'
            });
            continue;
          }

          // Generate transaction ID
          const transactionId = `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;

          // Update to PROCESSING status
          await bankDetail.update({
            transferStatus: 'PROCESSING',
            transactionId,
            transferredBy: financeUserId
          });

          // Simulate processing delay and success/failure (95% success rate)
          setTimeout(async () => {
            const isSuccess = Math.random() > 0.05;
            
            await bankDetail.update({
              transferStatus: isSuccess ? 'COMPLETED' : 'FAILED',
              transferredAt: isSuccess ? new Date() : null
            });
          }, 2000 + Math.random() * 1000); // 2-3 second delay

          results.successful++;
          results.details.push({
            id: bankDetailId,
            employeeName: bankDetail.employee?.name,
            status: 'initiated',
            transactionId,
            transferAmount: bankDetail.transferAmount
          });

          console.log(`✅ Initiated transfer for ${bankDetail.employee?.name}: ${transactionId}`);

        } catch (error) {
          results.failed++;
          results.details.push({
            id: bankDetailId,
            status: 'failed',
            error: error.message
          });
          console.error(`❌ Failed to initiate transfer for ${bankDetailId}:`, error);
        }
      }

      console.log(`✅ Bank transfer initiation completed:`, results);
      return {
        success: true,
        message: `Initiated ${results.successful} transfers successfully`,
        summary: results
      };

    } catch (error) {
      console.error(`❌ ERROR INITIATING BANK TRANSFER:`, error);
      throw new Error(`Failed to initiate bank transfer: ${error.message}`);
    }
  }

  // Get company bank account for transfers
  async getCompanyBankAccount(tenantId: string): Promise<any> {
    console.log(`🔍 GET COMPANY BANK ACCOUNT:`, { tenantId });

    try {
      // Get the default/primary company bank account
      const companyBankAccount = await this.sequelize.query(`
        SELECT 
          cba.id,
          cba."bankName",
          cba."branchName", 
          cba."accountNumber",
          cba."ifscCode",
          cba."accountHolderName",
          cba."isDefault",
          c.name as "companyName"
        FROM company_bank_accounts cba
        LEFT JOIN companies c ON c.id = cba."tenantId"
        WHERE cba."tenantId" = :tenantId 
          AND cba."isActive" = true
        ORDER BY cba."isDefault" DESC, cba."createdAt" ASC
        LIMIT 1
      `, {
        replacements: { tenantId },
        type: QueryTypes.SELECT
      });

      if (!companyBankAccount || companyBankAccount.length === 0) {
        // Return default company bank account if none configured
        return {
          bankName: 'State Bank of India',
          branchName: 'Corporate Branch',
          accountNumber: '1234567890',
          ifscCode: 'SBIN0001234',
          accountHolderName: 'Company Name Pvt Ltd',
          companyName: 'Company Name Pvt Ltd'
        };
      }

      console.log(`✅ Company bank account found:`, companyBankAccount[0]);
      return companyBankAccount[0];

    } catch (error) {
      console.error(`❌ ERROR GETTING COMPANY BANK ACCOUNT:`, error);
      throw new Error(`Failed to get company bank account: ${error.message}`);
    }
  }

  // Get bank transfer summary
  async getBankTransferSummary(month: string, tenantId: string): Promise<any> {
    console.log(`🔍 GET BANK TRANSFER SUMMARY:`, { month, tenantId });

    try {
      // Simplified approach to avoid sequelize type issues
      const bankDetails = await this.employeeBankDetailsModel.findAll({
        where: { tenantId },
        include: [
          {
            model: EmployeePayrollRecord,
            as: 'payrollRecord',
            where: { month, status: 'FINANCE_APPROVED' }
          }
        ]
      });

      // Calculate summary manually
      const result = {
        totalEmployees: 0,
        totalAmount: 0,
        pending: { count: 0, amount: 0 },
        processing: { count: 0, amount: 0 },
        completed: { count: 0, amount: 0 },
        failed: { count: 0, amount: 0 }
      };

      bankDetails.forEach(detail => {
        const status = detail.transferStatus.toLowerCase();
        const amount = parseFloat(detail.transferAmount?.toString() || '0');

        result.totalEmployees++;
        result.totalAmount += amount;

        switch (status) {
          case 'pending':
            result.pending.count++;
            result.pending.amount += amount;
            break;
          case 'processing':
            result.processing.count++;
            result.processing.amount += amount;
            break;
          case 'completed':
            result.completed.count++;
            result.completed.amount += amount;
            break;
          case 'failed':
            result.failed.count++;
            result.failed.amount += amount;
            break;
        }
      });

      console.log(`📊 Bank transfer summary:`, result);
      return result;

    } catch (error) {
      console.error(`❌ ERROR GETTING BANK TRANSFER SUMMARY:`, error);
      throw new Error(`Failed to get bank transfer summary: ${error.message}`);
    }
  }

  // Get bank transfer receipt details
  async getBankTransferReceipt(bankDetailId: string, tenantId: string): Promise<any> {
    console.log(`🔍 GET BANK TRANSFER RECEIPT:`, { bankDetailId, tenantId });

    try {
      // Get bank transfer details with all related information
      const bankDetail = await this.employeeBankDetailsModel.findOne({
        where: { id: bankDetailId, tenantId },
        include: [
          {
            model: EmployeePayrollRecord,
            as: 'payrollRecord',
            include: [
              {
                model: Employee,
                as: 'employee',
                attributes: ['id', 'employeeId', 'name', 'email', 'department', 'designation']
              }
            ]
          }
        ]
      });

      if (!bankDetail) {
        throw new NotFoundException('Bank transfer record not found');
      }

      // Get company bank account details
      const companyBankAccount = await this.getCompanyBankAccount(tenantId);

      // Format the receipt data
      const receipt = {
        // Transfer Information
        transferId: bankDetail.transactionId,
        transferDate: bankDetail.transferredAt,
        transferStatus: bankDetail.transferStatus,
        processingDate: bankDetail.updatedAt,
        month: bankDetail.payrollRecord?.month,

        // Employee Information
        employee: {
          id: bankDetail.payrollRecord?.employee?.employeeId,
          name: bankDetail.payrollRecord?.employee?.name,
          email: bankDetail.payrollRecord?.employee?.email,
          department: bankDetail.payrollRecord?.employee?.department,
          designation: bankDetail.payrollRecord?.employee?.designation
        },

        // Salary Details
        salary: {
          basicSalary: bankDetail.payrollRecord?.baseSalary,
          allowances: bankDetail.payrollRecord?.totalAllowances,
          deductions: bankDetail.payrollRecord?.totalDeductions,
          allowancesBreakdown: bankDetail.payrollRecord?.allowances,
          deductionsBreakdown: bankDetail.payrollRecord?.deductions,
          grossSalary: bankDetail.payrollRecord?.grossSalary,
          netSalary: bankDetail.payrollRecord?.netSalary,
          workingDays: bankDetail.payrollRecord?.workingDays,
          paidDays: bankDetail.payrollRecord?.paidDays,
          lwpDays: bankDetail.payrollRecord?.unpaidDays || 0
        },

        // Employee Bank Details (Recipient)
        recipientBank: {
          bankName: bankDetail.bankName,
          accountNumber: bankDetail.accountNumber,
          ifscCode: bankDetail.ifscCode,
          accountHolderName: bankDetail.accountHolderName,
          branchName: bankDetail.branchName || 'N/A'
        },

        // Company Bank Details (Sender)
        senderBank: {
          bankName: companyBankAccount.bankName,
          accountNumber: companyBankAccount.accountNumber,
          ifscCode: companyBankAccount.ifscCode,
          accountHolderName: companyBankAccount.accountHolderName,
          branchName: companyBankAccount.branchName,
          companyName: companyBankAccount.companyName
        },

        // Transfer Details
        transferAmount: bankDetail.transferAmount,
        transferMethod: 'NEFT', // Default transfer method
        transferFees: 0, // No fees for now
        remarks: `Salary transfer for ${bankDetail.payrollRecord?.month || 'N/A'}`,

        // Receipt Metadata
        generatedAt: new Date().toISOString(),
        receiptNumber: `RCP${bankDetail.transactionId}${Date.now().toString().slice(-4)}`
      };

      console.log(`✅ Bank transfer receipt generated:`, receipt);
      return receipt;

    } catch (error) {
      console.error(`❌ ERROR GETTING BANK TRANSFER RECEIPT:`, error);
      throw new Error(`Failed to get bank transfer receipt: ${error.message}`);
    }
  }

  // Employee-specific methods for payslip access
  async getEmployeePayslips(employeeId: string, tenantId: string, month?: string): Promise<any> {
    console.log(`🔍 GET EMPLOYEE PAYSLIPS:`, { employeeId, tenantId, month });

    try {
      // Build where condition
      const whereCondition: any = {
        tenantId,
        status: 'FINANCE_APPROVED' // Only show completed payslips to employees
      };

      if (month) {
        whereCondition.month = month;
      }

      // Get employee's payroll records
      const payrollRecords = await this.payrollRecordModel.findAll({
        where: whereCondition,
        include: [
          {
            model: Employee,
            as: 'employee',
            where: { employeeId: employeeId },
            attributes: ['id', 'employeeId', 'name', 'email', 'department', 'designation']
          },
        ],
        order: [['month', 'DESC']]
      });

      console.log(`📊 Found ${payrollRecords.length} payroll records for employee ${employeeId}`);

      return payrollRecords.map(record => ({
        id: record.id,
        payrollMonth: record.month,
        employee: {
          id: record.employee?.employeeId,
          name: record.employee?.name,
          department: record.employee?.department,
          designation: record.employee?.designation,
          email: record.employee?.email
        },
        salary: {
          baseSalary: record.baseSalary,
          totalAllowances: record.totalAllowances,
          totalDeductions: record.totalDeductions,
          grossSalary: record.grossSalary,
          netSalary: record.netSalary,
          workingDays: record.workingDays,
          paidDays: record.paidDays,
          unpaidDays: record.unpaidDays
        },
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      }));

    } catch (error) {
      console.error(`❌ ERROR GETTING EMPLOYEE PAYSLIPS:`, error);
      throw new Error(`Failed to get employee payslips: ${error.message}`);
    }
  }

  async getEmployeePayslipReceipt(payrollRecordId: string, employeeId: string, tenantId: string): Promise<any> {
    console.log(`🔍 GET EMPLOYEE PAYSLIP RECEIPT:`, { payrollRecordId, employeeId, tenantId });

    try {
      // Get payroll record with all related information, ensuring it belongs to the requesting employee
      const payrollRecord = await this.payrollRecordModel.findOne({
        where: { 
          id: payrollRecordId, 
          tenantId,
          status: 'FINANCE_APPROVED' // Only show completed payslips
        },
        include: [
          {
            model: Employee,
            as: 'employee',
            where: { employeeId: employeeId }, // Ensure record belongs to requesting employee
            attributes: ['id', 'employeeId', 'name', 'email', 'department', 'designation']
          },
        ]
      });

      if (!payrollRecord) {
        throw new NotFoundException('Payslip record not found or access denied');
      }

      // Get company bank account details
      const companyBankAccount = await this.getCompanyBankAccount(tenantId);

      // Format the receipt data similar to bank transfer receipt
      const receipt = {
        // Transfer Information
        transferId: `EMP-${payrollRecord.id}`,
        transferDate: payrollRecord.updatedAt,
        transferStatus: 'COMPLETED',
        processingDate: payrollRecord.updatedAt,
        month: payrollRecord.month,
        transferMethod: 'NEFT',

        // Employee Information
        employee: {
          id: payrollRecord.employee?.employeeId,
          name: payrollRecord.employee?.name,
          email: payrollRecord.employee?.email,
          department: payrollRecord.employee?.department,
          designation: payrollRecord.employee?.designation
        },

        // Salary Details
        salary: {
          basicSalary: payrollRecord.baseSalary,
          allowances: payrollRecord.totalAllowances,
          deductions: payrollRecord.totalDeductions,
          allowancesBreakdown: payrollRecord.allowances,
          deductionsBreakdown: payrollRecord.deductions,
          grossSalary: payrollRecord.grossSalary,
          netSalary: payrollRecord.netSalary,
          workingDays: payrollRecord.workingDays,
          paidDays: payrollRecord.paidDays,
          lwpDays: payrollRecord.unpaidDays || 0
        },

        // Employee Bank Details (Recipient)
        recipientBank: {
          bankName: 'Employee Bank',
          accountNumber: '****3412',
          ifscCode: 'UTIB0001234',
          accountHolderName: payrollRecord.employee?.name || 'Employee',
          branchName: 'Main Branch'
        },

        // Company Bank Details (Sender)
        senderBank: {
          bankName: companyBankAccount.bankName,
          accountNumber: companyBankAccount.accountNumber,
          ifscCode: companyBankAccount.ifscCode,
          accountHolderName: companyBankAccount.accountHolderName,
          branchName: companyBankAccount.branchName,
          companyName: companyBankAccount.companyName
        },

        // Transfer Details
        transferAmount: payrollRecord.netSalary,
        transferFees: 0,
        remarks: `Salary transfer for ${payrollRecord.month}`,

        // Receipt Metadata
        generatedAt: new Date().toISOString(),
        receiptNumber: `EMP${payrollRecord.id}${payrollRecord.month?.replace('-', '') || ''}`
      };

      console.log(`✅ Employee payslip receipt generated:`, receipt);
      return receipt;

    } catch (error) {
      console.error(`❌ ERROR GETTING EMPLOYEE PAYSLIP RECEIPT:`, error);
      throw new Error(`Failed to get employee payslip receipt: ${error.message}`);
    }
  }

  // Generate bank transfer report data
  async generateBankTransferReport(month: string, status: string, tenantId: string): Promise<any> {
    console.log(`🔍 GENERATE BANK TRANSFER REPORT:`, { month, status, tenantId });

    try {
      // Build where clause for filtering
      const whereClause: any = { tenantId };
      
      if (status && status !== 'ALL') {
        whereClause.transferStatus = status;
      }

      // Get bank transfer data with all related information
      const bankTransfers = await this.employeeBankDetailsModel.findAll({
        where: whereClause,
        include: [
          {
            model: EmployeePayrollRecord,
            as: 'payrollRecord',
            where: { month },
            include: [
              {
                model: Employee,
                as: 'employee',
                attributes: ['id', 'employeeId', 'name', 'email', 'department', 'designation']
              }
            ]
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Format data for report
      const reportData = bankTransfers.map(transfer => ({
        employeeId: transfer.payrollRecord?.employee?.employeeId || 'N/A',
        employeeName: transfer.payrollRecord?.employee?.name || 'N/A',
        department: transfer.payrollRecord?.employee?.department || 'N/A',
        designation: transfer.payrollRecord?.employee?.designation || 'N/A',
        netSalary: Number(transfer.payrollRecord?.netSalary || 0),
        bankName: transfer.bankName,
        accountNumber: transfer.accountNumber,
        ifscCode: transfer.ifscCode,
        accountHolderName: transfer.accountHolderName,
        transferStatus: transfer.transferStatus,
        transferDate: transfer.transferredAt ? new Date(transfer.transferredAt).toLocaleDateString() : 'N/A',
        transactionId: transfer.transactionId || 'N/A',
        processedDate: transfer.updatedAt ? new Date(transfer.updatedAt).toLocaleDateString() : 'N/A',
        transferAmount: Number(transfer.transferAmount || 0),
        month: month
      }));

      // Calculate summary statistics
      const summary = {
        totalEmployees: reportData.length,
        totalAmount: reportData.reduce((sum, record) => sum + record.transferAmount, 0),
        statusBreakdown: {
          PENDING: reportData.filter(r => r.transferStatus === 'PENDING').length,
          PROCESSING: reportData.filter(r => r.transferStatus === 'PROCESSING').length,
          COMPLETED: reportData.filter(r => r.transferStatus === 'COMPLETED').length,
          FAILED: reportData.filter(r => r.transferStatus === 'FAILED').length
        },
        generatedAt: new Date().toISOString(),
        month: month,
        statusFilter: status
      };

      console.log(`✅ Bank transfer report generated:`, { 
        recordCount: reportData.length, 
        summary 
      });

      return {
        data: reportData,
        summary: summary,
        metadata: {
          reportType: 'Bank Transfer Report',
          month: month,
          statusFilter: status,
          generatedBy: 'Finance',
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(`❌ ERROR GENERATING BANK TRANSFER REPORT:`, error);
      throw new Error(`Failed to generate bank transfer report: ${error.message}`);
    }
  }
}
