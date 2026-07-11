# POS System - API Documentation

**Base URL:** `https://api-bisa-nota.vercel.app`
**Auth:** `Authorization: Bearer <JWT_TOKEN>` header
**Roles:** `super_admin`, `admin`, `user`
**Content-Type:** `application/json` (unless stated otherwise)

---

## Auth

### POST `/auth/login`
No auth required.
```json
{
  "userName": "string (required)",
  "password": "string (required)"
}
```

### POST `/auth/register`
No auth required.
```json
{
  "userName": "string (required)",
  "password": "string (required, min 6 chars)",
  "confirmPassword": "string (required)",
  "email": "string (optional)",
  "userType": "admin | user (default: user)",
  "fullName": "string (optional)",
  "phoneNumber": "string (optional)",
  "gender": "string (optional)",
  "address": "string (optional)",
  "dateOfBirth": "string (optional, ISO date)",
  "placeOfBirth": "string (optional)",
  "store": "number (optional)",
  "shift": "number (optional)",
  "position": "number (optional)"
}
```

### POST `/auth/reset-password`
No auth required.
```json
{
  "email": "string (optional)",
  "userName": "string (optional)"
}
```

### POST `/auth/logout`
Auth required.

### GET `/auth/get-user`
Auth required.

### GET `/auth/get-all-user`
Auth required (super_admin).

### GET `/auth/generate-employee-id`
Auth required.

### PUT `/auth/change-profile-user`
Auth required (super_admin).
```json
{
  "userId": "number (required)",
  "roleId": "number (required)"
}
```

### PUT `/auth/edit-user`
Auth required.
```json
{
  "id": "number (required)",
  "fullName": "string (optional)",
  "phoneNumber": "string (optional)",
  "email": "string (optional)",
  "gender": "string (optional)",
  "address": "string (optional)",
  "dateOfBirth": "string (optional)",
  "password": "string (optional, min 6)",
  "confirmPassword": "string (optional)",
  "avatar": "string (optional)"
}
```

---

## Product

### GET `/product/get-product`
Auth required. Query: `store`, `nameProduct`, `category`, `page`, `limit`.

### GET `/product/get-product-by-super-admin`
Auth required. Query: `page`, `limit`, `search`, `store`.

### GET `/product/get-product-all`
Auth required. Query: `page`, `limit`, `search`, `store`, `category`.

### GET `/product/get-by-id/:id`
Auth required (super_admin/admin).

### POST `/product/add-product`
Auth required (super_admin/admin). Content-Type: `multipart/form-data`.
```json
{
  "nameProduct": "string (required)",
  "category": "number (required)",
  "status": "active | inactive | draft (default: active)",
  "description": "string (optional)",
  "price": "number (default: 0)",
  "costPrice": "number (default: 0)",
  "stock": "number (default: 0)",
  "minStock": "number (default: 0)",
  "unit": "string (default: pcs)",
  "baseUnit": "string (default: pcs)",
  "conversionFactor": "string (default: 1)",
  "point": "number (default: 0)",
  "barcode": "string (optional)",
  "brand": "string (optional)",
  "hasModifiers": "boolean (default: false)",
  "modifiers": "JSON array (default: [])",
  "isOption": "boolean (default: false)",
  "options": "JSON array (default: [])",
  "isAvailable": "boolean (default: true)",
  "stores": "array of numbers (optional)",
  "supplier": "number (optional)",
  "tax": "JSON object (optional)",
  "priceTiers": "JSON array (default: [])",
  "currencyId": "number (optional)",
  "currencyCode": "string (optional)",
  "tipeProduk": "string (default: menu)",
  "composition": "JSON array (default: [])",
  "redeemPoints": "number (default: 0)",
  "image": "file (optional)"
}
```

### PUT `/product/edit-product`
Auth required (super_admin/admin). Content-Type: `multipart/form-data`. Same fields as add, all optional.

### DELETE `/product/delete-product/:id`
Auth required (super_admin/admin).

### GET `/product/template`
Auth required. Returns Excel template.

### GET `/product/download`
Auth required. Returns Excel data.

### POST `/product/import`
Auth required. Content-Type: `multipart/form-data`. Field: `file` (Excel).

---

## Category

### GET `/category/get-category-all`
Auth required. Query: `page`, `limit`, `search`.

### GET `/category/get-category/:id`
Auth required.

