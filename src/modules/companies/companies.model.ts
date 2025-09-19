import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  PrimaryKey,
  AllowNull,
  Unique,
  BeforeCreate,
  BeforeUpdate,
  HasMany,
} from 'sequelize-typescript';

// Forward declarations to avoid circular imports

@Table({ tableName: 'companies', timestamps: true })
export class Company extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column({ type: DataType.UUID })
  declare id: string;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare name: string;

  @AllowNull(true) // Allow null initially, will be set by hook
  @Unique
  @Column(DataType.STRING)
  declare companyCode: string;

  @AllowNull(false)
  @Default('active')
  @Column({
    type: DataType.ENUM('active', 'suspended', 'trial', 'expired'),
  })
  declare status: 'active' | 'suspended' | 'trial' | 'expired';

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare address?: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare phone?: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare email?: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare website?: string;

  @AllowNull(true)
  @Column(DataType.STRING)
  declare logoUrl?: string;

  // Note: Associations with Employee and User are defined via foreign keys
  // The relationships are established through tenantId foreign key

  // Auto-generate company code from name
  @BeforeCreate
  @BeforeUpdate
  static async generateCompanyCode(instance: Company) {
    try {
      console.log('🔍 Generating company code for:', instance.name);
      
      if (instance.name && !instance.companyCode) {
        const words = instance.name.trim().split(/\s+/);
        let baseCode = '';
        
        if (words.length === 1) {
          // Single word: take first 2-3 characters
          baseCode = words[0].substring(0, 3).toUpperCase();
        } else {
          // Multiple words: take first letter of each word (max 4)
          baseCode = words
            .slice(0, 4)
            .map(word => word.charAt(0).toUpperCase())
            .join('');
        }

        console.log('🔍 Base code generated:', baseCode);

        // Ensure uniqueness by adding numbers if needed
        let finalCode = baseCode;
        let counter = 1;
        
        while (await Company.findOne({ where: { companyCode: finalCode } })) {
          counter++;
          finalCode = `${baseCode}${counter}`;
          console.log('🔍 Code exists, trying:', finalCode);
        }
        
        console.log('🔍 Final company code:', finalCode);
        instance.companyCode = finalCode;
      }
    } catch (error) {
      console.error('❌ Error generating company code:', error);
      throw error;
    }
  }
}
