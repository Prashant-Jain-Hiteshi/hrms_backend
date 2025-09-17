import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Employee } from '../employees/employees.model';
import { Payroll, PayrollStatus } from './payroll.model';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { PayrollCalculationService } from './services/payroll-calculation.service';
import {
  ProcessDynamicPayrollDto,
  PayrollCalculationDto,
  PayrollCalculationResponseDto,
} from './dto/dynamic-payroll.dto';

@Injectable()
export class PayrollService {
  constructor(
    @InjectModel(Payroll)
    private readonly payrollModel: typeof Payroll,
    @InjectModel(Employee)
    private readonly employeeModel: typeof Employee,
    private readonly payrollCalculationService: PayrollCalculationService,
  ) {}

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
    status?: PayrollStatus,
    month?: string,
    year?: string,
  ) {
    const offset = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where['$employee.name$'] = { [Op.iLike]: `%${search}%` };
    }

    if (status) {
      where.status = status;
    }

    if (month && year) {
      const startDate = new Date(Number(year), Number(month) - 1, 1);
      const endDate = new Date(Number(year), Number(month), 0);
      where.payPeriodStart = {
        [Op.gte]: startDate,
        [Op.lte]: endDate,
      };
    }

    const { count, rows } = await this.payrollModel.findAndCountAll({
      where,
      include: [
        {
          model: this.employeeModel,
          attributes: ['id', 'name', 'email', 'department', 'designation'],
        },
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      data: rows,
      pagination: {
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async findOne(id: string) {
    const payroll = await this.payrollModel.findByPk(id, {
      include: [
        {
          model: this.employeeModel,
          attributes: ['id', 'name', 'email', 'department', 'designation'],
        },
      ],
    });

    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }

    return payroll;
  }

  async create(createPayrollDto: CreatePayrollDto) {
    const employee = await this.employeeModel.findByPk(
      createPayrollDto.employeeId,
    );
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.payrollModel.create({
      ...createPayrollDto,
      status: PayrollStatus.PENDING,
    });
  }

  async update(id: string, updatePayrollDto: UpdatePayrollDto) {
    const payroll = await this.payrollModel.findByPk(id);
    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }

    if (updatePayrollDto.employeeId) {
      const employee = await this.employeeModel.findByPk(
        updatePayrollDto.employeeId,
      );
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }
    }

    return payroll.update(updatePayrollDto);
  }

  async remove(id: string) {
    const payroll = await this.payrollModel.findByPk(id);
    if (!payroll) {
      throw new NotFoundException('Payroll record not found');
    }

    await payroll.destroy();
    return { message: 'Payroll record deleted successfully' };
  }

  async processPayroll(
    employeeIds: string[],
    periodStart: Date,
    periodEnd: Date,
  ) {
    const employees = await this.employeeModel.findAll({
      where: { id: employeeIds },
    });

    if (employees.length !== employeeIds.length) {
      throw new NotFoundException('One or more employees not found');
    }

    const payrolls = await Promise.all(
      employees.map(async (employee) => {
        // In a real application, you would calculate allowances, deductions, etc.
        // based on company policies, attendance, leaves, etc.
        const basicSalary = employee.salary || 0;
        const allowances = basicSalary * 0.2; // 20% of basic as allowances
        const deductions = basicSalary * 0.1; // 10% of basic as deductions
        const netSalary = basicSalary + allowances - deductions;

        return this.payrollModel.create({
          employeeId: employee.id,
          payPeriodStart: periodStart,
          payPeriodEnd: periodEnd,
          basicSalary,
          allowances,
          deductions,
          netSalary,
          status: PayrollStatus.PROCESSED,
        });
      }),
    );

    return payrolls;
  }

  // Dynamic payroll calculation methods
  async calculatePayrollForEmployee(
    dto: PayrollCalculationDto,
  ): Promise<PayrollCalculationResponseDto> {
    return this.payrollCalculationService.calculatePayroll(dto);
  }

  async processDynamicPayroll(
    dto: ProcessDynamicPayrollDto,
  ): Promise<Payroll[]> {
    const { employeeIds, periodStart, periodEnd, notes } = dto;

    // First, calculate payroll for all employees
    const calculations =
      await this.payrollCalculationService.calculateBulkPayroll(
        employeeIds,
        periodStart,
        periodEnd,
      );

    // Create payroll records based on calculations
    const payrolls = await Promise.all(
      calculations.map(async (calc) => {
        return this.payrollModel.create({
          employeeId: calc.employee.id,
          payPeriodStart: new Date(periodStart),
          payPeriodEnd: new Date(periodEnd),
          basicSalary: calc.salaryStructure.basicSalary,
          allowances: calc.calculations.totalAllowances,
          deductions:
            calc.calculations.totalDeductions +
            calc.calculations.leaveDeductions,
          netSalary: calc.calculations.netSalary,
          status: PayrollStatus.PROCESSED,
          notes:
            notes ||
            `Dynamic payroll processed. Working days: ${calc.attendanceSummary.actualWorkingDays}/${calc.attendanceSummary.totalWorkingDays}, Unpaid leaves: ${calc.leaveSummary.unpaidLeaves}`,
        });
      }),
    );

    return payrolls;
  }

  async getPayrollPreview(
    dto: ProcessDynamicPayrollDto,
  ): Promise<PayrollCalculationResponseDto[]> {
    const { employeeIds, periodStart, periodEnd } = dto;

    return this.payrollCalculationService.calculateBulkPayroll(
      employeeIds,
      periodStart,
      periodEnd,
    );
  }

  async getEmployeePayrollHistory(employeeId: string, limit = 12) {
    return this.payrollModel.findAll({
      where: { employeeId },
      include: [
        {
          model: this.employeeModel,
          attributes: ['id', 'name', 'employeeId', 'department', 'designation'],
        },
      ],
      order: [['payPeriodStart', 'DESC']],
      limit,
    });
  }

  async getPayrollSummary(periodStart: string, periodEnd: string) {
    const payrolls = await this.payrollModel.findAll({
      where: {
        payPeriodStart: {
          [Op.gte]: new Date(periodStart),
        },
        payPeriodEnd: {
          [Op.lte]: new Date(periodEnd),
        },
      },
      include: [
        {
          model: this.employeeModel,
          attributes: ['id', 'name', 'department'],
        },
      ],
    });

    const summary = {
      totalEmployees: payrolls.length,
      totalGrossSalary: payrolls.reduce(
        (sum, p) => sum + (p.basicSalary + p.allowances),
        0,
      ),
      totalDeductions: payrolls.reduce((sum, p) => sum + p.deductions, 0),
      totalNetSalary: payrolls.reduce((sum, p) => sum + p.netSalary, 0),
      statusBreakdown: {
        pending: payrolls.filter((p) => p.status === PayrollStatus.PENDING)
          .length,
        processed: payrolls.filter((p) => p.status === PayrollStatus.PROCESSED)
          .length,
        paid: payrolls.filter((p) => p.status === PayrollStatus.PAID).length,
        cancelled: payrolls.filter((p) => p.status === PayrollStatus.CANCELLED)
          .length,
      },
      departmentBreakdown: payrolls.reduce(
        (acc, p) => {
          const dept = p.employee?.department || 'Unknown';
          if (!acc[dept]) {
            acc[dept] = { count: 0, totalAmount: 0 };
          }
          acc[dept].count++;
          acc[dept].totalAmount += p.netSalary;
          return acc;
        },
        {} as Record<string, { count: number; totalAmount: number }>,
      ),
    };

    return summary;
  }
}
