import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Add tenant_id to users table
  await queryInterface.addColumn('users', 'tenantId', {
    type: DataTypes.UUID,
    allowNull: true, // Nullable initially for existing data
    references: {
      model: 'companies',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  });

  // Add tenant_id to employees table
  await queryInterface.addColumn('employees', 'tenantId', {
    type: DataTypes.UUID,
    allowNull: true, // Nullable initially for existing data
    references: {
      model: 'companies',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  });

  // Add tenant_id to attendance table
  await queryInterface.addColumn('attendance', 'tenantId', {
    type: DataTypes.UUID,
    allowNull: true, // Nullable initially for existing data
    references: {
      model: 'companies',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  });

  // Add tenant_id to leave_requests table
  await queryInterface.addColumn('leave_requests', 'tenantId', {
    type: DataTypes.UUID,
    allowNull: true, // Nullable initially for existing data
    references: {
      model: 'companies',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  });

  // Add tenant_id to leave_approvers table
  await queryInterface.addColumn('leave_approvers', 'tenantId', {
    type: DataTypes.UUID,
    allowNull: true, // Nullable initially for existing data
    references: {
      model: 'companies',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  });

  // Add tenant_id to leave_cc table
  await queryInterface.addColumn('leave_cc', 'tenantId', {
    type: DataTypes.UUID,
    allowNull: true, // Nullable initially for existing data
    references: {
      model: 'companies',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  });

  // Add tenant_id to leave_status_history table
  await queryInterface.addColumn('leave_status_history', 'tenantId', {
    type: DataTypes.UUID,
    allowNull: true, // Nullable initially for existing data
    references: {
      model: 'companies',
      key: 'id',
    },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  });

  // Add indexes for better query performance
  await queryInterface.addIndex('users', ['tenantId']);
  await queryInterface.addIndex('employees', ['tenantId']);
  await queryInterface.addIndex('attendance', ['tenantId']);
  await queryInterface.addIndex('leave_requests', ['tenantId']);
  await queryInterface.addIndex('leave_approvers', ['tenantId']);
  await queryInterface.addIndex('leave_cc', ['tenantId']);
  await queryInterface.addIndex('leave_status_history', ['tenantId']);

  console.log('✅ Added tenant_id columns to all tables');
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  // Remove indexes first
  await queryInterface.removeIndex('users', ['tenantId']);
  await queryInterface.removeIndex('employees', ['tenantId']);
  await queryInterface.removeIndex('attendance', ['tenantId']);
  await queryInterface.removeIndex('leave_requests', ['tenantId']);
  await queryInterface.removeIndex('leave_approvers', ['tenantId']);
  await queryInterface.removeIndex('leave_cc', ['tenantId']);
  await queryInterface.removeIndex('leave_status_history', ['tenantId']);

  // Remove columns
  await queryInterface.removeColumn('users', 'tenantId');
  await queryInterface.removeColumn('employees', 'tenantId');
  await queryInterface.removeColumn('attendance', 'tenantId');
  await queryInterface.removeColumn('leave_requests', 'tenantId');
  await queryInterface.removeColumn('leave_approvers', 'tenantId');
  await queryInterface.removeColumn('leave_cc', 'tenantId');
  await queryInterface.removeColumn('leave_status_history', 'tenantId');

  console.log('✅ Removed tenant_id columns from all tables');
}
