import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
  BelongsTo,
  ForeignKey,
} from 'sequelize-typescript';
import { DocumentCategory } from './document-category.model';
import { DocumentType } from './document-type.model';
import { Employee } from '../../employees/employees.model';

export interface DocumentCreationAttributes {
  documentName: string;
  description?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  categoryId: string;
  typeId: string;
  uploadedBy: string;
  tenantId: string;
  tags?: string[];
  metadata?: object;
}

@Table({
  tableName: 'documents',
  timestamps: true,
})
export class Document extends Model<Document, DocumentCreationAttributes> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @Column({
    type: DataType.STRING(200),
    allowNull: false,
  })
  documentName: string;

  @Column(DataType.TEXT)
  description: string;

  @Column({
    type: DataType.STRING(255),
    allowNull: false,
  })
  fileName: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
  })
  filePath: string;

  @Column({
    type: DataType.BIGINT,
    allowNull: false,
  })
  fileSize: number;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  mimeType: string;

  @Column({
    type: DataType.STRING(500),
    allowNull: false,
  })
  fileUrl: string;

  @ForeignKey(() => DocumentCategory)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  categoryId: string;

  @ForeignKey(() => DocumentType)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  typeId: string;

  @ForeignKey(() => Employee)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  uploadedBy: string;

  @Column({
    type: DataType.STRING(100),
    allowNull: false,
  })
  tenantId: string;

  @Column(DataType.ARRAY(DataType.STRING))
  tags: string[];

  @Column(DataType.JSONB)
  metadata: object;

  @Default(true)
  @Column(DataType.BOOLEAN)
  isActive: boolean;

  @CreatedAt
  declare createdAt: Date;

  @UpdatedAt
  declare updatedAt: Date;

  // Associations
  @BelongsTo(() => DocumentCategory)
  category: DocumentCategory;

  @BelongsTo(() => DocumentType)
  type: DocumentType;

  @BelongsTo(() => Employee)
  uploader: Employee;
}
