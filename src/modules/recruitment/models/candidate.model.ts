import { Table, Column, Model, DataType, PrimaryKey, Default, CreatedAt, UpdatedAt, BelongsTo, ForeignKey } from 'sequelize-typescript';
import { Job } from './job.model';

export enum CandidateStatus {
  APPLIED = 'applied',
  SCREENING = 'screening',
  INTERVIEW = 'interview',
  HIRED = 'hired',
  REJECTED = 'rejected'
}

@Table({
  tableName: 'candidates',
  timestamps: true,
})
export class Candidate extends Model<Candidate> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  })
  declare fullName: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    validate: {
      isEmail: true,
      notEmpty: true
    }
  })
  declare email: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    validate: {
      len: [0, 20]
    }
  })
  declare phone: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
      len: [2, 100]
    }
  })
  declare position: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 50
    }
  })
  declare experience: number;

  @ForeignKey(() => Job)
  @Column({
    type: DataType.UUID,
    allowNull: false
  })
  declare jobId: string;

  @Column({
    type: DataType.ENUM(...Object.values(CandidateStatus)),
    allowNull: false,
    defaultValue: CandidateStatus.APPLIED
  })
  declare status: CandidateStatus;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW
  })
  declare appliedDate: Date;

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  declare tenantId: string;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => Job)
  declare job: Job;
}
