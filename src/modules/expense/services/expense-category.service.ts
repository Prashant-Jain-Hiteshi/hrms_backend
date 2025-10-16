import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { ExpenseCategory } from '../models/expense-category.model';
import { CreateExpenseCategoryDto } from '../dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from '../dto/update-expense-category.dto';

@Injectable()
export class ExpenseCategoryService {
  constructor(
    @InjectModel(ExpenseCategory)
    private expenseCategoryModel: typeof ExpenseCategory,
  ) {}

  async create(createDto: CreateExpenseCategoryDto, tenantId: string): Promise<ExpenseCategory> {
    try {
      // Auto-generate category code if not provided
      if (!createDto.categoryCode) {
        createDto.categoryCode = createDto.categoryName
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/[^A-Z0-9_]/g, '');
      }

      // Check for duplicate category name
      const existingCategory = await this.expenseCategoryModel.findOne({
        where: { 
          tenantId, 
          categoryName: createDto.categoryName 
        }
      });

      if (existingCategory) {
        throw new BadRequestException('Category name already exists');
      }

      // Check for duplicate category code
      const existingCode = await this.expenseCategoryModel.findOne({
        where: { 
          tenantId, 
          categoryCode: createDto.categoryCode 
        }
      });

      if (existingCode) {
        throw new BadRequestException('Category code already exists');
      }

      return await this.expenseCategoryModel.create({
        tenantId,
        categoryName: createDto.categoryName,
        categoryCode: createDto.categoryCode!,
        description: createDto.description,
        isActive: createDto.isActive,
        autoApprovalPercent: createDto.autoApprovalPercent,
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to create expense category');
    }
  }

  async findAll(tenantId: string): Promise<ExpenseCategory[]> {
    try {
      return await this.expenseCategoryModel.findAll({
        where: { tenantId },
        order: [['categoryName', 'ASC']],
      });
    } catch (error) {
      throw new BadRequestException('Failed to fetch expense categories');
    }
  }

  async findOne(id: string, tenantId: string): Promise<ExpenseCategory> {
    try {
      const category = await this.expenseCategoryModel.findOne({
        where: { id, tenantId },
      });

      if (!category) {
        throw new NotFoundException('Expense category not found');
      }

      return category;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to fetch expense category');
    }
  }

  async update(id: string, updateDto: UpdateExpenseCategoryDto, tenantId: string): Promise<ExpenseCategory> {
    try {
      const category = await this.findOne(id, tenantId);

      // Check for duplicate name if updating
      if (updateDto.categoryName && updateDto.categoryName !== category.categoryName) {
        const existingCategory = await this.expenseCategoryModel.findOne({
          where: { 
            tenantId, 
            categoryName: updateDto.categoryName,
            id: { [Op.ne]: id }
          }
        });

        if (existingCategory) {
          throw new BadRequestException('Category name already exists');
        }
      }

      // Auto-update category code if name changed and code not provided
      if (updateDto.categoryName && !updateDto.categoryCode) {
        updateDto.categoryCode = updateDto.categoryName
          .toUpperCase()
          .replace(/\s+/g, '_')
          .replace(/[^A-Z0-9_]/g, '');
      }

      // Check for duplicate code if updating
      if (updateDto.categoryCode && updateDto.categoryCode !== category.categoryCode) {
        const existingCode = await this.expenseCategoryModel.findOne({
          where: { 
            tenantId, 
            categoryCode: updateDto.categoryCode,
            id: { [Op.ne]: id }
          }
        });

        if (existingCode) {
          throw new BadRequestException('Category code already exists');
        }
      }

      await category.update(updateDto);
      return category.reload();
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to update expense category');
    }
  }

  async remove(id: string, tenantId: string): Promise<void> {
    try {
      const category = await this.findOne(id, tenantId);
      await category.destroy();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to delete expense category');
    }
  }

  async findActiveCategories(tenantId: string): Promise<ExpenseCategory[]> {
    try {
      return await this.expenseCategoryModel.findAll({
        where: { 
          tenantId,
          isActive: true 
        },
        order: [['categoryName', 'ASC']],
      });
    } catch (error) {
      throw new BadRequestException('Failed to fetch active expense categories');
    }
  }
}
