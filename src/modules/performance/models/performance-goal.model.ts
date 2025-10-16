import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  AllowNull,
  ForeignKey,
  BelongsTo,
  CreatedAt,
  UpdatedAt,
  Unique,
  Index,
} from 'sequelize-typescript';
import { User } from '../../users/users.model';

export enum GoalCategory {
  PERFORMANCE = 'Performance',
  TECHNICAL_SKILL = 'Technical Skill',
  LEADERSHIP = 'Leadership',
  COMMUNICATION = 'Communication',
  PROJECT_WORK = 'Project Work',
}

export enum GoalStatus {
  CREATED = 'created',
  ASSIGNED = 'assigned',
  SUBMITTED = 'submitted',
  REVIEWED = 'reviewed',
  FINALIZED = 'finalized',
}

@Table({
  tableName: 'performance_goals',
  timestamps: true,
})
export class PerformanceGoal extends Model<PerformanceGoal> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare goalName: string;

  @AllowNull(false)
  @Column(DataType.ENUM(...Object.values(GoalCategory)))
  declare category: GoalCategory;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare description: string;

  @AllowNull(false)
  @Default(GoalStatus.CREATED)
  @Column(DataType.ENUM(...Object.values(GoalStatus)))
  declare status: GoalStatus;

  @AllowNull(false)
  @ForeignKey(() => User)
  @Column(DataType.UUID)
  declare createdBy: string;

  @AllowNull(false)
  @Index
  @Column(DataType.UUID)
  declare tenantId: string;

  @AllowNull(false)
  @Default(true)
  @Column(DataType.BOOLEAN)
  declare isActive: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => User, 'createdBy')
  creator: User;
}