### POST `/category/add-new-category`
Auth required (super_admin/admin).
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "image": "string (optional)",
  "icon": "string (optional)",
  "status": "active | inactive | draft (default: active)",
  "store": "array of numbers (optional)"
}
```

### PUT `/category/edit-category/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/category/delete-category/:id`
Auth required (super_admin/admin).

### GET `/category/download-template`, GET `/category/download`, POST `/category/upload-excel`
Auth required (super_admin/admin). Import uses multipart/form-data with `file` field.

---

## Location (Store)

### GET `/location/get-location-public`
No auth. Returns active locations.

### GET `/location/get-location-all`
Auth required (super_admin). Query: `page`, `limit`, `search`.

### GET `/location/get-location-detail/:locationId`
Auth required.

### GET `/location/generate-id`
Auth required (super_admin). Returns generated location ID.

### POST `/location/add-new-location`
Auth required (super_admin).
```json
{
  "name": "string (required)",
  "address": "string (optional)",
  "detailLocation": "string (optional)",
  "city": "string (optional)",
  "province": "string (optional)",
  "district": "string (optional)",
  "village": "string (optional)",
  "postalCode": "string (optional)",
  "latitude": "string (optional)",
  "longitude": "string (optional)",
  "mainBranch": "boolean (default: false)",
  "description": "string (optional)",
  "openingHours": "JSON object (optional)",
  "managerName": "string (optional)",
  "email": "string (optional)",
  "phoneNumber": "string (optional)",
  "category": "string (optional)",
  "status": "active | inactive | draft (default: active)",
  "socialMedia": "JSON object (optional)",
  "dailyTarget": "number (default: 0)",
  "image": "string (optional)"
}
```

### PUT `/location/edit-location`
Auth required (super_admin). Same fields, all optional.

### DELETE `/location/delete-location`
Auth required (super_admin).

---

## Member

### GET `/member/get-member`
Auth required. Query: `page`, `limit`, `search`, `tier`, `status`, `sortBy`, `store`.

### GET `/member/get-member/:id`
Auth required.

### POST `/member/add-new-member`
Auth required (super_admin/admin).
```json
{
  "nameMember": "string (required)",
  "phoneNumber": "string (optional)",
  "email": "string (optional)",
  "point": "number (default: 0)",
  "tier": "number (optional)",
  "birthDate": "string (optional)",
  "gender": "string (optional)",
  "address": "string (optional)",
  "store": "number (optional)",
  "status": "string (default: active)"
}
```

### PUT `/member/edit-member/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/member/delete-member/:id`
Auth required (super_admin/admin).

### PUT `/member/edit-point-member/:phoneNumber`
Auth required.
```json
{
  "point": "number (required)"
}
```

---

## Member Tier

### GET `/member-tier/get-all`
Auth required.

### GET `/member-tier/detail/:id`
Auth required.

### GET `/member-tier/get-by-points`
Auth required. Query: `points`.

### POST `/member-tier/add`
Auth required (super_admin/admin).
```json
{
  "name": "string (required)",
  "minPoints": "number (default: 0)",
  "maxPoints": "number (optional)",
  "discountPercent": "number (default: 0)",
  "benefits": "string (default: '')"
}
```

### PUT `/member-tier/edit/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/member-tier/delete/:id`
Auth required (super_admin/admin).

### POST `/member-tier/update-members`
Auth required (super_admin/admin).

---

## Order

### POST `/order/create`
Auth required.
```json
{
  "store": "number (required)",
  "tableId": "number (optional)",
  "customerId": "number (optional)",
  "customerName": "string (optional)",
  "customerPhone": "string (optional)",
  "items": [
    {
      "product": "number (required)",
      "quantity": "number (required)",
      "price": "number (default: 0)",
      "notes": "string (default: '')",
      "modifiers": "array (default: [])",
      "variant": "string (optional)"
    }
  ],
  "discountId": "number (optional)",
  "promoCode": "string (optional)",
  "discountType": "none | percent | nominal (default: none)",
  "discountValue": "number (default: 0)",
  "notes": "string (default: '')",
  "source": "pos | online | qr | waiter (default: pos)",
  "cashierId": "number (optional)",
  "cashierName": "string (optional)",
  "shiftId": "number (optional)",
  "paymentMethod": "cash | qris | debit | credit | other | points | transfer (optional)"
}
```

### GET `/order/get-orders`
Auth required. Query: `store`, `page`, `limit`, `status`.

### GET `/order/get-order/:id`
Auth required.

### GET `/order/kitchen`
Auth required. Query: `store`.

### PUT `/order/update-status`
Auth required.
```json
{
  "id": "number (required)",
  "status": "pending | confirmed | preparing | ready | served | paid | cancelled | void (required)",
  "notes": "string (default: '')"
}
```

### PUT `/order/update-item-status`
Auth required.
```json
{
  "id": "number (required)",
  "itemId": "number (required)",
  "itemStatus": "string (required)"
}
```

### GET `/order/customer-menu`
No auth. Query: `store`.

### GET `/order/customer-member`
No auth. Query: `phone`.

### GET `/order/customer-order/:id`
No auth.

### POST `/order/customer-create`
No auth. Same structure as `/order/create`.

### GET `/order/receipt-html/:id`
No auth.

---

## Checkout

### POST `/checkout/checkout-item`
Auth required (super_admin/admin).
```json
{
  "idCustomer": "number (optional)",
  "discountId": "number (optional)",
  "paymentMethod": "string (required)",
  "paymentAmount": "number (required)",
  "notes": "string (default: '')",
  "items": [
    {
      "idProduct": "number (required)",
      "qty": "number (required)",
      "price": "number (optional)",
      "notes": "string (default: '')"
    }
  ]
}
```

### PUT `/checkout/edit-checkout-item`
Auth required.

### DELETE `/checkout/delete-checkout-item`
Auth required.

---

## Table

### GET `/table/get-tables`
Auth required. Query: `store`.

### GET `/table/get-tables-with-orders`
Auth required. Query: `store`.

### GET `/table/get-availability`
Auth required. Query: `store`, `date`, `time`.

### POST `/table/create`
Auth required (super_admin/admin).
```json
{
  "tableNumber": "string (required)",
  "capacity": "number (default: 4)",
  "status": "available | occupied | reserved | maintenance (default: available)",
  "description": "string (optional)",
  "store": "number (optional)"
}
```

### PUT `/table/update/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/table/delete/:id`
Auth required (super_admin/admin).

### PUT `/table/update-status/:id`
Auth required.
```json
{
  "status": "available | occupied | reserved | maintenance (required)"
}
```

---

## Discount

### GET `/discount/get-discount-by-location`
Auth required. Query: `store`.

### GET `/discount/get-discount`
Auth required. Query: `page`, `limit`, `search`, `store`.

### GET `/discount/get-discount/:id`
Auth required.

### GET `/discount/lookup-by-code/:code`
No auth.

### POST `/discount/add-new-discount`
Auth required (super_admin/admin).
```json
{
  "name": "string (required)",
  "type": "percent | nominal (required)",
  "value": "number (required)",
  "store": "number (optional)",
  "maximumDiscount": "number (default: 0)",
  "minimumOrder": "number (default: 0)",
  "startDate": "string (optional, ISO date)",
  "endDate": "string (optional, ISO date)",
  "code": "string (optional)",
  "conditions": "JSON object (optional, default: {})",
  "status": "boolean (default: true)",
  "description": "string (optional)"
}
```

### PUT `/discount/edit-discount/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/discount/delete-discount/:id`
Auth required (super_admin/admin).

### GET `/discount/template`, GET `/discount/download`, POST `/discount/import`
Auth required. Import uses multipart/form-data with `file` field.

---

## Shift

### GET `/shift/get-shift`
Auth required. Query: `page`, `limit`, `search`.

### GET `/shift/dropdown`
Auth required.

### POST `/shift/add-new-shift`
Auth required (super_admin/admin).
```json
{
  "nama_shift": "string (required)",
  "jam_mulai": "string (required, e.g. 08:00)",
  "jam_selesai": "string (required, e.g. 16:00)",
  "tipe_shift": "string (default: '')",
  "tanggal_mulai": "string (optional)",
  "tanggal_selesai": "string (optional)",
  "karyawan": "JSON array (default: [])",
  "status": "active | inactive | draft (default: active)",
  "store": "number (optional)"
}
```

### PUT `/shift/edit-shift/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/shift/delete-shift/:id`
Auth required (super_admin/admin).

---

## Type Payment

### GET `/type-payment/get-type-payment`
Auth required. Returns active payment types.

### GET `/type-payment/get-list-type-payment`
Auth required. Returns all payment types.

### GET `/type-payment/get-by-id/:id`
Auth required.

### POST `/type-payment/add-new-type-payment`
Auth required (super_admin/admin).
```json
{
  "namePayment": "string (required)",
  "icon": "string (default: '')",
  "isActive": "boolean (default: true)",
  "isEditable": "boolean (default: true)",
  "paymentCategory": "string (default: '')",
  "isShowInCashier": "boolean (default: true)"
}
```

### PUT `/type-payment/edit-type-payment/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/type-payment/delete-type-payment/:id`
Auth required (super_admin/admin).

### GET `/type-payment/template`, GET `/type-payment/download`, POST `/type-payment/import`
Auth required (super_admin/admin). Import uses multipart/form-data.

---

## Supplier

### GET `/supplier/`
Auth required. Query: `limit`, `store`, `search`.

### GET `/supplier/detail/:id`
Auth required.

### GET `/supplier/:id`
Auth required.

### POST `/supplier/`
Auth required (super_admin/admin).
```json
{
  "name": "string (required)",
  "store": "array of numbers (optional)",
  "phone": "string (optional)",
  "email": "string (optional)",
  "contactPerson": "string (optional)",
  "address": "string (optional)",
  "description": "string (optional)",
  "status": "active | inactive | draft (default: active)"
}
```

### PUT `/supplier/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/supplier/:id`
Auth required (super_admin/admin).

### GET `/supplier/template`, GET `/supplier/download`, POST `/supplier/import`
Auth required (super_admin/admin). Import uses multipart/form-data.

---

## Ingredient

### GET `/ingredient/get-all`
Auth required. Query: `store`, `limit`, `search`.

### GET `/ingredient/get-by-id/:id`
Auth required.

### POST `/ingredient/add`
Auth required (super_admin/admin).
```json
{
  "name": "string (required)",
  "store": "number (optional)",
  "category": "number (optional)",
  "supplier": "number (optional)",
  "stock": "number (default: 0)",
  "minStock": "number (default: 0)",
  "unit": "string (default: pcs)",
  "baseUnit": "string (default: pcs)",
  "conversionFactor": "string (default: 1)",
  "costPrice": "number (default: 0)",
  "status": "active | inactive | draft (default: active)"
}
```

### PUT `/ingredient/edit/:id`
Auth required (super_admin/admin). Same fields, all optional.

### PUT `/ingredient/adjust-stock/:id`
Auth required.
```json
{
  "stock": "number (required)",
  "notes": "string (optional)"
}
```

### DELETE `/ingredient/delete/:id`
Auth required (super_admin/admin).

### GET `/ingredient/download-template`, GET `/ingredient/download`, POST `/ingredient/import`
Auth required (super_admin/admin). Import uses multipart/form-data.

---

## Ingredient Category

### GET `/ingredient-category/get-all`
Auth required.

### GET `/ingredient-category/get-by-id/:id`
Auth required.

### POST `/ingredient-category/add`
Auth required (super_admin/admin).
```json
{
  "name": "string (required)",
  "description": "string (default: '')"
}
```

### PUT `/ingredient-category/edit/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/ingredient-category/delete/:id`
Auth required (super_admin/admin).

### GET `/ingredient-category/template`, GET `/ingredient-category/download`, POST `/ingredient-category/import`
Auth required (super_admin/admin). Import uses multipart/form-data.

---

## Stock History

### GET `/stock-history/get-all`
Auth required. Query: `page`, `limit`, `product`, `referenceType`, `startDate`, `endDate`, `store`.

### GET `/stock-history/get-by-product/:productId`
Auth required.

### GET `/stock-history/low-stock`
Auth required. Query: `store`.

### GET `/stock-history/low-stock-all`
No auth. Returns low stock across all stores.

---

## Stock Opname

### GET `/stock-opname/get-all`
Auth required. Query: `page`, `limit`, `search`, `warehouse`, `status`.

### GET `/stock-opname/get-by-id/:id`
Auth required.

### GET `/stock-opname/check-exists`
Auth required. Query: `store`.

### GET `/stock-opname/composition-items`
Auth required. Query: `store`.

### POST `/stock-opname/create`
Auth required (super_admin/admin).
```json
{
  "auditDate": "string (optional, ISO date)",
  "auditor": "string (optional)",
  "notes": "string (default: '')",
  "status": "active | inactive | draft (default: active)",
  "items": "array of objects (default: [])",
  "store": "number (optional)"
}
```

### PUT `/stock-opname/update/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/stock-opname/delete/:id`
Auth required (super_admin/admin).

### PATCH `/stock-opname/status/:id`
Auth required (super_admin/admin).
```json
{
  "status": "active | inactive | draft (required)"
}
```

### GET `/stock-opname/download-excel`, POST `/stock-opname/export-selected`, POST `/stock-opname/upload-excel`
Auth required (super_admin/admin).

---

## Expense

### GET `/expense/get-all`
Auth required. Query: `page`, `limit`, `search`, `status`, `store`.

### GET `/expense/get-by-id/:id`
Auth required.

### GET `/expense/get-summary`
Auth required. Query: `store`, `startDate`, `endDate`.

### POST `/expense/add`
Auth required (super_admin/admin).
```json
{
  "categoryId": "number (required)",
  "amount": "number (required)",
  "description": "string (optional)",
  "date": "string (optional, ISO date)",
  "notes": "string (default: '')",
  "status": "pending | approved | rejected (default: pending)",
  "store": "number (optional)"
}
```

### PUT `/expense/edit/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/expense/delete/:id`
Auth required (super_admin/admin).

### PUT `/expense/approve/:id`
Auth required (super_admin/admin).

### PUT `/expense/reject/:id`
Auth required (super_admin/admin).

---

## Expense Category

### GET `/expense-category/get-all`
Auth required.

### POST `/expense-category/add`
Auth required (super_admin/admin).
```json
{
  "name": "string (required)",
  "description": "string (default: '')"
}
```

### PUT `/expense-category/edit/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/expense-category/delete/:id`
Auth required (super_admin/admin).

---

## Cash Register

### POST `/cash-register/open`
Auth required (super_admin/admin).
```json
{
  "store": "number (required)",
  "initialBalance": "number (required)",
  "cashierId": "number (optional)",
  "notes": "string (default: '')"
}
```

### PUT `/cash-register/close/:id`
Auth required (super_admin/admin).
```json
{
  "id": "number (required)",
  "finalBalance": "number (required)",
  "notes": "string (default: '')"
}
```

### GET `/cash-register/current`
Auth required. Query: `store`.

### GET `/cash-register/history`
Auth required. Query: `page`, `limit`, `store`, `search`.

---

## Purchase Order

### GET `/purchase-order/get-all`
Auth required. Query: `page`, `limit`, `search`, `store`, `status`.

### GET `/purchase-order/get-by-id/:id`
Auth required.

### POST `/purchase-order/create`
Auth required (super_admin/admin).
```json
{
  "store": "number (required)",
  "supplier": "number (optional)",
  "items": [
    {
      "ingredient": "number (optional)",
      "ingredientName": "string (optional)",
      "product": "number (optional)",
      "productName": "string (optional)",
      "quantity": "number (required)",
      "price": "number (default: 0)",
      "unit": "string (default: pcs)"
    }
  ],
  "notes": "string (default: '')",
  "discount": "number (default: 0)",
  "pic": "number (optional)",
  "status": "draft | pending | ordered | received | cancelled (default: draft)",
  "orderDate": "string (optional)",
  "dueDate": "string (optional)"
}
```

### PUT `/purchase-order/update/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/purchase-order/delete/:id`
Auth required (super_admin/admin).

### PUT `/purchase-order/receive/:id`
Auth required (super_admin/admin).

### PUT `/purchase-order/cancel/:id`
Auth required (super_admin/admin).

### GET `/purchase-order/template`, GET `/purchase-order/download`, POST `/purchase-order/import`
Auth required. Import uses multipart/form-data.

---

## Purchase Payment

### GET `/purchase-payment/list`
Auth required. Query: `page`, `limit`.

### GET `/purchase-payment/detail/:id`
Auth required.

### GET `/purchase-payment/by-po/:poId`
Auth required.

### GET `/purchase-payment/by-supplier/:supplierId`
Auth required.

### GET `/purchase-payment/ap-dashboard`
Auth required.

### POST `/purchase-payment/create`
Auth required (super_admin/admin).
```json
{
  "purchaseOrderId": "number (required)",
  "paymentMethod": "string (required)",
  "paymentAmount": "number (required)",
  "paymentDate": "string (optional, ISO date)",
  "notes": "string (default: '')"
}
```

### DELETE `/purchase-payment/delete/:id`
Auth required (super_admin/admin).

---

## Purchase Return

### GET `/purchase-return/get-all`
Auth required. Query: `page`, `limit`, `search`, `store`, `status`.

### GET `/purchase-return/get-by-id/:id`
Auth required.

### GET `/purchase-return/by-po/:poId`
Auth required.

### POST `/purchase-return/create`
Auth required (super_admin/admin).
```json
{
  "purchaseOrderId": "number (required)",
  "items": "array of objects (required, min 1)",
  "notes": "string (default: '')"
}
```

### PATCH `/purchase-return/approve/:id`
Auth required (super_admin/admin).

### PATCH `/purchase-return/reject/:id`
Auth required (super_admin/admin).

---

## Goods Receipt

### GET `/goods-receipt/get-all`
Auth required. Query: `page`, `limit`, `search`, `status`, `store`.

### GET `/goods-receipt/get-by-id/:id`
Auth required.

### GET `/goods-receipt/by-po/:poId`
Auth required.

### GET `/goods-receipt/export`
Auth required.

### POST `/goods-receipt/create`
Auth required (super_admin/admin).
```json
{
  "store": "number (required)",
  "purchaseOrderId": "number (optional)",
  "supplier": "number (optional)",
  "items": [
    {
      "product": "number (required)",
      "quantity": "number (required)",
      "price": "number (default: 0)",
      "unit": "string (default: pcs)"
    }
  ],
  "notes": "string (default: '')",
  "receiptDate": "string (optional, ISO date)"
}
```

### PUT `/goods-receipt/update/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/goods-receipt/delete/:id`
Auth required (super_admin/admin).

### PATCH `/goods-receipt/status/:id`
Auth required (super_admin/admin).
```json
{
  "status": "active | inactive | draft (required)"
}
```

---

## BOM (Bill of Materials)

### GET `/bom/get-all`
Auth required (super_admin/admin).

### GET `/bom/get-by-id/:id`
Auth required.

### POST `/bom/add`
Auth required (super_admin/admin).
```json
{
  "productId": "number (required)",
  "name": "string (default: '')",
  "notes": "string (default: '')",
  "status": "string (default: active)",
  "lines": [
    {
      "ingredientId": "number (required)",
      "qty": "number (required)",
      "unit": "string (default: pcs)",
      "notes": "string (default: '')"
    }
  ]
}
```

### PUT `/bom/edit/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/bom/delete/:id`
Auth required (super_admin/admin).

---

## Production Order

### GET `/production-order/get-all`
Auth required. Query: `page`, `limit`, `search`, `status`.

### GET `/production-order/get-by-id/:id`
Auth required.

### POST `/production-order/create`
Auth required (super_admin/admin).
```json
{
  "productItemId": "number (required)",
  "plannedQty": "number (required)",
  "scheduledDate": "string (optional)",
  "notes": "string (default: '')",
  "status": "planned | in_progress | completed | cancelled | draft (default: planned)",
  "store": "number (optional)"
}
```

### PUT `/production-order/update/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/production-order/delete/:id`
Auth required (super_admin/admin).

### PATCH `/production-order/status/:id`
Auth required (super_admin/admin).
```json
{
  "status": "planned | in_progress | completed | cancelled | draft (required)"
}
```

### POST `/production-order/start/:id`
Auth required (super_admin/admin).

### POST `/production-order/complete/:id`
Auth required (super_admin/admin).

---

## Sales Return

### GET `/sales-return/get-all`
Auth required. Query: `page`, `limit`, `search`, `store`, `status`.

### GET `/sales-return/get-by-id/:id`
Auth required.

### PATCH `/sales-return/approve/:id`
Auth required (super_admin/admin).

### PATCH `/sales-return/reject/:id`
Auth required (super_admin/admin).

---

## Employee

### GET `/employee/get-employee`
Auth required. Query: `search`, `store`.

### GET `/employee/get-employee/:id`
Auth required. Get by DB ID.

### GET `/employee/get-employee-detail/:employeeID`
Auth required. Get by employee ID string.

### POST `/employee/add-employee`
Auth required (super_admin/admin). Content-Type: `multipart/form-data`.
```json
{
  "userName": "string (required)",
  "password": "string (required, min 6)",
  "confirmPassword": "string (required)",
  "fullName": "string (optional)",
  "email": "string (optional)",
  "phoneNumber": "string (optional)",
  "gender": "string (optional)",
  "address": "string (optional)",
  "dateOfBirth": "string (optional)",
  "placeOfBirth": "string (optional)",
  "store": "number (optional)",
  "shift": "number (optional)",
  "position": "number (optional)",
  "roleId": "number (optional)",
  "department": "string (optional)",
  "departmentId": "number (optional)",
  "employmentType": "string (optional)",
  "startDate": "string (optional)",
  "status": "active | inactive | draft (default: active)",
  "monthlySalary": "string (optional)",
  "dailySalary": "string (optional)",
  "avatar": "file (optional)"
}
```

### PUT `/employee/edit-employee`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/employee/delete-employee/:id`
Auth required (super_admin/admin).

