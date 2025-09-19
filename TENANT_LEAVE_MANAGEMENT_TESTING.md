# 🧪 **Tenant-Aware Leave Management Testing Guide**

## 🎯 **Complete Testing Flow for Multi-Tenant Leave System**

### **Prerequisites**
1. ✅ Database migration applied: `20241219000001-add-tenant-id-to-leave-tables.ts`
2. ✅ Company and Company Admin already created
3. ✅ Backend server running on port 4000
4. ✅ Employees created with tenant context

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

**📋 Copy the `access_token` for all subsequent requests**

---

## **Step 2: Leave Types Management (Tenant-Isolated)**

### **2.1: Create Company-Specific Leave Types**

```bash
# Create Annual Leave Type
curl -X POST http://localhost:4000/api/leave-types \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Annual Leave",
    "numberOfLeaves": 20,
    "description": "Yearly vacation leave",
    "requiresApproval": true,
    "carryForward": true,
    "encashment": false,
    "eligibility": "all"
  }'
```

```bash
# Create Sick Leave Type
curl -X POST http://localhost:4000/api/leave-types \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Sick Leave",
    "numberOfLeaves": 12,
    "description": "Medical leave for illness",
    "requiresApproval": false,
    "carryForward": false,
    "encashment": false,
    "eligibility": "all"
  }'
```

**Expected Response:**
```json
{
  "id": 1,
  "name": "Annual Leave",
  "numberOfLeaves": 20,
  "tenantId": "b59f5eca-6ca0-4cdb-99e6-59c025aab176",
  "description": "Yearly vacation leave",
  "requiresApproval": true,
  "carryForward": true,
  "encashment": false,
  "eligibility": "all",
  "isActive": true,
  "company": {
    "name": "Hiteshi Infotech",
    "companyCode": "HN"
  }
}
```

### **2.2: List Company's Leave Types (Tenant-Filtered)**

```bash
curl -X GET http://localhost:4000/api/leave-types \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
[
  {
    "id": 1,
    "name": "Annual Leave",
    "tenantId": "b59f5eca-6ca0-4cdb-99e6-59c025aab176",
    "company": {
      "name": "Hiteshi Infotech",
      "companyCode": "HN"
    }
  },
  {
    "id": 2,
    "name": "Sick Leave",
    "tenantId": "b59f5eca-6ca0-4cdb-99e6-59c025aab176",
    "company": {
      "name": "Hiteshi Infotech",
      "companyCode": "HN"
    }
  }
]
```

### **2.3: Search Leave Types (Tenant-Scoped)**

```bash
curl -X GET "http://localhost:4000/api/leave-types?search=annual" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### **2.4: Update Leave Type (Tenant-Aware)**

```bash
curl -X PUT http://localhost:4000/api/leave-types/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Annual Vacation Leave",
    "numberOfLeaves": 25,
    "description": "Updated yearly vacation leave"
  }'
```

---

## **Step 3: Company Holidays Management**

### **3.1: Create Company-Specific Holidays**

```bash
# Create New Year Holiday
curl -X POST http://localhost:4000/api/calendar/holidays \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "date": "2025-01-01",
    "name": "New Year Day",
    "type": "public"
  }'
```

```bash
# Create Company Foundation Day
curl -X POST http://localhost:4000/api/calendar/holidays \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "date": "2025-03-15",
    "name": "Hiteshi Foundation Day",
    "type": "restricted"
  }'
```

### **3.2: List Company Holidays (Tenant-Filtered)**

```bash
curl -X GET http://localhost:4000/api/calendar/holidays \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## **Step 4: Weekend Settings (Company-Specific)**

### **4.1: Set Company Weekend Policy**

```bash
curl -X POST http://localhost:4000/api/calendar/weekend-settings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "weekends": [0, 6]
  }'
```

**Note:** `[0, 6]` = Sunday and Saturday as weekends

### **4.2: Update Weekend Settings**

```bash
curl -X PUT http://localhost:4000/api/calendar/weekend-settings/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "weekends": [5, 6]
  }'
```

**Note:** `[5, 6]` = Friday and Saturday as weekends (Middle East style)

---

