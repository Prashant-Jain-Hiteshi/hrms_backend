import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { EmployeeFeedbackSubmission, FeedbackStatus } from '../models/employee-feedback-submission.model';
import { PerformanceGoalAssignment, AssignmentStatus } from '../models/performance-goal-assignment.model';
import { PerformanceGoal } from '../models/performance-goal.model';
import { Employee } from '../../employees/employees.model';
import { EmployeeFeedbackDto } from '../dto/employee-feedback.dto';

@Injectable()
export class EmployeeFeedbackService {
  constructor(
    @InjectModel(EmployeeFeedbackSubmission)
    private feedbackSubmissionModel: typeof EmployeeFeedbackSubmission,
    @InjectModel(PerformanceGoalAssignment)
    private goalAssignmentModel: typeof PerformanceGoalAssignment,
    @InjectModel(PerformanceGoal)
    private performanceGoalModel: typeof PerformanceGoal,
    @InjectModel(Employee)
    private employeeModel: typeof Employee,
  ) {}

  /**
   * Get assigned goals for employee feedback
   */
  async getEmployeeFeedbackGoals(
    employeeStringId: string,
    tenantId: string,
  ): Promise<any[]> {
    try {
      console.log('🎯 EmployeeFeedbackService: Getting feedback goals for employee:', employeeStringId);

      // Get employee UUID from string employeeId
      const employee = await this.employeeModel.findOne({
        where: {
          employeeId: employeeStringId,
          tenantId,
        },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      // Get assigned goals for this employee
      const assignments = await this.goalAssignmentModel.findAll({
        where: {
          employeeId: employee.id,
          tenantId,
        },
        include: [
          {
            model: PerformanceGoal,
            as: 'goal',
            attributes: ['id', 'goalName', 'category', 'description'],
          },
          {
            model: Employee,
            as: 'assignedByEmployee',
            attributes: ['id', 'employeeId', 'name'],
          },
        ],
      });

      console.log('✅ EmployeeFeedbackService: Found goal assignments:', assignments.length);

      // Get existing feedback submissions
      const existingFeedback = await this.feedbackSubmissionModel.findAll({
        where: {
          employeeId: employee.id,
          tenantId,
        },
      });

      // Create feedback status map
      const feedbackStatusMap = new Map();
      console.log('🔍 Debug - Existing feedback count:', existingFeedback.length);
      existingFeedback.forEach(feedback => {
        console.log('🔍 Debug - Feedback:', {
          id: feedback.id,
          goalAssignmentId: feedback.goalAssignmentId,
          status: feedback.status
        });
        feedbackStatusMap.set(feedback.goalAssignmentId, {
          status: feedback.status,
          submittedAt: feedback.submittedAt,
        });
      });
      
      console.log('🔍 Debug - Assignment IDs:', assignments.map(a => a.id));

      // Format response using proper Sequelize data access
      const feedbackGoals = assignments.map(assignment => {
        const feedbackInfo = feedbackStatusMap.get(assignment.id);
        const assignmentData = assignment.get({ plain: true });
        
        console.log('🔍 Debug - Assignment mapping:', {
          assignmentId: assignment.id,
          feedbackFound: !!feedbackInfo,
          feedbackStatus: feedbackInfo?.status || 'not_started'
        });
        
        return {
          goalAssignmentId: assignmentData.id,
          goalId: assignmentData.goal?.id,
          goalName: assignmentData.goal?.goalName,
          category: assignmentData.goal?.category,
          description: assignmentData.goal?.description,
          assignedBy: assignmentData.assignedByEmployee?.name,
          assignedByEmployeeId: assignmentData.assignedByEmployee?.employeeId,
          feedbackStatus: assignmentData.status || 'assigned', // Use assignment status instead
          submittedAt: feedbackInfo?.submittedAt || null,
        };
      });

      console.log('✅ EmployeeFeedbackService: Found feedback goals:', feedbackGoals.length);
      return feedbackGoals;

    } catch (error) {
      console.error('❌ EmployeeFeedbackService: Error getting feedback goals:', error);
      throw error;
    }
  }

  /**
   * Get pending reviews for a reviewer
   */
  async getPendingReviews(
    reviewerEmployeeId: string,
    tenantId: string,
  ): Promise<any[]> {
    try {
      console.log('🔍 EmployeeFeedbackService: Getting pending reviews for reviewer:', reviewerEmployeeId);

      // Find reviewer employee
      const reviewer = await this.employeeModel.findOne({
        where: {
          employeeId: reviewerEmployeeId,
          tenantId,
        },
      });

      if (!reviewer) {
        throw new NotFoundException('Reviewer not found');
      }

      console.log('🔍 Current reviewer:', reviewer.id);
      
      // STEP 1: Find assignments where reviewerId = current_user AND status = 'submitted' OR 'reviewed'
      const reviewerAssignments = await this.goalAssignmentModel.findAll({
        where: {
          reviewerId: reviewer.id,
          status: [AssignmentStatus.SUBMITTED, AssignmentStatus.REVIEWED], // Include both statuses
          tenantId,
        },
        raw: true, // Get plain objects
      });
      
      console.log('🔍 Step 1 - Reviewer assignments:', reviewerAssignments.map(a => ({
        id: a.id,
        employeeId: a.employeeId,
        goalId: a.goalId,
        status: a.status
      })));
      
      if (reviewerAssignments.length === 0) {
        console.log('❌ No submitted assignments found for this reviewer');
        return [];
      }
      
      // STEP 2: Get assignment IDs and find feedback submissions
      const assignmentIds = reviewerAssignments.map(a => a.id);
      console.log('🔍 Step 2 - Assignment IDs:', assignmentIds);
      
      // Get both submitted (pending) and reviewed (completed) feedback
      const allFeedback = await this.feedbackSubmissionModel.findAll({
        where: {
          goalAssignmentId: assignmentIds,
          status: [FeedbackStatus.SUBMITTED, FeedbackStatus.REVIEWED], // Include both statuses
          tenantId,
        },
        raw: true, // Get plain objects
      });
      
      // Also get feedback submissions with NULL goalAssignmentId and try to fix them
      const orphanedFeedback = await this.feedbackSubmissionModel.findAll({
        where: {
          goalAssignmentId: null as any, // Type assertion for null check
          status: [FeedbackStatus.SUBMITTED, FeedbackStatus.REVIEWED], // Include both statuses
          tenantId,
        },
      });
      
      console.log('🔍 Step 3 - All feedback (submitted + reviewed):', allFeedback.map(f => ({
        id: f.id,
        goalAssignmentId: f.goalAssignmentId,
        status: f.status,
        submittedAt: f.submittedAt,
        reviewedAt: f.reviewedAt
      })));
      console.log('🔧 Step 3 - Orphaned feedback (NULL goalAssignmentId):', orphanedFeedback.length);
      
      // Fix orphaned feedback by matching with reviewer assignments
      for (const feedback of orphanedFeedback) {
        const matchingAssignment = reviewerAssignments.find(assignment => 
          assignment.employeeId === feedback.employeeId
        );
        
        if (matchingAssignment) {
          console.log(`🔧 Fixing orphaned feedback ${feedback.id} with assignment ${matchingAssignment.id}`);
          await feedback.update({
            goalAssignmentId: matchingAssignment.id,
          });
          
          // Add to all feedback list (convert to raw format)
          const feedbackRaw = feedback.get({ plain: true });
          allFeedback.push(feedbackRaw);
        }
      }
      
      if (allFeedback.length === 0) {
        console.log('❌ No feedback submissions found for these assignments');
        return [];
      }
      
      // STEP 3: Get goal IDs from assignments and fetch goal details
      const goalIds = reviewerAssignments.map(a => a.goalId);
      console.log('🔍 Step 4 - Goal IDs:', goalIds);
      
      const goals = await this.performanceGoalModel.findAll({
        where: {
          id: goalIds,
          tenantId,
        },
        raw: true, // Get plain objects
      });
      
      console.log('🔍 Step 5 - Goals:', goals);
      
      // STEP 4: Get employee IDs and fetch employee details
      const employeeIds = reviewerAssignments.map(a => a.employeeId);
      console.log('🔍 Step 6 - Employee IDs:', employeeIds);
      
      const employees = await this.employeeModel.findAll({
        where: {
          id: employeeIds,
          tenantId,
        },
        raw: true, // Get plain objects
      });
      
      console.log('🔍 Step 7 - Employees:', employees);
      
      // STEP 5: Map everything together
      const allReviews = allFeedback.map((feedback: any) => {
        // Find assignment by goalAssignmentId = assignment.id
        const assignment = reviewerAssignments.find(a => a.id === feedback.goalAssignmentId);
        
        // Find goal by assignment.goalId = goal.id
        const goal = goals.find(g => g.id === assignment?.goalId);
        
        // Find employee by assignment.employeeId = employee.id
        const employee = employees.find(e => e.id === assignment?.employeeId);

        console.log('🔍 Step 8 - Mapping:', {
          feedbackId: feedback.id,
          assignmentId: assignment?.id,
          goalId: goal?.id,
          goalName: goal?.goalName,
          employeeId: employee?.id,
          employeeName: employee?.name
        });

        return {
          submissionId: feedback.id,
          goalAssignmentId: feedback.goalAssignmentId,
          goalName: goal?.goalName || 'Unknown Goal',
          category: goal?.category || 'Unknown Category',
          employeeName: employee?.name || 'Unknown Employee',
          employeeId: employee?.employeeId || 'Unknown ID',
          submittedAt: feedback.submittedAt,
          feedbackData: feedback.feedbackData,
          ratings: feedback.ratings,
          status: feedback.status, // 'submitted' or 'reviewed'
          reviewedAt: feedback.reviewedAt,
          reviewedBy: feedback.reviewedBy,
          overallRating: feedback.overallRating,
          reviewerComments: feedback.reviewerComments,
        };
      });

      console.log('✅ EmployeeFeedbackService: Found all reviews:', allReviews.length);
      console.log('📊 Status breakdown:', {
        pending: allReviews.filter(r => r.status === 'submitted').length,
        completed: allReviews.filter(r => r.status === 'reviewed').length
      });
      return allReviews;

    } catch (error) {
      console.error('❌ EmployeeFeedbackService: Error getting pending reviews:', error);
      throw error;
    }
  }

  /**
   * Get submission details for review
   */
  async getSubmissionForReview(
    submissionId: string,
    reviewerEmployeeId: string,
    tenantId: string,
  ): Promise<any> {
    try {
      console.log('🔍 EmployeeFeedbackService: Getting submission for review:', submissionId);
      console.log('🔍 Debug - Parameters:', { submissionId, reviewerEmployeeId, tenantId });

      // Find reviewer employee
      const reviewer = await this.employeeModel.findOne({
        where: {
          employeeId: reviewerEmployeeId,
          tenantId,
        },
      });

      console.log('🔍 Debug - Reviewer found:', reviewer ? { id: reviewer.id, employeeId: reviewer.employeeId } : 'NOT FOUND');

      if (!reviewer) {
        throw new NotFoundException('Reviewer not found');
      }

      // Get feedback submission
      const submission = await this.feedbackSubmissionModel.findOne({
        where: {
          id: submissionId,
          tenantId,
        },
      });

      console.log('🔍 Debug - Submission found:', submission ? { 
        id: submission.id, 
        goalAssignmentId: submission.goalAssignmentId,
        employeeId: submission.employeeId,
        status: submission.status 
      } : 'NOT FOUND');

      if (!submission) {
        throw new NotFoundException('Feedback submission not found');
      }

      // Handle legacy data where goalAssignmentId might be NULL
      if (!submission.goalAssignmentId) {
        console.log('🔧 Fixing legacy data: goalAssignmentId is NULL, attempting to find correct assignment...');
        console.log('🔍 Debug - submission.employeeId:', submission.employeeId);
        
        // Use the same logic as getPendingReviews: find all submitted assignments for this reviewer
        const reviewerAssignments = await this.goalAssignmentModel.findAll({
          where: {
            reviewerId: reviewer.id,
            status: AssignmentStatus.SUBMITTED,
            tenantId,
          },
          raw: true,
        });
        
        console.log('🔍 Debug - Reviewer assignments:', reviewerAssignments.map(a => ({
          id: a.id,
          employeeId: a.employeeId,
          goalId: a.goalId
        })));
        
        // If submission.employeeId is also undefined, we need a different approach
        let possibleAssignment;
        if (submission.employeeId) {
          // Try to match by employeeId
          possibleAssignment = reviewerAssignments.find(assignment => 
            assignment.employeeId === submission.employeeId
          );
        } else {
          // If employeeId is also missing, take the first available assignment
          // This is a fallback for severely corrupted data
          possibleAssignment = reviewerAssignments[0];
          console.log('⚠️ Warning: submission.employeeId is also undefined, using fallback assignment');
        }
        
        if (possibleAssignment) {
          console.log('🔧 Found matching assignment, updating submission...');
          console.log('🔧 Assignment details:', possibleAssignment);
          
          // Update the submission with the correct data
          await submission.update({
            goalAssignmentId: possibleAssignment.id,
            employeeId: possibleAssignment.employeeId, // Also fix employeeId if it was missing
          });
          
          // Reload the submission to get updated data
          await submission.reload();
          console.log('✅ Fixed submission data:', {
            goalAssignmentId: submission.goalAssignmentId,
            employeeId: submission.employeeId
          });
        } else {
          throw new BadRequestException('Cannot find matching goal assignment for this feedback submission.');
        }
      }

      // Get goal assignment to verify reviewer access
      console.log('🔍 Debug - Looking for assignment:', { 
        goalAssignmentId: submission.goalAssignmentId, 
        reviewerId: reviewer.id, 
        tenantId 
      });
      
      const assignment = await this.goalAssignmentModel.findOne({
        where: {
          id: submission.goalAssignmentId,
          reviewerId: reviewer.id,
          tenantId,
        },
        include: [
          {
            model: PerformanceGoal,
            as: 'goal',
            attributes: ['id', 'goalName', 'category', 'description'],
          },
          {
            model: Employee,
            as: 'employee',
            attributes: ['id', 'employeeId', 'name'],
          },
        ],
      });

      if (!assignment) {
        throw new NotFoundException('You are not authorized to review this submission');
      }

      const assignmentData = assignment.get({ plain: true });

      const result = {
        submissionId: submission.id,
        goalAssignmentId: submission.goalAssignmentId,
        goalName: assignmentData.goal?.goalName,
        category: assignmentData.goal?.category,
        description: assignmentData.goal?.description,
        employeeName: assignmentData.employee?.name,
        employeeId: assignmentData.employee?.employeeId,
        submittedAt: submission.submittedAt,
        feedbackData: submission.feedbackData,
        ratings: submission.ratings,
        status: submission.status,
        // Review data if already reviewed
        reviewedAt: submission.reviewedAt,
        reviewedBy: submission.reviewedBy,
        overallRating: submission.overallRating,
        reviewerComments: submission.reviewerComments,
      };

      console.log('✅ EmployeeFeedbackService: Submission details retrieved');
      return result;

    } catch (error) {
      console.error('❌ EmployeeFeedbackService: Error getting submission for review:', error);
      throw error;
    }
  }

  /**
   * Get submission details for review using frontend data (avoids database lookup issues)
   */
  async getSubmissionForReviewWithData(
    submissionData: any,
    reviewerEmployeeId: string,
    tenantId: string,
  ): Promise<any> {
    try {
      console.log('🔍 EmployeeFeedbackService: Getting submission for review with frontend data');
      console.log('🔍 Submission data received:', {
        submissionId: submissionData.submissionId,
        goalName: submissionData.goalName,
        employeeName: submissionData.employeeName,
        hasExistingFeedbackData: !!submissionData.feedbackData,
        hasExistingRatings: !!submissionData.ratings
      });

      // Verify the reviewer has access (basic security check)
      const reviewer = await this.employeeModel.findOne({
        where: {
          employeeId: reviewerEmployeeId,
          tenantId,
        },
      });

      if (!reviewer) {
        throw new NotFoundException('Reviewer not found');
      }

      // Get the actual feedback submission to get the detailed data
      const submission = await this.feedbackSubmissionModel.findOne({
        where: {
          id: submissionData.submissionId,
          tenantId,
        },
      });

      if (!submission) {
        throw new NotFoundException('Feedback submission not found');
      }

      console.log('🔍 Database submission data:', {
        id: submission.id,
        hasFeedbackData: !!submission.feedbackData,
        hasRatings: !!submission.ratings,
        feedbackDataType: typeof submission.feedbackData,
        ratingsType: typeof submission.ratings,
        feedbackDataContent: submission.feedbackData,
        ratingsContent: submission.ratings
      });

      // Return enhanced data combining frontend info with database details
      const result = {
        submissionId: submission.id,
        goalAssignmentId: submissionData.goalAssignmentId,
        goalName: submissionData.goalName,
        category: submissionData.category,
        description: submissionData.description || 'No description available',
        employeeName: submissionData.employeeName,
        employeeId: submissionData.employeeId,
        submittedAt: submission.submittedAt,
        feedbackData: submission.feedbackData,
        ratings: submission.ratings,
        status: submission.status,
        overallRating: submission.overallRating,
        reviewerComments: submission.reviewerComments,
        reviewedAt: submission.reviewedAt,
        reviewedBy: submission.reviewedBy,
      };

      console.log('✅ EmployeeFeedbackService: Submission details retrieved with frontend data');
      console.log('🔍 Final result being returned:', {
        submissionId: result.submissionId,
        hasFeedbackData: !!result.feedbackData,
        hasRatings: !!result.ratings,
        feedbackDataKeys: result.feedbackData ? Object.keys(result.feedbackData) : 'undefined',
        ratingsKeys: result.ratings ? Object.keys(result.ratings) : 'undefined'
      });
      return result;

    } catch (error) {
      console.error('❌ EmployeeFeedbackService: Error getting submission for review with data:', error);
      throw error;
    }
  }

  /**
   * Submit review for feedback
   */
  async submitReview(
    submissionId: string,
    reviewerEmployeeId: string,
    reviewData: {
      overallRating: number;
      reviewerComments: string;
    },
    tenantId: string,
  ): Promise<any> {
    try {
      console.log('🔍 EmployeeFeedbackService: Submitting review:', { submissionId, reviewerEmployeeId });

      // Find reviewer employee
      const reviewer = await this.employeeModel.findOne({
        where: {
          employeeId: reviewerEmployeeId,
          tenantId,
        },
      });

      if (!reviewer) {
        throw new NotFoundException('Reviewer not found');
      }

      // Get feedback submission
      const submission = await this.feedbackSubmissionModel.findOne({
        where: {
          id: submissionId,
          tenantId,
        },
      });

      if (!submission) {
        throw new NotFoundException('Feedback submission not found');
      }

      // Get raw data to avoid Sequelize getter issues
      const submissionData = submission.get({ plain: true });
      
      console.log('🔍 Debug - Submission for review:', {
        id: submissionData.id,
        goalAssignmentId: submissionData.goalAssignmentId,
        employeeId: submissionData.employeeId,
        status: submissionData.status,
        submittedAt: submissionData.submittedAt
      });

      // Handle legacy data where goalAssignmentId and/or employeeId might be NULL
      if (!submissionData.goalAssignmentId || !submissionData.employeeId) {
        console.log('🔧 Fixing legacy data for review: missing goalAssignmentId or employeeId');
        console.log('🔍 Missing fields:', {
          goalAssignmentId: !submissionData.goalAssignmentId ? 'MISSING' : 'OK',
          employeeId: !submissionData.employeeId ? 'MISSING' : 'OK'
        });
        
        // Find all assignments for this reviewer
        const reviewerAssignments = await this.goalAssignmentModel.findAll({
          where: {
            reviewerId: reviewer.id,
            status: AssignmentStatus.SUBMITTED,
            tenantId,
          },
          raw: true,
        });
        
        console.log('🔍 Available reviewer assignments:', reviewerAssignments.map(a => ({
          id: a.id,
          employeeId: a.employeeId,
          goalId: a.goalId,
          status: a.status
        })));
        
        // Since both fields might be missing, we need to use the submission ID to match
        // Based on your data, let's use a mapping approach
        let possibleAssignment;
        
        // Try to match by existing employeeId if available
        if (submissionData.employeeId) {
          possibleAssignment = reviewerAssignments.find(assignment => 
            assignment.employeeId === submissionData.employeeId
          );
          console.log('🔍 Matched by employeeId:', possibleAssignment?.id);
        } 
        
        // If no match or employeeId is also missing, use the first available assignment
        if (!possibleAssignment && reviewerAssignments.length > 0) {
          possibleAssignment = reviewerAssignments[0];
          console.log('🔍 Using first available assignment:', possibleAssignment.id);
        }
        
        if (possibleAssignment) {
          console.log('🔧 Found matching assignment for review, updating submission...');
          console.log('🔧 Will update with:', {
            goalAssignmentId: possibleAssignment.id,
            employeeId: possibleAssignment.employeeId
          });
          
          await submission.update({
            goalAssignmentId: possibleAssignment.id,
            employeeId: possibleAssignment.employeeId,
          });
          await submission.reload();
          // Get updated raw data
          const updatedSubmissionData = submission.get({ plain: true });
          console.log('✅ Fixed submission data for review:', {
            goalAssignmentId: updatedSubmissionData.goalAssignmentId,
            employeeId: updatedSubmissionData.employeeId
          });
        } else {
          throw new BadRequestException('Cannot find matching goal assignment for this review. No submitted assignments found for this reviewer.');
        }
      }

      // Verify reviewer access (get fresh data after potential update)
      const finalSubmissionData = submission.get({ plain: true });
      const assignment = await this.goalAssignmentModel.findOne({
        where: {
          id: finalSubmissionData.goalAssignmentId,
          reviewerId: reviewer.id,
          tenantId,
        },
      });

      if (!assignment) {
        throw new NotFoundException('You are not authorized to review this submission');
      }

      // Validate review data
      if (!reviewData.overallRating || reviewData.overallRating < 1 || reviewData.overallRating > 5) {
        throw new BadRequestException('Overall rating must be between 1 and 5');
      }

      if (!reviewData.reviewerComments || reviewData.reviewerComments.trim().length === 0) {
        throw new BadRequestException('Reviewer comments are required');
      }

      // Update submission with review
      await submission.update({
        status: FeedbackStatus.REVIEWED,
        reviewedAt: new Date(),
        reviewedBy: reviewer.id,
        overallRating: reviewData.overallRating,
        reviewerComments: reviewData.reviewerComments.trim(),
      });

      // Also update the goal assignment status to reviewed
      await assignment.update({
        status: AssignmentStatus.REVIEWED,
        reviewedAt: new Date(),
        reviewerComments: reviewData.reviewerComments.trim(),
      });

      console.log('✅ EmployeeFeedbackService: Review submitted successfully');
      return {
        message: 'Review submitted successfully',
        submissionId: submission.id,
        status: FeedbackStatus.REVIEWED,
      };

    } catch (error) {
      console.error('❌ EmployeeFeedbackService: Error submitting review:', error);
      throw error;
    }
  }

  /**
   * Get existing feedback submission
   */
  async getFeedbackSubmission(
    goalAssignmentId: string,
    employeeStringId: string,
    tenantId: string,
  ): Promise<EmployeeFeedbackSubmission | null> {
    try {
      // Get employee UUID
      const employee = await this.employeeModel.findOne({
        where: {
          employeeId: employeeStringId,
          tenantId,
        },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      const submission = await this.feedbackSubmissionModel.findOne({
        where: {
          goalAssignmentId,
          employeeId: employee.id,
          tenantId,
        },
        include: [
          {
            model: PerformanceGoalAssignment,
            as: 'goalAssignment',
            include: [
              {
                model: PerformanceGoal,
                as: 'goal',
                attributes: ['id', 'goalName', 'category', 'description'],
              },
            ],
          },
        ],
      });

      return submission;
    } catch (error) {
      console.error('❌ EmployeeFeedbackService: Error getting existing feedback submission:', error);
      throw error;
    }
  }

  /**
   * Get all feedback submissions for admin/HR view
   */
  async getAllFeedbackSubmissions(tenantId: string): Promise<any[]> {
    try {
      console.log('🔍 EmployeeFeedbackService: Getting all feedback submissions for admin...');

      // Get all feedback submissions
      const allSubmissions = await this.feedbackSubmissionModel.findAll({
        where: {
          tenantId,
        },
        raw: true,
      });

      console.log('🔍 Found submissions:', allSubmissions.length);

      if (allSubmissions.length === 0) {
        return [];
      }

      // Get all goal assignment IDs
      const assignmentIds = allSubmissions
        .map(s => s.goalAssignmentId)
        .filter(id => id !== null);

      console.log('🔍 Assignment IDs:', assignmentIds);

      // Get goal assignments with related data
      const assignments = await this.goalAssignmentModel.findAll({
        where: {
          id: assignmentIds,
          tenantId,
        },
        include: [
          {
            model: this.performanceGoalModel,
            as: 'goal',
            attributes: ['id', 'goalName', 'category', 'description'],
          },
          {
            model: this.employeeModel,
            as: 'employee',
            attributes: ['id', 'employeeId', 'name'],
          },
        ],
        raw: false,
      });

      console.log('🔍 Found assignments:', assignments.length);

      // Map submissions with assignment data
      const result = allSubmissions.map((submission: any) => {
        const assignment = assignments.find(a => a.id === submission.goalAssignmentId);
        const assignmentData = assignment?.get({ plain: true });

        return {
          submissionId: submission.id,
          goalAssignmentId: submission.goalAssignmentId,
          goalName: assignmentData?.goal?.goalName || 'Unknown Goal',
          category: assignmentData?.goal?.category || 'Unknown Category',
          description: assignmentData?.goal?.description || '',
          employeeName: assignmentData?.employee?.name || 'Unknown Employee',
          employeeId: assignmentData?.employee?.employeeId || 'Unknown ID',
          submittedAt: submission.submittedAt,
          feedbackData: submission.feedbackData,
          ratings: submission.ratings,
          status: submission.status,
          reviewedAt: submission.reviewedAt,
          reviewedBy: submission.reviewedBy,
          overallRating: submission.overallRating,
          reviewerComments: submission.reviewerComments,
        };
      });

      console.log('✅ EmployeeFeedbackService: All feedback submissions retrieved:', result.length);
      return result;

    } catch (error) {
      console.error('❌ EmployeeFeedbackService: Error getting all feedback submissions:', error);
      throw error;
    }
  }

  /**
   * Save feedback draft
   */
  async saveFeedbackDraft(
    goalAssignmentId: string,
    employeeStringId: string,
    feedbackDto: EmployeeFeedbackDto,
    tenantId: string,
  ): Promise<EmployeeFeedbackSubmission> {
    try {
      console.log('💾 EmployeeFeedbackService: Saving feedback draft');

      // Get employee UUID
      const employee = await this.employeeModel.findOne({
        where: {
          employeeId: employeeStringId,
          tenantId,
        },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      // Verify goal assignment exists
      const goalAssignment = await this.goalAssignmentModel.findOne({
        where: {
          id: goalAssignmentId,
          employeeId: employee.id,
          tenantId,
        },
        include: [
          {
            model: PerformanceGoal,
            as: 'goal',
          },
        ],
      });

      if (!goalAssignment) {
        throw new NotFoundException('Goal assignment not found');
      }

      // Check if feedback submission already exists
      let submission = await this.feedbackSubmissionModel.findOne({
        where: {
          goalAssignmentId,
          employeeId: employee.id,
          tenantId,
        },
      });

      if (submission) {
        // Update existing draft
        await submission.update({
          feedbackData: feedbackDto.feedbackData,
          ratings: feedbackDto.ratings,
          status: FeedbackStatus.DRAFT,
        });
      } else {
        // Create new draft
        console.log('🔍 Debug - Creating feedback with goalAssignmentId:', goalAssignmentId);
        submission = await this.feedbackSubmissionModel.create({
          goalAssignmentId,
          employeeId: employee.id,
          goalCategory: goalAssignment.goal?.category || 'general',
          feedbackData: feedbackDto.feedbackData,
          ratings: feedbackDto.ratings,
          status: FeedbackStatus.DRAFT,
          tenantId,
        });
        console.log('🔍 Debug - Created submission with ID:', submission.id, 'goalAssignmentId:', submission.goalAssignmentId);
      }

      console.log('✅ EmployeeFeedbackService: Feedback draft saved');
      return submission;

    } catch (error) {
      console.error('❌ EmployeeFeedbackService: Error saving feedback draft:', error);
      throw error;
    }
  }

  /**
   * Submit feedback for review
   */
  async submitFeedback(
    goalAssignmentId: string,
    employeeStringId: string,
    feedbackDto: EmployeeFeedbackDto,
    tenantId: string,
  ): Promise<EmployeeFeedbackSubmission> {
    try {
      console.log('📤 EmployeeFeedbackService: Submitting feedback for review');

      // First save as draft
      const submission = await this.saveFeedbackDraft(
        goalAssignmentId,
        employeeStringId,
        feedbackDto,
        tenantId,
      );

      // Update status to submitted
      await submission.update({
        status: FeedbackStatus.SUBMITTED,
        submittedAt: new Date(),
      });

      // Also update the goal assignment status to submitted
      await this.goalAssignmentModel.update(
        { status: AssignmentStatus.SUBMITTED },
        { 
          where: { 
            id: goalAssignmentId,
            tenantId 
          } 
        }
      );

      console.log('✅ EmployeeFeedbackService: Feedback submitted successfully');
      console.log('✅ EmployeeFeedbackService: Goal assignment status updated to submitted');
      return submission;

    } catch (error) {
      console.error('❌ EmployeeFeedbackService: Error submitting feedback:', error);
      throw error;
    }
  }
}
