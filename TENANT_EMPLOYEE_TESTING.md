# 🧪 **Complete Tenant-Aware Employee Creation Testing Guide**

## 🎯 **Testing Flow: Company Admin Creates Employees**

### **Prerequisites**
1. ✅ Database has `tenantId` columns in `users` and `employees` tables
2. ✅ Company and Company Admin already created
3. ✅ Backend server running on port 4000

---

## **Step 1: Company Admin Login**

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "adminnew@hiteshi.com",
    "password": "admin123"
  }'
```

**Expected Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "7c1b0419-79a7-4f96-aa17-db7dc27ca4e3",
    "email": "adminnew@hiteshi.com",
    "role": "admin",
    "tenantId": "b59f5eca-6ca0-4cdb-99e6-59c025aab176",
    "companyCode": "HN",
    "employeeId": "HN_EMP001"
  }
}
```

---

## **Step 2: Create HR Employee**

```bash
curl -X POST http://localhost:4000/api/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_COMPANY_ADMIN_TOKEN" \
  -d '{
    "name": "HR Manager",
    "email": "hr@hiteshi.com",
    "phone": "+1234567891",
    "department": "Human Resources",
    "designation": "HR Manager",
    "joiningDate": "2025-09-19",
    "status": "active",
    "salary": 60000
  }'
```

**Expected Response:**
```json
{
  "id": "uuid-here",
  "employeeId": "HN_EMP002",
  "name": "HR Manager",
  "email": "hr@hiteshi.com",
  "tenantId": "b59f5eca-6ca0-4cdb-99e6-59c025aab176",
  "department": "Human Resources",
  "designation": "HR Manager",
  "status": "active",
  "temporaryPassword": "Hr@123"
}
```

---

## **Step 3: List Company Employees (Tenant-Filtered)**

```bash
curl -X GET http://localhost:4000/api/employees \
  -H "Authorization: Bearer YOUR_COMPANY_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "rows": [
    {
      "employeeId": "HN_EMP002",
      "name": "HR Manager",
      "tenantId": "b59f5eca-6ca0-4cdb-99e6-59c025aab176",
      "company": {
        "name": "Hiteshi Infotech",
        "companyCode": "HN"
      }
    },
    {
      "employeeId": "HN_EMP001",
      "name": "Admin User",
      "tenantId": "b59f5eca-6ca0-4cdb-99e6-59c025aab176",
      "company": {
        "name": "Hiteshi Infotech",
        "companyCode": "HN"
      }
    }
  ],
  "count": 2
}
```

---

## **✅ Key Validations**

### **Employee ID Generation:**
- ✅ Pattern: `{CompanyCode}_EMP{Number}`
- ✅ Sequential numbering per company
- ✅ Company-specific prefixes (HN_EMP001, HN_EMP002)

### **Tenant Isolation:**
- ✅ All employees have same `tenantId` as admin
- ✅ Only company's employees visible in list
- ✅ Cross-tenant data isolation

### **User Account Creation:**
- ✅ User record created with same `tenantId`
- ✅ Role derived from department
- ✅ Temporary password generated

### **Database Integrity:**
- ✅ Foreign key relationships maintained
- ✅ Proper UUID handling
- ✅ Tenant-aware queries working

---

## **🎉 Success Criteria**

1. **Employee Creation**: Returns 201 with tenant-aware employee ID
2. **User Creation**: Auto-creates user with matching tenantId
3. **List Filtering**: Only shows company's employees
4. **Role Assignment**: Correct role based on department
5. **Password Generation**: Temporary password from first name

**If all tests pass, your tenant-aware employee system is working perfectly!** 🚀
