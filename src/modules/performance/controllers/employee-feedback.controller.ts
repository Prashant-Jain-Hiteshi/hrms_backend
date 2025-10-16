import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role as UserRole } from '../../../common/enums/role.enum';
import { EmployeeFeedbackService } from '../services/employee-feedback.service';
import { EmployeeFeedbackDto } from '../dto/employee-feedback.dto';

@Controller('performance/employee/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeFeedbackController {
  constructor(private readonly employeeFeedbackService: EmployeeFeedbackService) {}

  /**
   * Get assigned goals for employee feedback
   * Only employees can access their own feedback goals
   */
  @Get('goals')
  @Roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN)
  async getFeedbackGoals(@Request() req: any) {
    try {
      const tenantId = req.user.tenantId;
      const employeeId = req.user.employeeId;

      const goals = await this.employeeFeedbackService.getEmployeeFeedbackGoals(
        employeeId,
        tenantId,
      );

      return {
        success: true,
        message: 'Feedback goals retrieved successfully',
        data: goals,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get existing feedback submission for a goal
   */
  @Get(':goalAssignmentId')
  @Roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN)
  async getFeedbackSubmission(
    @Param('goalAssignmentId') goalAssignmentId: string,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const employeeId = req.user.employeeId;

      const submission = await this.employeeFeedbackService.getFeedbackSubmission(
        goalAssignmentId,
        employeeId,
        tenantId,
      );

      return {
        success: true,
        message: 'Feedback submission retrieved successfully',
        data: submission,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Save feedback draft
   */
  @Post(':goalAssignmentId/draft')
  @Roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async saveFeedbackDraft(
    @Param('goalAssignmentId') goalAssignmentId: string,
    @Body() feedbackDto: EmployeeFeedbackDto,
    @Request() req: any,
  ) {
    try {
      const tenantId = req.user.tenantId;
      const employeeId = req.user.employeeId;

      const submission = await this.employeeFeedbackService.saveFeedbackDraft(
        goalAssignmentId,
        employeeId,
        feedbackDto,
        tenantId,
      );

      return {
        success: true,
        message: 'Feedback draft saved successfully',
        data: submission,
      };
    } catch (error) {
      throw error;
    }
  }
  /**
   * Submit feedback for review
   */
  @Post(':goalAssignmentId/submit')
  @Roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN)
  async submitFeedback(
    @Param('goalAssignmentId') goalAssignmentId: string,
    @Body() feedbackDto: EmployeeFeedbackDto,
    @Request() req: any,
  ) {
    try {
      const { employeeId, tenantId } = req.user;
      return this.employeeFeedbackService.submitFeedback(
        goalAssignmentId,
        employeeId,
        feedbackDto,
        tenantId,
      );
    } catch (error) {
      throw error;
    }
  }

  // Reviewer endpoints - Accessible by employees who are assigned as reviewers
  @Get('reviewer/pending-reviews')
  @Roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN)
  async getPendingReviews(@Request() req: any) {
    try {
      const { employeeId, tenantId } = req.user;
      console.log(employeeId,"...>")
      return this.employeeFeedbackService.getPendingReviews(employeeId, tenantId);
    } catch (error) {
      throw error;
    }
  }

  @Get('reviewer/submission/:submissionId')
  @Roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN)
  async getSubmissionForReview(
    @Param('submissionId') submissionId: string,
    @Request() req: any,
  ) {
    try {
      const { employeeId, tenantId } = req.user;
      return this.employeeFeedbackService.getSubmissionForReview(
        submissionId,
        employeeId,
        tenantId,
      );
    } catch (error) {
      throw error;
    }
  }

  // New endpoint that accepts complete submission data from frontend
  @Post('reviewer/submission/review-with-data')
  @Roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN)
  async getSubmissionForReviewWithData(
    @Body() submissionData: any,
    @Request() req: any,
  ) {
    try {
      const { employeeId, tenantId } = req.user;
      return this.employeeFeedbackService.getSubmissionForReviewWithData(
        submissionData,
        employeeId,
        tenantId,
      );
    } catch (error) {
      throw error;
    }
  }

  @Post('reviewer/submission/:submissionId/review')
  @Roles(UserRole.EMPLOYEE, UserRole.HR, UserRole.ADMIN)
  async submitReview(
    @Param('submissionId') submissionId: string,
    @Body() reviewData: { overallRating: number; reviewerComments: string },
    @Request() req: any,
  ) {
    try {
      const { employeeId, tenantId } = req.user;
      return this.employeeFeedbackService.submitReview(
        submissionId,
        employeeId,
        reviewData,
        tenantId,
      );
    } catch (error) {
      throw error;
    }
  }

  @Get('admin/all-submissions')
  @Roles(UserRole.HR, UserRole.ADMIN)
  async getAllFeedbackSubmissions(@Request() req: any) {
    try {
      const { tenantId } = req.user;
      const submissions = await this.employeeFeedbackService.getAllFeedbackSubmissions(tenantId);
      
      return {
        success: true,
        message: 'All feedback submissions retrieved successfully',
        data: submissions,
      };
    } catch (error) {
      throw error;
    }
  }
}
