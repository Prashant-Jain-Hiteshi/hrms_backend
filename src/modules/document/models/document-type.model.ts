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
export interface DocumentTypeCreationAttributes {
  typeName: string;
  typeCode: string;
  description?: string;
  allowedExtensions?: string[];
  maxFileSize?: number;
  icon?: string;
  color?: string;
  isActive?: boolean;
  requiresApproval?: boolean;
  sortOrder?: number;
  tenantId: string;
  metadata?: object;
}

@Table({
  tableName: 'document_types',
  timestamps: true,
})
export class DocumentType extends Model<DocumentType, DocumentTypeCreationAttributes> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
    comment: 'Type name like Policy, Template, Certificate'
  })
  typeName: string;

  @Index({ unique: true, name: 'idx_type_code_tenant' })
  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    comment: 'Unique type code like POL, TMPL, CERT'
  })
  typeCode: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    comment: 'Type description'
  })
  description: string;

  @Column({
    type: DataType.JSON,
    allowNull: false,
    defaultValue: '["pdf", "doc", "docx", "txt", "xlsx", "ppt", "pptx"]',
    comment: 'Allowed file extensions as JSON array'
  })
  allowedExtensions: string[];

  @Column({
    type: DataType.BIGINT,
    allowNull: false,
    defaultValue: 10485760, // 10MB in bytes
    comment: 'Maximum file size in bytes'
  })
  maxFileSize: number;

  @Column({
    type: DataType.STRING(50),
    allowNull: true,
    defaultValue: 'file-text',
    comment: 'Icon name for UI display'
  })
  icon: string;

  @Column({
    type: DataType.STRING(7),
    allowNull: true,
    defaultValue: '#10B981',
    comment: 'Hex color code for UI theming'
  })
  color: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether type is active and can be used'
  })
  isActive: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether documents of this type require approval'
  })
  requiresApproval: boolean;

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

  // Helper method to check if file extension is allowed
  isExtensionAllowed(extension: string): boolean {
    return this.allowedExtensions.includes(extension.toLowerCase());
  }

  // Helper method to check if file size is within limit
  isFileSizeAllowed(fileSize: number): boolean {
    return fileSize <= this.maxFileSize;
  }

  // Helper method to format max file size for display
  getFormattedMaxSize(): string {
    const sizeInMB = this.maxFileSize / (1024 * 1024);
    return `${sizeInMB}MB`;
  }
}
