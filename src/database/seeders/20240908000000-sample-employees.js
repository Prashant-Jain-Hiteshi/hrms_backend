const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const departments = ['Engineering', 'Product', 'Design', 'Marketing', 'Sales', 'HR', 'Finance'];
const designations = [
  'Software Engineer', 'Senior Software Engineer', 'Tech Lead', 'Product Manager',
  'UI/UX Designer', 'Marketing Specialist', 'Sales Executive', 'HR Manager',
  'Financial Analyst', 'DevOps Engineer', 'QA Engineer', 'Project Manager'
];

const generateRandomDate = (start, end) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const generateEmployees = (count = 20) => {
  const employees = [];
  const firstNames = ['John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'Robert', 'Lisa', 'James', 'Jennifer'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson'];

  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const department = departments[Math.floor(Math.random() * departments.length)];
    const designation = designations[Math.floor(Math.random() * designations.length)];
    
    // Generate realistic salary based on role
    let baseSalary;
    if (designation.includes('Senior') || designation.includes('Lead') || designation.includes('Manager')) {
      baseSalary = 80000 + Math.floor(Math.random() * 50000);
    } else {
      baseSalary = 45000 + Math.floor(Math.random() * 40000);
    }

    employees.push({
      id: uuidv4(),
      employeeId: `EMP${1000 + i}`,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`,
      phone: `+1${Math.floor(2000000000 + Math.random() * 8000000000)}`,
      address: `${Math.floor(100 + Math.random() * 900)} ${['Main', 'Oak', 'Pine', 'Maple', 'Cedar'][Math.floor(Math.random() * 5)]} St, City, Country`,
      department,
      designation,
      salary: baseSalary,
      joiningDate: generateRandomDate(new Date(2018, 0, 1), new Date(2023, 0, 1)),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  return employees;
};

const generatePayrolls = (employees) => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  const payrolls = [];
  const statuses = ['PENDING', 'PROCESSED', 'PAID'];
  
  employees.forEach(employee => {
    // Generate payroll for current month
    const payPeriodStart = new Date(currentYear, currentMonth, 1);
    const payPeriodEnd = new Date(currentYear, currentMonth + 1, 0);
    
    // Calculate allowances and deductions (10-30% of basic salary)
    const basicSalary = employee.salary;
    const allowances = Math.round(basicSalary * (0.1 + Math.random() * 0.2));
    const deductions = Math.round(basicSalary * (0.05 + Math.random() * 0.1));
    const netSalary = basicSalary + allowances - deductions;
    
    payrolls.push({
      id: uuidv4(),
      employeeId: employee.id,
      payPeriodStart,
      payPeriodEnd,
      basicSalary,
      allowances,
      deductions,
      netSalary,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Generate payroll for previous month (for testing)
    const prevMonthPayPeriodStart = new Date(currentYear, currentMonth - 1, 1);
    const prevMonthPayPeriodEnd = new Date(currentYear, currentMonth, 0);
    
    payrolls.push({
      id: uuidv4(),
      employeeId: employee.id,
      payPeriodStart: prevMonthPayPeriodStart,
      payPeriodEnd: prevMonthPayPeriodEnd,
      basicSalary: basicSalary,
      allowances: Math.round(allowances * (0.9 + Math.random() * 0.2)), // Slightly different allowances
      deductions: Math.round(deductions * (0.9 + Math.random() * 0.2)), // Slightly different deductions
      netSalary: basicSalary + allowances - deductions,
      status: 'PAID',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });
  
  return payrolls;
};

// Export the functions for direct use in our custom seeder script
module.exports = {
  generateEmployees,
  generatePayrolls,
  
  // Keep the original exports for backward compatibility
  up: async (queryInterface, Sequelize) => {
    const employees = generateEmployees(20);
    if (queryInterface.bulkInsert) {
      await queryInterface.bulkInsert('employees', employees, {});
      const payrolls = generatePayrolls(employees);
      await queryInterface.bulkInsert('payrolls', payrolls, {});
    }
  },
  
  down: async (queryInterface, Sequelize) => {
    if (queryInterface.bulkDelete) {
      await queryInterface.bulkDelete('payrolls', null, {});
      await queryInterface.bulkDelete('employees', null, {});
    }
  }
};
