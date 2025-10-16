import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PerformanceGoal } from './models/performance-goal.model';
import { PerformanceGoalAssignment } from './models/performance-goal-assignment.model';
import { EmployeeFeedbackSubmission } from './models/employee-feedback-submission.model';
import { PerformanceGoalController } from './controllers/performance-goal.controller';
import { EmployeeFeedbackController } from './controllers/employee-feedback.controller';
import { PerformanceGoalService } from './services/performance-goal.service';
import { EmployeeFeedbackService } from './services/employee-feedback.service';
import { User } from '../users/users.model';
import { Employee } from '../employees/employees.model';

@Module({
  imports: [
    SequelizeModule.forFeature([
      PerformanceGoal,
      PerformanceGoalAssignment,
      EmployeeFeedbackSubmission,
      User,
      Employee,
    ]),
  ],
  controllers: [PerformanceGoalController, EmployeeFeedbackController],
  providers: [PerformanceGoalService, EmployeeFeedbackService],
  exports: [PerformanceGoalService, EmployeeFeedbackService],
})
export class PerformanceModule {}
