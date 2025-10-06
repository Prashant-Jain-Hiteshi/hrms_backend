import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { ExpenseCategory } from './models/expense-category.model';
import { ExpenseReimbursement } from './models/expense-reimbursement.model';
import { ExpenseCategoryController } from './controllers/expense-category.controller';
import { ExpenseReimbursementController } from './controllers/expense-reimbursement.controller';
import { ExpenseCategoryService } from './services/expense-category.service';
import { ExpenseReimbursementService } from './services/expense-reimbursement.service';
import { UploadModule } from '../../common/upload/upload.module';

@Module({
  imports: [
    SequelizeModule.forFeature([ExpenseCategory, ExpenseReimbursement]),
    UploadModule,
  ],
  controllers: [ExpenseCategoryController, ExpenseReimbursementController],
  providers: [ExpenseCategoryService, ExpenseReimbursementService],
  exports: [ExpenseCategoryService, ExpenseReimbursementService, SequelizeModule],
})
export class ExpenseModule {}
