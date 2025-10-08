import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  Index,
} from 'sequelize-typescript';

// Define the creation attributes interface
export interface DocumentCategoryCreationAttributes {
  categoryName: string;
  categoryCode: string;
  description?: string;
  icon?: string;
  color?: string;
  isActive?: boolean;
  sortOrder?: number;
  tenantId: string;
  metadata?: object;
}

@Table({
  tableName: 'document_categories',
  timestamps: true,
})
export class DocumentCategory extends Model<DocumentCategory, DocumentCategoryCreationAttributes> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    comment: 'Category name like HR Policies, Training Materials'
  })
  categoryName: string;

  @Index({ unique: true, name: 'idx_category_code_tenant' })
  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    comment: 'Unique category code like HR_POL, TRAIN_MAT'
  })
  categoryCode: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    comment: 'Category description'
  })
  description: string;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    defaultValue: 'folder',
    comment: 'Icon name for UI display'
  })
  icon: string;

  @Column({
    type: DataType.STRING(7),
    allowNull: true,
    defaultValue: '#3B82F6',
    comment: 'Hex color code for UI theming'
  })
  color: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether category is active and can be used'
  })
  isActive: boolean;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    comment: 'Sort order for display'
  })
  sortOrder: number;

  @Column({
    type: DataType.UUID,
    allowNull: false,
    comment: 'Tenant ID for multi-tenancy'
  })
  tenantId: string;

  @Column({
    type: DataType.JSON,
    allowNull: true,
    comment: 'Additional metadata as JSON'
  })
  metadata: object;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  // Virtual field for document count (will be populated in queries)
  documentCount?: number;
}
