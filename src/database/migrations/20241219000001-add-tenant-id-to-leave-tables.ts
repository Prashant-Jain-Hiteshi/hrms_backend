import { QueryInterface, DataTypes } from 'sequelize';

export default {
  async up(queryInterface: QueryInterface): Promise<void> {
    console.log('🔄 Adding tenantId to all HRMS tables (leave, attendance, payroll)...');

    // Add tenantId to leave_types table
    await queryInterface.addColumn('leave_types', 'tenantId', {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add tenantId to leave_credit_configs table
    await queryInterface.addColumn('leave_credit_configs', 'tenantId', {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add tenantId to holidays table
    await queryInterface.addColumn('holidays', 'tenantId', {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add tenantId to weekend_settings table
    await queryInterface.addColumn('weekend_settings', 'tenantId', {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add tenantId to leave_requests table
    await queryInterface.addColumn('leave_requests', 'tenantId', {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add tenantId to compensatory_leaves table
    await queryInterface.addColumn('compensatory_leaves', 'tenantId', {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add tenantId to attendance table
    await queryInterface.addColumn('attendance', 'tenantId', {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add tenantId to attendance_sessions table
    await queryInterface.addColumn('attendance_sessions', 'tenantId', {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Add tenantId to payrolls table
    await queryInterface.addColumn('payrolls', 'tenantId', {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    // Remove unique constraint on leave_credit_configs.leaveType (now tenant-scoped)
    await queryInterface.removeConstraint('leave_credit_configs', 'leave_credit_configs_leaveType_key');

    // Add composite unique constraint for tenant + leaveType
    await queryInterface.addConstraint('leave_credit_configs', {
      fields: ['tenantId', 'leaveType'],
      type: 'unique',
      name: 'leave_credit_configs_tenant_leave_type_unique',
    });

    console.log('✅ Successfully added tenantId to all HRMS tables (leave, attendance, payroll)');
  },

  async down(queryInterface: QueryInterface): Promise<void> {
    console.log('🔄 Removing tenantId from all HRMS tables (leave, attendance, payroll)...');

    // Remove composite unique constraint
    await queryInterface.removeConstraint('leave_credit_configs', 'leave_credit_configs_tenant_leave_type_unique');

    // Restore original unique constraint
    await queryInterface.addConstraint('leave_credit_configs', {
      fields: ['leaveType'],
      type: 'unique',
      name: 'leave_credit_configs_leaveType_key',
    });

    // Remove tenantId columns
    await queryInterface.removeColumn('payrolls', 'tenantId');
    await queryInterface.removeColumn('attendance_sessions', 'tenantId');
    await queryInterface.removeColumn('attendance', 'tenantId');
    await queryInterface.removeColumn('compensatory_leaves', 'tenantId');
    await queryInterface.removeColumn('leave_requests', 'tenantId');
    await queryInterface.removeColumn('weekend_settings', 'tenantId');
    await queryInterface.removeColumn('holidays', 'tenantId');
    await queryInterface.removeColumn('leave_credit_configs', 'tenantId');
    await queryInterface.removeColumn('leave_types', 'tenantId');

    console.log('✅ Successfully removed tenantId from all HRMS tables (leave, attendance, payroll)');
  },
};
