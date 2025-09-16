import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { Employee } from '../../employees/employees.model';
import { Attendance } from '../../attendance/attendance.model';
import { LeaveRequest } from '../../leave/leave.model';
import {
  PayrollCalculationDto,
  PayrollCalculationResponseDto,
  SalaryStructureDto,
} from '../dto/dynamic-payroll.dto';

@Injectable()
export class PayrollCalculationService {
  constructor(
    @InjectModel(Employee)
    private readonly employeeModel: typeof Employee,
    @InjectModel(Attendance)
    private readonly attendanceModel: typeof Attendance,
    @InjectModel(LeaveRequest)
    private readonly leaveRequestModel: typeof LeaveRequest,
  ) {}

  async calculatePayroll(
    dto: PayrollCalculationDto,
  ): Promise<PayrollCalculationResponseDto> {
    const { employeeId, periodStart, periodEnd } = dto;

    // Get employee details
    const employee = await this.employeeModel.findByPk(employeeId);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Calculate period details
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    const totalDays = this.calculateDaysBetween(startDate, endDate);
    const totalWorkingDays = this.calculateWorkingDays(startDate, endDate);

    // Get attendance data
    const attendanceSummary = await this.getAttendanceSummary(
      employeeId,
      periodStart,
      periodEnd,
    );

    // Get leave data
    const leaveSummary = await this.getLeaveSummary(
      employeeId,
      periodStart,
      periodEnd,
    );

    // Calculate salary structure
    const salaryStructure = this.calculateSalaryStructure(employee.salary || 0);

    // Calculate final amounts
    const calculations = this.calculateFinalAmounts(
      salaryStructure,
      attendanceSummary,
      leaveSummary,
      totalWorkingDays,
    );

    return {
      employee: {
        id: employee.id,
        name: employee.name,
        employeeId: employee.employeeId,
        department: employee.department,
        designation: employee.designation,
      },
      salaryStructure,
      attendanceSummary,
      leaveSummary,
      calculations,
      period: {
        startDate: periodStart,
        endDate: periodEnd,
        totalDays,
      },
    };
  }

  private async getAttendanceSummary(
    employeeId: string,
    periodStart: string,
    periodEnd: string,
  ) {
    const attendanceRecords = await this.attendanceModel.findAll({
      where: {
        employeeId,
        date: {
          [Op.between]: [periodStart, periodEnd],
        },
      },
    });

    const totalWorkingDays = this.calculateWorkingDays(
      new Date(periodStart),
      new Date(periodEnd),
    );

    const presentDays = attendanceRecords.filter(
      (record) => record.status === 'present',
    ).length;

    const absentDays = attendanceRecords.filter(
      (record) => record.status === 'absent',
    ).length;

    const lateDays = attendanceRecords.filter(
      (record) => record.status === 'late',
    ).length;

    const halfDays = attendanceRecords.filter(
      (record) => record.status === 'half_day',
    ).length;

    // Calculate actual working days (present + late + half days counted as 0.5)
    const actualWorkingDays = presentDays + lateDays + halfDays * 0.5;

    return {
      totalWorkingDays,
      actualWorkingDays,
      presentDays,
      absentDays,
      lateDays,
      halfDays,
    };
  }

