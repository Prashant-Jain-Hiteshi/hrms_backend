
import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('companies', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    companyCode: {
      type: DataTypes.STRING(10),
      allowNull: true, // Allow null initially, will be set by application
      unique: true,
      comment: 'Auto-generated unique code from company name (e.g., HI, AC, AC2)',
    },
    status: {
      type: DataTypes.ENUM('active', 'suspended', 'trial', 'expired'),
      allowNull: false,
      defaultValue: 'active',
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    logoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  // Add indexes for better query performance
  await queryInterface.addIndex('companies', ['companyCode']);
  await queryInterface.addIndex('companies', ['status']);
  await queryInterface.addIndex('companies', ['name']);
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('companies');
}
