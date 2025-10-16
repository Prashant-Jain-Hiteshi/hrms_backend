import { 
  Table, 
  Column, 
  Model, 
  DataType, 
  PrimaryKey, 
  Default, 
  ForeignKey, 
  BelongsTo,
  CreatedAt,
  UpdatedAt
} from 'sequelize-typescript';
import { PerformanceGoalAssignment } from './performance-goal-assignment.model';
import { Employee } from '../../employees/employees.model';

export enum FeedbackStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  REVIEWED = 'reviewed'
}

export interface FeedbackData {
  // Project Details
  projectDetails?: {
    projectName?: string;
    clientName?: string;
    projectPhase?: string;
    yourRole?: string;
    teamSize?: number;
    projectDuration?: string;
    technologiesUsed?: string[];
  };
  
  // Learning & Development
  learningOutcomes?: {
    whatYouLearned?: string;
    skillsGained?: string;
    challengesFaced?: string;
    solutionsImplemented?: string;
    knowledgeShared?: string;
  };
}

export interface FeedbackRatings {
  responsibility?: number; // 1-5
  ownership?: number; // 1-5
  clientEngagement?: number; // 1-5
  teamCollaboration?: number; // 1-5
  problemSolving?: number; // 1-5
  communication?: number; // 1-5
  initiative?: number; // 1-5
  qualityOfWork?: number; // 1-5
}

export interface EmployeeFeedbackSubmissionCreationAttributes {
  goalAssignmentId: string;
  employeeId: string;
  goalCategory: string;
  feedbackData?: FeedbackData;
  ratings?: FeedbackRatings;
  status: FeedbackStatus;
  tenantId: string;
}

@Table({
  tableName: 'employee_feedback_submissions',
  timestamps: true,
})
export class EmployeeFeedbackSubmission extends Model<EmployeeFeedbackSubmission, EmployeeFeedbackSubmissionCreationAttributes> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => PerformanceGoalAssignment)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  goalAssignmentId!: string;

  @ForeignKey(() => Employee)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  employeeId!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  goalCategory!: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  feedbackData?: FeedbackData;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  ratings?: FeedbackRatings;

  @Column({
    type: DataType.ENUM(...Object.values(FeedbackStatus)),
    allowNull: false,
    defaultValue: FeedbackStatus.DRAFT,
  })
  status!: FeedbackStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  submittedAt?: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  reviewedAt?: Date;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  reviewedBy?: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5,
    },
  })
  overallRating?: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  reviewerComments?: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  tenantId!: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => PerformanceGoalAssignment)
  goalAssignment!: PerformanceGoalAssignment;

  @BelongsTo(() => Employee)
  employee!: Employee;
}