  private async getLeaveSummary(
    employeeId: string,
    periodStart: string,
    periodEnd: string,
  ) {
    // Get approved leaves within the period
    const approvedLeaves = await this.leaveRequestModel.findAll({
      where: {
        employeeId,
        status: 'approved',
        [Op.or]: [
          {
            startDate: {
              [Op.between]: [periodStart, periodEnd],
            },
          },
          {
            endDate: {
              [Op.between]: [periodStart, periodEnd],
            },
          },
          {
            [Op.and]: [
              { startDate: { [Op.lte]: periodStart } },
              { endDate: { [Op.gte]: periodEnd } },
            ],
          },
        ],
      },
    });

    // Calculate total leave days taken in this period
    let leavesTaken = 0;
    approvedLeaves.forEach((leave) => {
      const leaveStart = new Date(
        Math.max(
          new Date(leave.startDate).getTime(),
          new Date(periodStart).getTime(),
        ),
      );
      const leaveEnd = new Date(
        Math.min(
          new Date(leave.endDate).getTime(),
          new Date(periodEnd).getTime(),
        ),
      );
      leavesTaken += this.calculateDaysBetween(leaveStart, leaveEnd);
    });

    // Define leave allowances (this could be made configurable)
    const totalLeavesAllowed = 2; // 2 days per month as example
    const excessLeaves = Math.max(0, leavesTaken - totalLeavesAllowed);
    const unpaidLeaves = excessLeaves; // Excess leaves are unpaid

    return {
      totalLeavesAllowed,
      leavesTaken,
      excessLeaves,
      unpaidLeaves,
    };
  }

  private calculateSalaryStructure(baseSalary: number): SalaryStructureDto {
    // Calculate allowances and deductions based on base salary
    const basicSalary = baseSalary * 0.6; // 60% of total as basic
    const houseRentAllowance = baseSalary * 0.2; // 20% HRA
    const medicalAllowance = baseSalary * 0.05; // 5% Medical
    const transportAllowance = baseSalary * 0.1; // 10% Transport
    const otherAllowances = baseSalary * 0.05; // 5% Other

    const providentFund = basicSalary * 0.12; // 12% PF on basic
    const taxDeduction = baseSalary * 0.1; // 10% Tax (simplified)
    const otherDeductions = baseSalary * 0.02; // 2% Other deductions

    return {
      basicSalary,
      houseRentAllowance,
      medicalAllowance,
      transportAllowance,
      otherAllowances,
      providentFund,
      taxDeduction,
      otherDeductions,
    };
  }

  private calculateFinalAmounts(
    salaryStructure: SalaryStructureDto,
    attendanceSummary: any,
    leaveSummary: any,
    totalWorkingDays: number,
  ) {
    const {
      basicSalary,
      houseRentAllowance,
      medicalAllowance,
      transportAllowance,
      otherAllowances,
      providentFund,
      taxDeduction,
      otherDeductions,
    } = salaryStructure;

    const grossSalary =
      basicSalary +
      houseRentAllowance +
      medicalAllowance +
      transportAllowance +
      otherAllowances;

    const totalAllowances =
      houseRentAllowance +
      medicalAllowance +
      transportAllowance +
      otherAllowances;

    const totalDeductions = providentFund + taxDeduction + otherDeductions;

    // Calculate per day amount
    const perDayAmount = grossSalary / totalWorkingDays;

    // Calculate leave deductions for unpaid leaves
    const leaveDeductions = leaveSummary.unpaidLeaves * perDayAmount;

    // Calculate attendance-based salary
    const attendanceBasedSalary =
      (attendanceSummary.actualWorkingDays / totalWorkingDays) * grossSalary;

    // Net salary = Attendance-based salary - regular deductions - leave deductions
    const netSalary = attendanceBasedSalary - totalDeductions - leaveDeductions;

    return {
      grossSalary,
      totalAllowances,
      totalDeductions,
      leaveDeductions,
      netSalary: Math.max(0, netSalary), // Ensure non-negative
      perDayAmount,
    };
  }

  private calculateDaysBetween(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
  }

  private calculateWorkingDays(startDate: Date, endDate: Date): number {
    let workingDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      // Exclude Sundays (0) and Saturdays (6) - adjust based on your working week
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return workingDays;
  }

  async calculateBulkPayroll(
    employeeIds: string[],
    periodStart: string,
    periodEnd: string,
  ) {
    const calculations = await Promise.all(
      employeeIds.map((employeeId) =>
        this.calculatePayroll({ employeeId, periodStart, periodEnd }),
      ),
    );

    return calculations;
  }
}