## **Step 5: Leave Credit Configuration (Tenant-Specific Policies)**

### **5.1: Configure Monthly Leave Credits**

```bash
# Configure Annual Leave Credits
curl -X POST http://localhost:4000/api/leave/credit-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "leaveType": "annual",
    "monthlyCredit": 1.67,
    "maxAnnualLimit": 20,
    "description": "Monthly annual leave credit"
  }'
```

```bash
# Configure Sick Leave Credits
curl -X POST http://localhost:4000/api/leave/credit-config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "leaveType": "sick",
    "monthlyCredit": 1.0,
    "maxAnnualLimit": 12,
    "description": "Monthly sick leave credit"
  }'
```

### **5.2: List Credit Configurations (Tenant-Filtered)**

```bash
curl -X GET http://localhost:4000/api/leave/credit-config \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## **Step 6: Tenant Isolation Verification**

### **6.1: Create Second Company and Test Isolation**

```bash
# Super Admin creates another company
curl -X POST http://localhost:4000/api/super-admin/companies \
  -H "Authorization: Bearer SUPER_ADMIN_TOKEN" \
  -d '{
    "name": "Acme Corporation",
    "address": "456 Business Ave",
    "phone": "+9876543210",
    "email": "info@acme.com"
  }'

# Create admin for Acme Corp and login
# Then create leave types for Acme Corp
curl -X POST http://localhost:4000/api/leave-types \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ACME_ADMIN_TOKEN" \
  -d '{
    "name": "Acme Annual Leave",
    "numberOfLeaves": 15,
    "description": "Acme company annual leave"
  }'
```

### **6.2: Verify Cross-Tenant Isolation**

```bash
# Hiteshi Admin should NOT see Acme's leave types
curl -X GET http://localhost:4000/api/leave-types \
  -H "Authorization: Bearer HITESHI_ADMIN_TOKEN"

# Acme Admin should NOT see Hiteshi's leave types
curl -X GET http://localhost:4000/api/leave-types \
  -H "Authorization: Bearer ACME_ADMIN_TOKEN"
```

---

## **✅ Success Criteria**

### **Leave Types Management:**
- ✅ **Creation**: Returns 201 with tenant-specific leave type
- ✅ **Listing**: Only shows company's leave types
- ✅ **Search**: Searches within company scope only
- ✅ **Update**: Only updates company's leave types
- ✅ **Delete**: Only deletes company's leave types

### **Holiday Management:**
- ✅ **Company Holidays**: Each company has separate holiday calendar
- ✅ **Tenant Isolation**: Company A cannot see Company B's holidays

### **Weekend Settings:**
- ✅ **Company-Specific**: Each company can set different weekend policies
- ✅ **Flexibility**: Support for different cultural weekend patterns

### **Leave Credit Configuration:**
- ✅ **Policy Isolation**: Each company has separate leave credit policies
- ✅ **Flexible Configuration**: Different monthly credits per company

### **Database Integrity:**
- ✅ **Foreign Keys**: All leave tables properly linked to tenantId
- ✅ **Constraints**: Unique constraints scoped to tenant
- ✅ **Cascading**: Proper cleanup when company is deleted

---

## **🎉 Expected Results Summary**

1. **✅ Complete Tenant Isolation**: Each company manages only their leave policies
2. **✅ Flexible Leave Types**: Companies can create custom leave types
3. **✅ Company-Specific Holidays**: Separate holiday calendars per company
4. **✅ Custom Weekend Policies**: Different weekend patterns per company
5. **✅ Independent Credit Policies**: Separate leave credit configurations
6. **✅ Data Security**: No cross-tenant data leakage

**If all tests pass, your tenant-aware leave management system is production-ready!** 🚀

---

## **🔧 Troubleshooting**

### **Common Issues:**
1. **Missing tenantId in JWT**: Re-login to get updated token
2. **Database Migration**: Ensure migration is applied
3. **Foreign Key Errors**: Check Company model associations
4. **Permission Errors**: Verify admin role and tenant context

### **Debug Commands:**
```bash
# Check JWT token payload
echo "YOUR_TOKEN" | base64 -d

# Verify database schema
psql -d your_db -c "\d leave_types"
```
