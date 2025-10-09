import { Table, Column, Model, DataType, ForeignKey, BelongsTo, CreatedAt, UpdatedAt } from 'sequelize-typescript';
import { PerformanceGoal } from './performance-goal.model';
import { Employee } from '../../employees/employees.model';

export enum AssignmentStatus {
  ASSIGNED = 'assigned',
  SUBMITTED = 'submitted', 
  REVIEWED = 'reviewed',
  FINALIZED = 'finalized'
}

export interface PerformanceGoalAssignmentCreationAttributes {
  goalId: string;
  employeeId: string;
  reviewerId: string;
  assignedBy: string;
  status?: AssignmentStatus;
  tenantId: string;
  employeeComments?: string;
  reviewerComments?: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  finalizedAt?: Date;
}

@Table({
  tableName: 'performance_goal_assignments',
  timestamps: true,
})
export class PerformanceGoalAssignment extends Model<PerformanceGoalAssignment, PerformanceGoalAssignmentCreationAttributes> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @ForeignKey(() => PerformanceGoal)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  goalId: string;

  @BelongsTo(() => PerformanceGoal, 'goalId')
  goal: PerformanceGoal;

  @ForeignKey(() => Employee)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  employeeId: string;

  @BelongsTo(() => Employee, 'employeeId')
  employee: Employee;

  @ForeignKey(() => Employee)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  reviewerId: string;

  @BelongsTo(() => Employee, 'reviewerId')
  reviewer: Employee;

  @Column({
    type: DataType.ENUM(...Object.values(AssignmentStatus)),
    allowNull: false,
    defaultValue: AssignmentStatus.ASSIGNED,
  })
  status: AssignmentStatus;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  employeeComments: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  reviewerComments: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  submittedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  reviewedAt: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  finalizedAt: Date;

  @ForeignKey(() => Employee)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  assignedBy: string;

  @BelongsTo(() => Employee, 'assignedBy')
  assignedByEmployee: Employee;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  tenantId: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;
}
