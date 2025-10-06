# 🔧 Expense Reimbursement Setup Guide

## 🚨 **Current Issue: 404 Error**

The frontend is getting a 404 error when calling `/api/expense/reimbursements/my-requests`. Here's how to debug and fix:

## 🔍 **Step 1: Check Backend Server**

1. **Ensure backend is running:**
   ```bash
   cd hrm_backend
   npm run start:dev
   ```

2. **Check console for errors:**
   - Look for any module loading errors
   - Verify expense module is loaded
   - Check database connection

## 🔍 **Step 2: Verify Database Tables**

1. **Set DB_SYNC=true in .env:**
   ```env
   DB_SYNC=true
   ```

2. **Restart backend** to create tables:
   - `expense_categories`
   - `expense_reimbursements`

3. **Check database:**
   ```sql
   -- Connect to your PostgreSQL database
   \dt expense*
   
   -- Should show:
   -- expense_categories
   -- expense_reimbursements
   ```

## 🔍 **Step 3: Create Expense Categories**

**Categories are required for the system to work!**

### **Option A: Via API (Postman/curl)**

```bash
# Login first to get token
POST http://localhost:3000/api/auth/login
{
  "email": "admin@company.com",
  "password": "your_password"
}

# Create categories (use the token from login)
POST http://localhost:3000/api/expense/categories
Authorization: Bearer YOUR_JWT_TOKEN
{
  "categoryName": "Travel",
  "description": "Travel and transportation expenses",
  "autoApprovalPercent": 70,
  "isActive": true
}

POST http://localhost:3000/api/expense/categories
Authorization: Bearer YOUR_JWT_TOKEN
{
  "categoryName": "Meals & Entertainment",
  "description": "Business meals and entertainment",
  "autoApprovalPercent": 80,
  "isActive": true
}

POST http://localhost:3000/api/expense/categories
Authorization: Bearer YOUR_JWT_TOKEN
{
  "categoryName": "Office Supplies",
  "description": "Office equipment and supplies",
  "autoApprovalPercent": 90,
  "isActive": true
}

POST http://localhost:3000/api/expense/categories
Authorization: Bearer YOUR_JWT_TOKEN
{
  "categoryName": "Training & Development",
  "description": "Professional development and training",
  "autoApprovalPercent": 100,
  "isActive": true
}
```

### **Option B: Direct Database Insert**

```sql
-- Connect to your database and run:
INSERT INTO expense_categories (id, "tenantId", "categoryName", description, "autoApprovalPercent", "isActive", "createdAt", "updatedAt") VALUES
(gen_random_uuid(), 'your-tenant-id', 'Travel', 'Travel and transportation expenses', 70, true, NOW(), NOW()),
(gen_random_uuid(), 'your-tenant-id', 'Meals & Entertainment', 'Business meals and entertainment', 80, true, NOW(), NOW()),
(gen_random_uuid(), 'your-tenant-id', 'Office Supplies', 'Office equipment and supplies', 90, true, NOW(), NOW()),
(gen_random_uuid(), 'your-tenant-id', 'Training & Development', 'Professional development and training', 100, true, NOW(), NOW());
```

## 🔍 **Step 4: Test API Endpoints**

### **Test Categories Endpoint:**
```bash
GET http://localhost:3000/api/expense/categories/active
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Active expense categories retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "categoryName": "Travel",
      "description": "Travel and transportation expenses",
      "autoApprovalPercent": 70,
      "isActive": true
    }
  ]
}
```

### **Test My Requests Endpoint:**
```bash
GET http://localhost:3000/api/expense/reimbursements/my-requests
Authorization: Bearer YOUR_JWT_TOKEN
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Employee reimbursements retrieved successfully",
  "data": []
}
```

## 🔍 **Step 5: Check Authentication**

1. **Verify JWT token in browser:**
   - Open DevTools → Application → Local Storage
   - Check for `hrms_token` key
   - Token should be valid and not expired

2. **Check user role:**
   - Employee, HR, Finance, or Admin roles should work
   - Check `hrms_user` in localStorage

## 🔍 **Step 6: Debug Frontend**

1. **Open browser DevTools → Network tab**
2. **Try to access expenses page**
3. **Check the API calls:**
   - Status codes
   - Request headers (Authorization)
   - Response bodies

## ⚡ **Quick Fix Commands**

```bash
# 1. Restart backend with DB sync
cd hrm_backend
echo "DB_SYNC=true" >> .env
npm run start:dev

# 2. Check if server is running
curl http://localhost:3000/api/auth/health

# 3. Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your_email","password":"your_password"}'
```

## 🎯 **Expected File Structure**

```
hrm_backend/src/modules/expense/
├── controllers/
│   ├── expense-category.controller.ts ✅
│   └── expense-reimbursement.controller.ts ✅
├── services/
│   ├── expense-category.service.ts ✅
│   └── expense-reimbursement.service.ts ✅
├── models/
│   ├── expense-category.model.ts ✅
│   └── expense-reimbursement.model.ts ✅
├── dto/ ✅
└── expense.module.ts ✅
```

## 🚀 **Once Fixed, You Should See:**

1. **Categories loaded** in the dropdown
2. **Empty requests table** (initially)
3. **Apply for Reimbursement** button working
4. **Real-time calculation** when selecting category and amount

---

**Most likely issue: Missing expense categories in database!**
**Create categories first, then test the frontend.**