---

## Department

### GET `/department/get-department`
Auth required.

### GET `/department/get-department-all`
Auth required. Query: `page`, `limit`, `search`.

### GET `/department/get-department/:id`
Auth required.

### POST `/department/add-new-department`
Auth required (super_admin/admin).
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "status": "active | inactive | draft (default: active)",
  "store": "number (optional)"
}
```

### PUT `/department/edit-department/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/department/delete-department/:id`
Auth required (super_admin/admin).

### GET `/department/download-template`, GET `/department/download`, POST `/department/upload`
Auth required (super_admin/admin). Import uses multipart/form-data.

---

## Position

### GET `/position/get-position`
Auth required.

### GET `/position/get-position/:id`
Auth required.

### GET `/position/get-position-all`
Auth required. Query: `page`, `limit`, `search`.

### POST `/position/add-new-position`
Auth required (super_admin/admin).
```json
{
  "name": "string (required)",
  "description": "string (optional)",
  "status": "active | inactive | draft (default: active)",
  "store": "number (optional)"
}
```

### PUT `/position/edit-position/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/position/delete-position/:id`
Auth required (super_admin/admin).

### GET `/position/download-template`, GET `/position/download`, POST `/position/upload`
Auth required. Import uses multipart/form-data.

---

## Role

### GET `/role/get-role`
No auth. Returns roles dropdown.

### GET `/role/get-role-all`
Auth required (super_admin). Query: `page`.

### GET `/role/get-role-by-id/:id`
Auth required.

### POST `/role/add-new-role`
Auth required (super_admin).
```json
{
  "name": "string (required)",
  "permissions": "JSON object (default: {})"
}
```

### PUT `/role/edit-role/:id`
Auth required (super_admin). Same fields, all optional.

### DELETE `/role/delete-role/:id`
Auth required (super_admin).

### PUT `/role/update-user-role`
Auth required (super_admin).
```json
{
  "userId": "number (required)",
  "roleId": "number (required)"
}
```

### GET `/role/get-users-by-role`
Auth required. Query: `roleId`.

### PUT `/role/update-access-menu`
Auth required (super_admin).
```json
{
  "roleId": "number (required)",
  "accessMenu": "JSON object (required)"
}
```

---

## Report

### GET `/report/daily`
Auth required. Query: `store`, `date`.

### GET `/report/profit-loss`
Auth required. Query: `store`, `startDate`, `endDate`.

### GET `/report/cash-flow`
Auth required. Query: `store`, `startDate`, `endDate`.

### GET `/report/sales-summary`
Auth required. Query: `store`, `period` (daily|weekly|monthly|yearly).

### GET `/report/best-seller`
Auth required. Query: `store`, `startDate`, `endDate`, `limit`.

### GET `/report/profit-per-product`
Auth required. Query: `store`, `startDate`, `endDate`.

---

## Best Selling

### GET `/best-selling/get-chart-by-year`
Auth required (super_admin/admin). Query: `store`, `year`.

### GET `/best-selling/get-chart-by-month`
Auth required (super_admin/admin). Query: `store`, `year`, `month`.

### GET `/best-selling/get-chart-current-and-two-days-before`
Auth required. Query: `store`.

### GET `/best-selling/get-chart-current-and-seven-days-before`
Auth required. Query: `store`.

### GET `/best-selling/get-earning-today`
Auth required. Query: `store`.

---

## Overview (Dashboard)

All require auth. Query: `store`.

| Endpoint | Description |
|----------|-------------|
| GET `/overview/product` | Product summary |
| GET `/overview/category` | Category summary |
| GET `/overview/location` | Location summary |
| GET `/overview/member` | Member summary |
| GET `/overview/user` | User summary |
| GET `/overview/best-selling` | Best selling |
| GET `/overview/members/latest` | Latest members |
| GET `/overview/categories/latest` | Latest categories |
| GET `/overview/locations/latest` | Latest locations |
| GET `/overview/products/latest` | Latest products |

---

## POS Extended

### GET `/pos/lookup-barcode`
Auth required. Query: `barcode`, `store`.

### POST `/pos/transfer`
Auth required (super_admin/admin).
```json
{
  "fromStore": "number (required)",
  "toStore": "number (required)",
  "items": [
    {
      "product": "number (required)",
      "quantity": "number (required)",
      "notes": "string (default: '')"
    }
  ],
  "notes": "string (default: '')",
  "transferredBy": "number (optional)"
}
```

### GET `/pos/transfer-history`
Auth required. Query: `page`, `limit`, `status`, `startDate`, `endDate`, `store`.

### GET `/pos/transfer/:id`
Auth required.

### PUT `/pos/transfer/:id/receive`
Auth required (super_admin/admin).

### PUT `/pos/transfer/:id/cancel`
Auth required (super_admin/admin).

### POST `/pos/adjust`
Auth required (super_admin/admin).
```json
{
  "productId": "number (required)",
  "qty": "number (optional)",
  "sign": "+ | - (optional)",
  "value": "number (optional)",
  "reason": "string (default: '')",
  "storeId": "number (optional)"
}
```

### POST `/pos/purchase-order/:id/return`
Auth required (super_admin/admin).
```json
{
  "items": "array of objects (required, min 1)",
  "reason": "string (default: '')",
  "returnedBy": "number (optional)"
}
```

### POST `/pos/order/:id/return`
Auth required (super_admin/admin). Same structure as PO return.

### GET `/pos/member/:id/point-history`
Auth required. Query: `page`, `limit`.

### GET `/pos/dashboard/summary`
Auth required. Query: `store`.

### GET `/pos/product/price-by-store`
Auth required (super_admin/admin). Query: `productId`.

### PUT `/pos/product/update-price-by-store`
Auth required (super_admin/admin).
```json
{
  "productId": "number (required)",
  "storePrices": "array of { storeId, price } (required)"
}
```

### POST `/pos/invoice/send-wa`
Auth required.
```json
{
  "orderId": "number (required)",
  "phone": "string (required)"
}
```

### POST `/pos/invoice/send-email`
Auth required.
```json
{
  "orderId": "number (required)",
  "email": "string (required, valid email)"
}
```

### GET `/pos/whatsapp/status`
Auth required.

### POST `/pos/whatsapp/logout`
Auth required (super_admin/admin).

### POST `/pos/whatsapp/restart`
Auth required (super_admin/admin).

### POST `/pos/product/add-batch`
Auth required (super_admin/admin).
```json
{
  "productId": "number (required)",
  "batchCode": "string (required)",
  "expiryDate": "string (optional)",
  "qty": "number (required)",
  "store": "number (required)"
}
```

### GET `/pos/product/batches`
Auth required. Query: `productId`, `store`.

---

## Accounts Receivable

### GET `/accounts-receivable/list`
Auth required. Query: `page`, `limit`, `status`, `store`.

### GET `/accounts-receivable/aging`
Auth required. Query: `store`.

### GET `/accounts-receivable/:id`
Auth required.

### POST `/accounts-receivable/create`
Auth required (super_admin/admin).
```json
{
  "orderId": "number (required)",
  "customerName": "string (default: '')",
  "totalAmount": "number (required)",
  "paidAmount": "number (default: 0)",
  "dueDate": "string (optional, ISO date)",
  "notes": "string (default: '')"
}
```

### POST `/accounts-receivable/:id/pay`
Auth required.
```json
{
  "amount": "number (required)",
  "paymentMethod": "string (optional)",
  "notes": "string (optional)"
}
```

### PUT `/accounts-receivable/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/accounts-receivable/:id`
Auth required (super_admin/admin).

---

## Tax Config

### GET `/tax-config/`
Auth required. Query: `page`, `limit`, `search`.

### GET `/tax-config/get-tax-config/:id`
Auth required.

### POST `/tax-config/add-new-tax-config`
Auth required (super_admin/admin).
```json
{
  "name": "string (required)",
  "rate": "number (required)",
  "type": "ppn | service_charge | other (default: ppn)",
  "status": "active | inactive | draft (default: active)",
  "description": "string (optional)",
  "store": "number (optional)"
}
```

### PUT `/tax-config/edit-tax-config/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/tax-config/delete-tax-config/:id`
Auth required (super_admin/admin).

### GET `/tax-config/template`, GET `/tax-config/download`, POST `/tax-config/import`
Auth required. Import uses multipart/form-data.

### POST `/tax-config/seed`
Auth required. Seeds default PPh 2026.

---

## Invoice

### GET `/invoice/setting`
Auth required. Query: `store`.

### PUT `/invoice/setting`
Auth required (super_admin/admin). Content-Type: `multipart/form-data`.
```json
{
  "store": "number (required)",
  "showStoreName": "boolean (optional)",
  "showAddress": "boolean (optional)",
  "showMemberInfo": "boolean (optional)",
  "showLogo": "boolean (optional)",
  "showSocialMedia": "boolean (optional)",
  "socialMediaVisibility": "JSON object (optional)",
  "removeLogo": "boolean (optional)",
  "logo": "file (optional)"
}
```

### POST `/invoice/setting/reset`
Auth required (super_admin/admin).

---

## Notification

### GET `/notification/`
Auth required. Query: `page`.

### GET `/notification/unread`
Auth required.

### PUT `/notification/:id/read`
Auth required.

### PUT `/notification/read-all`
Auth required.

---

## Currency

### GET `/currency/`
Auth required.

### GET `/currency/:id`
Auth required.

### POST `/currency/`
Auth required (super_admin/admin).
```json
{
  "code": "string (required, max 10)",
  "name": "string (required)",
  "symbol": "string (default: '')",
  "exchangeRate": "number (default: 1)",
  "isDefault": "boolean (default: false)"
}
```

### PUT `/currency/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/currency/:id`
Auth required (super_admin/admin).

### PUT `/currency/:id/default`
Auth required (super_admin/admin). Sets this currency as default.

---

## Audit Log

### GET `/audit-log/`
Auth required (super_admin). Query: `page`, `limit`.

### GET `/audit-log/:entity/:entityId`
Auth required (super_admin).

---

## Social Media

### GET `/social-media/get-social-media`
Auth required.

### POST `/social-media/add-social-media`
Auth required (super_admin/admin).
```json
{
  "name": "string (required)",
  "url": "string (required)",
  "icon": "string (default: '')",
  "isActive": "boolean (default: true)"
}
```

### PUT `/social-media/edit-social-media/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/social-media/delete-social-media/:id`
Auth required (super_admin/admin).

---

## Reservation

### GET `/reservation/`
Auth required. Query: `page`, `limit`, `date`, `status`, `store`.

### GET `/reservation/available-tables/list`
Auth required. Query: `store`, `date`, `time`, `guestCount`.

### GET `/reservation/:id`
Auth required.

### POST `/reservation/`
Auth required.
```json
{
  "store": "number (required)",
  "customerName": "string (required)",
  "customerPhone": "string (optional)",
  "customerEmail": "string (optional)",
  "reservationDate": "string (required, ISO date)",
  "startTime": "string (required)",
  "endTime": "string (optional)",
  "guestCount": "number (default: 1)",
  "tableId": "number (optional)",
  "notes": "string (default: '')",
  "status": "pending | confirmed | completed | cancelled | no_show (default: pending)"
}
```

### PUT `/reservation/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/reservation/:id`
Auth required (super_admin/admin).

---

## Split Bill

### POST `/split-bill/create`
Auth required (super_admin/admin).
```json
{
  "orderId": "number (required)",
  "items": [
    {
      "idProduct": "number (required)",
      "qty": "number (required)"
    }
  ]
}
```

### GET `/split-bill/get-by-order/:orderId`
Auth required.

### PUT `/split-bill/pay/:id`
Auth required (super_admin/admin).

### DELETE `/split-bill/cancel/:id`
Auth required (super_admin/admin).

### POST `/split-bill/merge`
Auth required (super_admin/admin).
```json
{
  "orderId": "number (required)"
}
```

---

## Export

### GET `/export/master-data`
Auth required (super_admin/admin). Query: `store`.

---

## Receipt

### GET `/receipt/order/:orderId`
Auth required.

---

## FAQ

### GET `/faq/faq`
No auth. Query: `search`, `category`.

### POST `/faq/faq/ask`
No auth.
```json
{
  "question": "string (required)"
}
```

---

## Misc

### GET `/`
No auth. Health check.

### POST `/print-thermal`
No auth. ESC/POS thermal print.

---

**Total: ~210 endpoints across 47 modules**
