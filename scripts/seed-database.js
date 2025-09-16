require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');

// Database configuration
const config = {
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'hrm',
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  logging: false,
};

// Initialize Sequelize
const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
    port: config.port,
    logging: config.logging,
  }
);

// Define Employee model
const Employee = sequelize.define('Employee', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  employeeId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  department: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  designation: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  salary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  joiningDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
    allowNull: false,
  },
}, {
  tableName: 'employees',
  timestamps: true,
});

// Define Payroll model
const Payroll = sequelize.define('Payroll', {
  id: {
    type: DataTypes.UUID,
    primaryKey: true,
    defaultValue: DataTypes.UUIDV4,
  },
  payPeriodStart: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  payPeriodEnd: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  basicSalary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  allowances: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  deductions: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  netSalary: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PROCESSED', 'PAID', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'PENDING',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'payrolls',
  timestamps: true,
});

// Define associations
Employee.hasMany(Payroll, { foreignKey: 'employeeId' });
Payroll.belongsTo(Employee, { foreignKey: 'employeeId' });

// Import sample data generators
const { generateEmployees, generatePayrolls } = require('../src/database/seeders/20240908000000-sample-employees');

const runSeeder = async () => {
  try {
    console.log('Starting database seeding...');
    
    // Authenticate with the database
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Sync all models
    await sequelize.sync({ force: true });
    console.log('Database synchronized.');
    
    // Generate sample data
    const employees = generateEmployees(20);
    const payrolls = generatePayrolls(employees);
    
    // Insert data
    await Employee.bulkCreate(employees);
    console.log(`Inserted ${employees.length} employees.`);
    
    await Payroll.bulkCreate(payrolls);
    console.log(`Inserted ${payrolls.length} payroll records.`);
    
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

runSeeder();
