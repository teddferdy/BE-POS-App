# POS System - API Documentation

**Base URL:** `https://api-bisa-nota.vercel.app`
**Auth:** `Authorization: Bearer <JWT_TOKEN>` header
**Roles:** `super_admin`, `admin`, `user`
**Content-Type:** `application/json` (unless stated otherwise)

---

## Response Format

### Standard Success (list)
```json
{
  "success": true,
  "message": "Success",
  "data": [],
  "pagination": {
    "total": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 0
  }
}
```

### Standard Success (single)
```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

### Success with stats
```json
{
  "success": true,
  "message": "Success",
  "data": [],
  "pagination": { "total": 0, "page": 1, "limit": 10, "totalPages": 0 },
  "stats": {},
  "summary": {}
}
```

### Error
```json
{
  "success": false,
  "message": "Error message here"
}
```

---

## Auth

### POST `/auth/login`
No auth required. Rate limited: 10 attempts / 15 min.

**Request:**
```json
{
  "userName": "string (required)",
  "password": "string (required)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGci...",
  "user": {
    "id": 1,
    "userName": "admin",
    "fullName": "Admin",
    "roleType": "super_admin",
    "store": [1, 2],
    "accessMenu": {}
  }
}
```

---

### POST `/auth/register`
No auth required.

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": { "id": 1, "userName": "newuser" }
}
```

---

### POST `/auth/reset-password`
No auth required.

**Request:**
```json
{
  "email": "string (optional)",
  "userName": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

---

### POST `/auth/logout`
Auth required.

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### GET `/auth/get-user`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "userName": "admin",
    "fullName": "Admin User",
    "email": "admin@example.com",
    "roleType": "super_admin",
    "store": [1, 2],
    "shift": 1,
    "position": 1,
    "accessMenu": {}
  }
}
```

---

### GET `/auth/get-all-user`
Auth required (super_admin).

**Query:** `page` (number), `limit` (number), `search` (string), `store` (number).

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "userName": "admin", "fullName": "Admin", "roleType": "super_admin", "store": [1] }
  ],
  "pagination": { "total": 50, "page": 1, "limit": 10, "totalPages": 5 }
}
```

---

### GET `/auth/generate-employee-id`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": "EMP-2026-001"
}
```

---

### PUT `/auth/change-profile-user`
Auth required (super_admin).

**Request:**
```json
{
  "userId": "number (required)",
  "roleId": "number (required)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Role updated"
}
```

---

### PUT `/auth/edit-user`
Auth required.

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Profile updated",
  "data": { "id": 1, "fullName": "Updated Name" }
}
```

---

## Product

### GET `/product/get-product`
Auth required. Products for cashier view.

**Query:**
| Param | Type | Description |
|-------|------|-------------|
| `store` | number | Store ID |
| `nameProduct` | string | Search by name |
| `category` | number | Category ID |
| `page` | number | Page number |
| `limit` | number | Items per page |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nameProduct": "Nasi Goreng",
      "category": 1,
      "price": 25000,
      "stock": 100,
      "unit": "pcs",
      "barcode": "8991234567890",
      "image": "https://...",
      "status": "active"
    }
  ]
}
```

---

### GET `/product/get-product-by-super-admin`
Auth required.

**Query:** `page`, `limit`, `search`, `store`.

**Response:** Same as above with pagination.

---

### GET `/product/get-product-all`
Auth required. Full product list for table.

**Query:** `page`, `limit`, `search`, `store`, `category`.

**Response:** Same as above with pagination.

---

### GET `/product/get-by-id/:id`
Auth required (super_admin/admin).

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nameProduct": "Nasi Goreng",
    "category": 1,
    "status": "active",
    "price": 25000,
    "costPrice": 15000,
    "stock": 100,
    "minStock": 10,
    "unit": "pcs",
    "baseUnit": "pcs",
    "conversionFactor": "1",
    "barcode": "8991234567890",
    "brand": "Brand X",
    "stores": [1, 2],
    "supplier": 1,
    "tax": { "name": "PPN", "rate": 11 },
    "image": "https://..."
  }
}
```

---

### POST `/product/add-product`
Auth required (super_admin/admin). Content-Type: `multipart/form-data`.

**Request:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `nameProduct` | string | **YES** | - |
| `category` | number | **YES** | - |
| `status` | string | No | `active` |
| `description` | string | No | `''` |
| `price` | number | No | `0` |
| `costPrice` | number | No | `0` |
| `stock` | number | No | `0` |
| `minStock` | number | No | `0` |
| `unit` | string | No | `pcs` |
| `baseUnit` | string | No | `pcs` |
| `conversionFactor` | string | No | `"1"` |
| `point` | number | No | `0` |
| `barcode` | string | No | null |
| `brand` | string | No | null |
| `hasModifiers` | boolean | No | `false` |
| `modifiers` | JSON array | No | `[]` |
| `isOption` | boolean | No | `false` |
| `options` | JSON array | No | `[]` |
| `isAvailable` | boolean | No | `true` |
| `stores` | array of numbers | No | null |
| `supplier` | number | No | null |
| `tax` | JSON object | No | null |
| `priceTiers` | JSON array | No | `[]` |
| `currencyId` | number | No | null |
| `currencyCode` | string | No | null |
| `tipeProduk` | string | No | `menu` |
| `composition` | JSON array | No | `[]` |
| `redeemPoints` | number | No | `0` |
| `image` | file | No | null |

**Response:**
```json
{
  "success": true,
  "message": "Product created",
  "data": { "id": 1, "nameProduct": "Nasi Goreng" }
}
```

---

### PUT `/product/edit-product`
Auth required (super_admin/admin). Content-Type: `multipart/form-data`. Same fields as add, all optional.

**Response:**
```json
{
  "success": true,
  "message": "Product updated",
  "data": { "id": 1, "nameProduct": "Nasi Goreng Updated" }
}
```

---

### DELETE `/product/delete-product/:id`
Auth required (super_admin/admin).

**Response:**
```json
{
  "success": true,
  "message": "Product deleted"
}
```

---

### GET `/product/template`
Auth required. Returns Excel template file.

### GET `/product/download`
Auth required. Returns Excel file with product data.

### POST `/product/import`
Auth required. Content-Type: `multipart/form-data`. Field: `file` (Excel).

**Response:**
```json
{
  "success": true,
  "message": "Import successful",
  "imported": 10,
  "failed": 2,
  "errors": ["Row 3: name is required", "Row 7: category not found"]
}
```

---

## Category

### GET `/category/get-category-all`
Auth required.

**Query:** `page`, `limit`, `search`.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Makanan", "status": "active", "store": [1, 2] }
  ],
  "pagination": { "total": 20, "page": 1, "limit": 10, "totalPages": 2 }
}
```

---

### GET `/category/get-category/:id`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": { "id": 1, "name": "Makanan", "description": "All food items", "status": "active" }
}
```

---

### POST `/category/add-new-category`
Auth required (super_admin/admin).

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Category created",
  "data": { "id": 1, "name": "Makanan" }
}
```

---

### PUT `/category/edit-category/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/category/delete-category/:id`
Auth required (super_admin/admin).

### GET `/category/download-template`, GET `/category/download`, POST `/category/upload-excel`
Auth required (super_admin/admin). Import uses multipart/form-data with `file` field.

---

## Location (Store)

### GET `/location/get-location-public`
No auth. Returns active locations (for registration dropdown).

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Store Jakarta", "address": "Jl. Sudirman 123" }
  ]
}
```

---

### GET `/location/get-location-all`
Auth required (super_admin).

**Query:** `page`, `limit`, `search`.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Store Jakarta",
      "address": "Jl. Sudirman 123",
      "city": "Jakarta",
      "province": "DKI Jakarta",
      "status": "active",
      "category": "restoran",
      "dailyTarget": 5000000
    }
  ],
  "pagination": { "total": 5, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

### GET `/location/get-location-detail/:locationId`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Store Jakarta",
    "address": "Jl. Sudirman 123",
    "detailLocation": "Lantai 2",
    "city": "Jakarta",
    "province": "DKI Jakarta",
    "district": "Setiabudi",
    "village": "Karet",
    "postalCode": "12190",
    "latitude": "-6.2088",
    "longitude": "106.8456",
    "mainBranch": true,
    "managerName": "Budi",
    "email": "jakarta@example.com",
    "phoneNumber": "08123456789",
    "category": "restoran",
    "status": "active",
    "openingHours": { "mon": "08:00-22:00" },
    "dailyTarget": 5000000
  }
}
```

---

### GET `/location/generate-id`
Auth required (super_admin).

**Response:**
```json
{
  "success": true,
  "data": "LOC-2026-001"
}
```

---

### POST `/location/add-new-location`
Auth required (super_admin).

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Location created",
  "data": { "id": 1, "name": "Store Jakarta", "locationId": "LOC-2026-001" }
}
```

---

### PUT `/location/edit-location`
Auth required (super_admin). Same fields, all optional.

### DELETE `/location/delete-location`
Auth required (super_admin).

---

## Member

### GET `/member/get-member`
Auth required.

**Query:** `page`, `limit`, `search`, `tier`, `status`, `sortBy`, `store`.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nameMember": "John Doe",
      "phoneNumber": "08123456789",
      "email": "john@example.com",
      "point": 1500,
      "tier": { "id": 1, "name": "Gold", "discountPercent": 10 },
      "status": "active"
    }
  ],
  "pagination": { "total": 100, "page": 1, "limit": 10, "totalPages": 10 },
  "stats": { "total": 100, "active": 80, "draft": 10, "inactive": 10 }
}
```

---

### GET `/member/get-member/:id`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "nameMember": "John Doe",
    "phoneNumber": "08123456789",
    "email": "john@example.com",
    "point": 1500,
    "tier": { "id": 1, "name": "Gold" },
    "birthDate": "1990-01-01",
    "gender": "male",
    "address": "Jl. Melati 5",
    "status": "active"
  }
}
```

---

### POST `/member/add-new-member`
Auth required (super_admin/admin).

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Member created",
  "data": { "id": 1, "nameMember": "John Doe" }
}
```

---

### PUT `/member/edit-member/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/member/delete-member/:id`
Auth required (super_admin/admin).

### PUT `/member/edit-point-member/:phoneNumber`
Auth required.

**Request:**
```json
{ "point": "number (required)" }
```

**Response:**
```json
{
  "success": true,
  "message": "Points updated",
  "data": { "point": 2000 }
}
```

---

## Member Tier

### GET `/member-tier/get-all`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Gold",
      "minPoints": 1000,
      "maxPoints": 5000,
      "discountPercent": 10,
      "benefits": "Free shipping, Priority service",
      "members": 25
    }
  ]
}
```

---

### GET `/member-tier/detail/:id`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Gold",
    "minPoints": 1000,
    "maxPoints": 5000,
    "discountPercent": 10,
    "benefits": "Free shipping",
    "members": 25
  }
}
```

---

### GET `/member-tier/get-by-points`
Auth required. **Query:** `points` (number).

**Response:**
```json
{
  "success": true,
  "data": { "id": 1, "name": "Gold", "discountPercent": 10 }
}
```

---

### POST `/member-tier/add`
Auth required (super_admin/admin).

**Request:**
```json
{
  "name": "string (required)",
  "minPoints": "number (default: 0)",
  "maxPoints": "number (optional)",
  "discountPercent": "number (default: 0)",
  "benefits": "string (default: '')"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tier created",
  "data": { "id": 1, "name": "Gold" }
}
```

---

### PUT `/member-tier/edit/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/member-tier/delete/:id`
Auth required (super_admin/admin).

### POST `/member-tier/update-members`
Auth required (super_admin/admin). Batch update member tier assignments.

---

## Order

### POST `/order/create`
Auth required.

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Order created",
  "data": {
    "id": 1,
    "orderNumber": "ORD-20260711-001",
    "store": 1,
    "status": "pending",
    "items": [...],
    "subTotal": 50000,
    "total": 55500
  }
}
```

---

### GET `/order/get-orders`
Auth required.

**Query:** `store` (number), `page` (number), `limit` (number), `status` (string), `startDate`, `endDate`.

**Response:**
```json
{
  "message": "Success",
  "data": [
    {
      "id": 1,
      "orderNumber": "ORD-20260711-001",
      "store": 1,
      "status": "paid",
      "total": 55500,
      "items": [...],
      "createdAt": "2026-07-11T10:30:00Z"
    }
  ],
  "pagination": { "total": 50, "page": 1, "limit": 10, "totalPages": 5 }
}
```

---

### GET `/order/get-order/:id`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "orderNumber": "ORD-20260711-001",
    "store": 1,
    "tableId": 5,
    "customerId": 1,
    "customerName": "John",
    "status": "served",
    "items": [
      { "product": 1, "productName": "Nasi Goreng", "quantity": 2, "price": 25000, "status": "served" }
    ],
    "subTotal": 50000,
    "discountValue": 5000,
    "taxRate": 11,
    "total": 50500,
    "paymentMethod": "cash",
    "createdAt": "2026-07-11T10:30:00Z"
  }
}
```

---

### GET `/order/kitchen`
Auth required. **Query:** `store` (number).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "orderNumber": "ORD-20260711-001",
      "tableNumber": "5",
      "items": [
        { "product": 1, "productName": "Nasi Goreng", "quantity": 2, "status": "pending", "notes": "pedas" }
      ],
      "source": "pos"
    }
  ]
}
```

---

### PUT `/order/update-status`
Auth required.

**Request:**
```json
{
  "id": "number (required)",
  "status": "pending | confirmed | preparing | ready | served | paid | cancelled | void (required)",
  "notes": "string (default: '')"
}
```

**Response:**
```json
{ "success": true, "message": "Status updated" }
```

---

### PUT `/order/update-item-status`
Auth required.

**Request:**
```json
{
  "id": "number (required)",
  "itemId": "number (required)",
  "itemStatus": "string (required)"
}
```

**Response:**
```json
{ "success": true, "message": "Item status updated" }
```

---

### GET `/order/customer-menu`
No auth. **Query:** `store` (number).

### GET `/order/customer-member`
No auth. **Query:** `phone` (string).

### GET `/order/customer-order/:id`
No auth.

### POST `/order/customer-create`
No auth. Same structure as `/order/create`.

### GET `/order/receipt-html/:id`
No auth. Returns HTML receipt.

---

## Checkout

### POST `/checkout/checkout-item`
Auth required (super_admin/admin).

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Checkout successful",
  "data": {
    "orderId": 1,
    "orderNumber": "ORD-20260711-001",
    "total": 55500,
    "paymentAmount": 60000,
    "change": 4500
  }
}
```

---

### PUT `/checkout/edit-checkout-item`
Auth required.

### DELETE `/checkout/delete-checkout-item`
Auth required.

---

## Table

### GET `/table/get-tables`
Auth required. **Query:** `store` (number).

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "tableNumber": "T1", "capacity": 4, "status": "available", "store": 1 },
    { "id": 2, "tableNumber": "T2", "capacity": 2, "status": "occupied", "store": 1 }
  ]
}
```

---

### GET `/table/get-tables-with-orders`
Auth required. **Query:** `store` (number).

### GET `/table/get-availability`
Auth required. **Query:** `store`, `date`, `time`.

### POST `/table/create`
Auth required (super_admin/admin).

**Request:**
```json
{
  "tableNumber": "string (required)",
  "capacity": "number (default: 4)",
  "status": "available | occupied | reserved | maintenance (default: available)",
  "description": "string (optional)",
  "store": "number (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Table created",
  "data": { "id": 1, "tableNumber": "T1", "capacity": 4, "status": "available" }
}
```

---

### PUT `/table/update/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/table/delete/:id`
Auth required (super_admin/admin).

### PUT `/table/update-status/:id`
Auth required.

**Request:**
```json
{ "status": "available | occupied | reserved | maintenance (required)" }
```

---

## Discount

### GET `/discount/get-discount-by-location`
Auth required. **Query:** `store` (number).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Diskon Lebaran",
      "type": "percent",
      "value": 10,
      "maximumDiscount": 50000,
      "minimumOrder": 100000,
      "code": "LEBARAN10",
      "status": true,
      "startDate": "2026-04-01",
      "endDate": "2026-04-30"
    }
  ]
}
```

---

### GET `/discount/get-discount`
Auth required. **Query:** `page`, `limit`, `search`, `store`.

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": { "total": 10, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

### GET `/discount/get-discount/:id`
Auth required.

### GET `/discount/lookup-by-code/:code`
No auth.

**Response:**
```json
{
  "success": true,
  "data": { "id": 1, "name": "Diskon Lebaran", "type": "percent", "value": 10, "code": "LEBARAN10" }
}
```

---

### POST `/discount/add-new-discount`
Auth required (super_admin/admin).

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Discount created",
  "data": { "id": 1, "name": "Diskon Lebaran" }
}
```

---

### PUT `/discount/edit-discount/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/discount/delete-discount/:id`
Auth required (super_admin/admin).

### GET `/discount/template`, GET `/discount/download`, POST `/discount/import`
Auth required. Import uses multipart/form-data with `file` field.

---

## Shift

### GET `/shift/get-shift`
Auth required. **Query:** `page`, `limit`, `search`.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "nama_shift": "Pagi", "jam_mulai": "08:00", "jam_selesai": "16:00", "status": "active" }
  ],
  "pagination": { "total": 5, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

### GET `/shift/dropdown`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": [{ "id": 1, "nama_shift": "Pagi" }]
}
```

---

### POST `/shift/add-new-shift`
Auth required (super_admin/admin).

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Shift created",
  "data": { "id": 1, "nama_shift": "Pagi" }
}
```

---

### PUT `/shift/edit-shift/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/shift/delete-shift/:id`
Auth required (super_admin/admin).

---

## Type Payment

### GET `/type-payment/get-type-payment`
Auth required. Returns active payment types only.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "namePayment": "Cash", "icon": "money", "isActive": true, "isShowInCashier": true }
  ]
}
```

---

### GET `/type-payment/get-list-type-payment`
Auth required. Returns all payment types (active + inactive).

### GET `/type-payment/get-by-id/:id`
Auth required.

### POST `/type-payment/add-new-type-payment`
Auth required (super_admin/admin).

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Payment type created",
  "data": { "id": 1, "namePayment": "Cash" }
}
```

---

### PUT `/type-payment/edit-type-payment/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/type-payment/delete-type-payment/:id`
Auth required (super_admin/admin).

### GET `/type-payment/template`, GET `/type-payment/download`, POST `/type-payment/import`
Auth required (super_admin/admin). Import uses multipart/form-data.

---

## Supplier

### GET `/supplier/`
Auth required. **Query:** `limit` (number), `store` (number), `search` (string).

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "PT Sumber Rejeki", "phone": "021-1234", "email": "info@sumber.com", "status": "active", "store": [1, 2] }
  ]
}
```

---

### GET `/supplier/detail/:id`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "PT Sumber Rejeki",
    "phone": "021-1234",
    "email": "info@sumber.com",
    "contactPerson": "Budi",
    "address": "Jl. Industri 10",
    "status": "active",
    "store": [1, 2]
  }
}
```

---

### GET `/supplier/:id`
Auth required. Same as detail.

### POST `/supplier/`
Auth required (super_admin/admin).

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Supplier created",
  "data": { "id": 1, "name": "PT Sumber Rejeki" }
}
```

---

### PUT `/supplier/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/supplier/:id`
Auth required (super_admin/admin).

### GET `/supplier/template`, GET `/supplier/download`, POST `/supplier/import`
Auth required (super_admin/admin). Import uses multipart/form-data.

---

## Ingredient

### GET `/ingredient/get-all`
Auth required. **Query:** `store` (number), `limit` (number), `search` (string).

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Beras Premium", "stock": 500, "minStock": 50, "unit": "kg", "costPrice": 12000, "status": "active" }
  ]
}
```

---

### GET `/ingredient/get-by-id/:id`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Beras Premium",
    "stock": 500,
    "minStock": 50,
    "unit": "kg",
    "baseUnit": "kg",
    "conversionFactor": "1",
    "costPrice": 12000,
    "store": 1,
    "category": 1,
    "supplier": 1,
    "status": "active"
  }
}
```

---

### POST `/ingredient/add`
Auth required (super_admin/admin).

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Ingredient created",
  "data": { "id": 1, "name": "Beras Premium" }
}
```

---

### PUT `/ingredient/edit/:id`
Auth required (super_admin/admin). Same fields, all optional.

### PUT `/ingredient/adjust-stock/:id`
Auth required.

**Request:**
```json
{ "stock": "number (required)", "notes": "string (optional)" }
```

### DELETE `/ingredient/delete/:id`
Auth required (super_admin/admin).

### GET `/ingredient/download-template`, GET `/ingredient/download`, POST `/ingredient/import`
Auth required (super_admin/admin). Import uses multipart/form-data.

---

## Ingredient Category

### GET `/ingredient-category/get-all`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": [{ "id": 1, "name": "Bahan Pokok", "description": "" }]
}
```

---

### GET `/ingredient-category/get-by-id/:id`
Auth required.

### POST `/ingredient-category/add`
Auth required (super_admin/admin).

**Request:**
```json
{ "name": "string (required)", "description": "string (default: '')" }
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
Auth required.

**Query:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Items per page |
| `product` | number | Product ID |
| `referenceType` | string | Filter by type (e.g. `sale`, `purchase`, `adjustment`) |
| `startDate` | string | ISO date |
| `endDate` | string | ISO date |
| `store` | number | Store ID |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "product": 1,
      "productName": "Nasi Goreng",
      "type": "out",
      "quantity": 5,
      "referenceType": "sale",
      "referenceId": 100,
      "notes": "Order #100",
      "createdAt": "2026-07-11T10:30:00Z"
    }
  ],
  "pagination": { "total": 500, "page": 1, "limit": 20, "totalPages": 25 }
}
```

---

### GET `/stock-history/get-by-product/:productId`
Auth required.

### GET `/stock-history/low-stock`
Auth required. **Query:** `store` (number).

### GET `/stock-history/low-stock-all`
No auth. Returns low stock across all stores.

---

## Stock Opname

### GET `/stock-opname/get-all`
Auth required.

**Query:** `page`, `limit`, `search`, `warehouse` (store ID), `status`.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "auditDate": "2026-07-11",
      "auditor": "Budi",
      "status": "completed",
      "store": 1,
      "items": [...]
    }
  ],
  "pagination": { "total": 10, "page": 1, "limit": 10, "totalPages": 1 },
  "stats": { "total": 10, "draft": 2, "completed": 7, "cancelled": 1, "totalItems": 150 }
}
```

---

### GET `/stock-opname/get-by-id/:id`
Auth required.

### GET `/stock-opname/check-exists`
Auth required. **Query:** `store` (number).

### GET `/stock-opname/composition-items`
Auth required. **Query:** `store` (number).

### POST `/stock-opname/create`
Auth required (super_admin/admin).

**Request:**
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

**Request:**
```json
{ "status": "active | inactive | draft (required)" }
```

### GET `/stock-opname/download-excel`, POST `/stock-opname/export-selected`, POST `/stock-opname/upload-excel`
Auth required (super_admin/admin).

---

## Expense

### GET `/expense/get-all`
Auth required.

**Query:** `page`, `limit`, `search`, `status` (pending|approved|rejected), `store`.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "categoryId": 1,
      "categoryName": "Operasional",
      "amount": 500000,
      "description": "Listrik bulanan",
      "date": "2026-07-11",
      "status": "approved",
      "store": 1
    }
  ],
  "pagination": { "total": 30, "page": 1, "limit": 10, "totalPages": 3 },
  "summary": { "total": 5000000, "count": 15 },
  "stats": { "draft": 2, "pending": 5, "approved": 7, "rejected": 1 }
}
```

---

### GET `/expense/get-by-id/:id`
Auth required.

### GET `/expense/get-summary`
Auth required. **Query:** `store`, `startDate`, `endDate`.

**Response:**
```json
{
  "success": true,
  "data": { "total": 5000000, "count": 15, "byCategory": [...] }
}
```

---

### POST `/expense/add`
Auth required (super_admin/admin).

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "Expense created",
  "data": { "id": 1, "amount": 500000, "status": "pending" }
}
```

---

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

**Response:**
```json
{
  "success": true,
  "data": [{ "id": 1, "name": "Operasional", "description": "" }]
}
```

---

### POST `/expense-category/add`
Auth required (super_admin/admin).

**Request:**
```json
{ "name": "string (required)", "description": "string (default: '')" }
```

### PUT `/expense-category/edit/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/expense-category/delete/:id`
Auth required (super_admin/admin).

---

## Cash Register

### POST `/cash-register/open`
Auth required (super_admin/admin).

**Request:**
```json
{
  "store": "number (required)",
  "initialBalance": "number (required)",
  "cashierId": "number (optional)",
  "notes": "string (default: '')"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cash register opened",
  "data": { "id": 1, "store": 1, "initialBalance": 500000, "status": "open" }
}
```

---

### PUT `/cash-register/close/:id`
Auth required (super_admin/admin).

**Request:**
```json
{
  "id": "number (required)",
  "finalBalance": "number (required)",
  "notes": "string (default: '')"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cash register closed",
  "data": { "id": 1, "finalBalance": 1500000, "status": "closed", "totalSales": 1000000 }
}
```

---

### GET `/cash-register/current`
Auth required. **Query:** `store` (number).

**Response:**
```json
{
  "success": true,
  "data": { "id": 1, "store": 1, "initialBalance": 500000, "status": "open", "openedAt": "2026-07-11T08:00:00Z" }
}
```

---

### GET `/cash-register/history`
Auth required. **Query:** `page`, `limit`, `store`, `search`.

---

## Purchase Order

### GET `/purchase-order/get-all`
Auth required.

**Query:** `page`, `limit`, `search`, `store`, `status` (draft|pending|ordered|received|cancelled).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "poNumber": "PO-20260711-001",
      "store": 1,
      "supplier": { "id": 1, "name": "PT Sumber" },
      "status": "ordered",
      "total": 5000000,
      "orderDate": "2026-07-11",
      "dueDate": "2026-07-18",
      "items": [...]
    }
  ],
  "pagination": { "total": 20, "page": 1, "limit": 10, "totalPages": 2 },
  "stats": { "draft": 3, "pending": 5, "ordered": 8, "received": 3, "cancelled": 1 },
  "paymentStats": { "unpaid": 10, "partial": 3, "paid": 7 }
}
```

---

### GET `/purchase-order/get-by-id/:id`
Auth required.

### POST `/purchase-order/create`
Auth required (super_admin/admin).

**Request:**
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

**Response:**
```json
{
  "success": true,
  "message": "PO created",
  "data": { "id": 1, "poNumber": "PO-20260711-001", "status": "draft" }
}
```

---

### PUT `/purchase-order/update/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/purchase-order/delete/:id`
Auth required (super_admin/admin).

### PUT `/purchase-order/receive/:id`
Auth required (super_admin/admin). Marks PO as received, updates stock.

### PUT `/purchase-order/cancel/:id`
Auth required (super_admin/admin).

### GET `/purchase-order/template`, GET `/purchase-order/download`, POST `/purchase-order/import`
Auth required. Import uses multipart/form-data.

---

## Purchase Payment

### GET `/purchase-payment/list`
Auth required. **Query:** `page`, `limit`.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "purchaseOrderId": 1,
      "poNumber": "PO-20260711-001",
      "paymentMethod": "transfer",
      "paymentAmount": 2500000,
      "paymentDate": "2026-07-11",
      "notes": ""
    }
  ],
  "pagination": { "total": 15, "page": 1, "limit": 10, "totalPages": 2 }
}
```

---

### GET `/purchase-payment/detail/:id`
Auth required.

### GET `/purchase-payment/by-po/:poId`
Auth required.

### GET `/purchase-payment/by-supplier/:supplierId`
Auth required.

### GET `/purchase-payment/ap-dashboard`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAP": 50000000,
    "paid": 30000000,
    "unpaid": 20000000,
    "overdue": 5000000,
    "bySupplier": [...]
  }
}
```

---

### POST `/purchase-payment/create`
Auth required (super_admin/admin).

**Request:**
```json
{
  "purchaseOrderId": "number (required)",
  "paymentMethod": "string (required)",
  "paymentAmount": "number (required)",
  "paymentDate": "string (optional, ISO date)",
  "notes": "string (default: '')"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Payment recorded",
  "data": { "id": 1, "paymentAmount": 2500000 }
}
```

---

### DELETE `/purchase-payment/delete/:id`
Auth required (super_admin/admin).

---

## Purchase Return

### GET `/purchase-return/get-all`
Auth required. **Query:** `page`, `limit`, `search`, `store`, `status`.

### GET `/purchase-return/get-by-id/:id`
Auth required.

### GET `/purchase-return/by-po/:poId`
Auth required.

### POST `/purchase-return/create`
Auth required (super_admin/admin).

**Request:**
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
Auth required. **Query:** `page`, `limit`, `search`, `status`, `store`.

### GET `/goods-receipt/get-by-id/:id`
Auth required.

### GET `/goods-receipt/by-po/:poId`
Auth required.

### GET `/goods-receipt/export`
Auth required. Returns Excel file.

### POST `/goods-receipt/create`
Auth required (super_admin/admin).

**Request:**
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

**Request:**
```json
{ "status": "active | inactive | draft (required)" }
```

---

## BOM (Bill of Materials)

### GET `/bom/get-all`
Auth required (super_admin/admin).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "productId": 1,
      "productName": "Nasi Goreng",
      "name": "Resep Nasi Goreng",
      "status": "active",
      "lines": [
        { "ingredientId": 1, "ingredientName": "Beras", "qty": 0.5, "unit": "kg" }
      ]
    }
  ]
}
```

---

### GET `/bom/get-by-id/:id`
Auth required.

### POST `/bom/add`
Auth required (super_admin/admin).

**Request:**
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
Auth required. **Query:** `page`, `limit`, `search`, `status`.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "productItem": { "id": 1, "name": "Nasi Goreng" },
      "plannedQty": 100,
      "producedQty": 0,
      "status": "planned",
      "scheduledDate": "2026-07-12"
    }
  ],
  "pagination": { "total": 10, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

### GET `/production-order/get-by-id/:id`
Auth required.

### POST `/production-order/create`
Auth required (super_admin/admin).

**Request:**
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

**Request:**
```json
{ "status": "planned | in_progress | completed | cancelled | draft (required)" }
```

### POST `/production-order/start/:id`
Auth required (super_admin/admin). Sets status to `in_progress`.

### POST `/production-order/complete/:id`
Auth required (super_admin/admin). Sets status to `completed`, deducts ingredients, adds product stock.

---

## Sales Return

### GET `/sales-return/get-all`
Auth required. **Query:** `page`, `limit`, `search`, `store`, `status`.

### GET `/sales-return/get-by-id/:id`
Auth required.

### PATCH `/sales-return/approve/:id`
Auth required (super_admin/admin).

### PATCH `/sales-return/reject/:id`
Auth required (super_admin/admin).

---

## Employee

### GET `/employee/get-employee`
Auth required. **Query:** `search` (string), `store` (number).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "employeeID": "EMP-2026-001",
      "fullName": "Budi Santoso",
      "userName": "budi",
      "position": { "id": 1, "name": "Kasir" },
      "department": { "id": 1, "name": "Front Office" },
      "store": [1],
      "status": "active"
    }
  ]
}
```

---

### GET `/employee/get-employee/:id`
Auth required. Get by DB ID.

### GET `/employee/get-employee-detail/:employeeID`
Auth required. Get by employee ID string.

### POST `/employee/add-employee`
Auth required (super_admin/admin). Content-Type: `multipart/form-data`.

**Request:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `userName` | string | **YES** | - |
| `password` | string | **YES** | - |
| `confirmPassword` | string | **YES** | - |
| `fullName` | string | No | `''` |
| `email` | string | No | - |
| `phoneNumber` | string | No | `''` |
| `gender` | string | No | `''` |
| `address` | string | No | `''` |
| `dateOfBirth` | string | No | null |
| `placeOfBirth` | string | No | `''` |
| `store` | number | No | null |
| `shift` | number | No | null |
| `position` | number | No | null |
| `roleId` | number | No | null |
| `department` | string | No | null |
| `departmentId` | number | No | null |
| `employmentType` | string | No | null |
| `startDate` | string | No | null |
| `status` | string | No | `active` |
| `monthlySalary` | string | No | null |
| `dailySalary` | string | No | null |
| `avatar` | file | No | null |

### PUT `/employee/edit-employee`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/employee/delete-employee/:id`
Auth required (super_admin/admin).

---

## Department

### GET `/department/get-department`
Auth required. Returns all departments (dropdown).

**Response:**
```json
{
  "success": true,
  "data": [{ "id": 1, "name": "Front Office", "status": "active" }]
}
```

---

### GET `/department/get-department-all`
Auth required. **Query:** `page`, `limit`, `search`.

### GET `/department/get-department/:id`
Auth required.

### POST `/department/add-new-department`
Auth required (super_admin/admin).

**Request:**
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
Auth required. Returns all positions (dropdown).

### GET `/position/get-position/:id`
Auth required.

### GET `/position/get-position-all`
Auth required. **Query:** `page`, `limit`, `search`.

### POST `/position/add-new-position`
Auth required (super_admin/admin).

**Request:**
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
No auth. Returns roles for dropdown.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Super Admin", "permissions": {} },
    { "id": 2, "name": "Admin", "permissions": {} }
  ]
}
```

---

### GET `/role/get-role-all`
Auth required (super_admin). **Query:** `page` (number).

### GET `/role/get-role-by-id/:id`
Auth required.

### POST `/role/add-new-role`
Auth required (super_admin).

**Request:**
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

**Request:**
```json
{ "userId": "number (required)", "roleId": "number (required)" }
```

### GET `/role/get-users-by-role`
Auth required. **Query:** `roleId` (number).

### PUT `/role/update-access-menu`
Auth required (super_admin).

**Request:**
```json
{
  "roleId": "number (required)",
  "accessMenu": "JSON object (required)"
}
```

---

## Report

### GET `/report/daily`
Auth required. **Query:** `store` (number), `startDate` (ISO date), `endDate` (ISO date).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "tanggal": "2026-07-11",
      "totalTransaksi": 50,
      "totalPenjualanBersih": 4500000,
      "totalHpp": 1800000,
      "foodCostPersen": 40,
      "grossProfit": 2700000,
      "netProfit": 2200000,
      "totalCovers": 80
    }
  ]
}
```

---

### GET `/report/profit-loss`
Auth required. **Query:** `store`, `startDate`, `endDate`.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRevenue": 50000000,
    "totalDiscount": 5000000,
    "netRevenue": 45000000,
    "totalHpp": 18000000,
    "grossProfit": 27000000,
    "marginPersen": 60
  }
}
```

---

### GET `/report/cash-flow`
Auth required. **Query:** `store`, `startDate`, `endDate`.

**Response:**
```json
{
  "success": true,
  "data": {
    "penerimaanTunai": 30000000,
    "penerimaanQris": 10000000,
    "penerimaanTransfer": 5000000,
    "totalKasMasuk": 45000000,
    "totalPengeluaran": 10000000,
    "netCashFlow": 35000000
  }
}
```

---

### GET `/report/sales-summary`
Auth required. **Query:** `store`, `startDate`, `endDate`, `filter` (today|weekly|monthly).

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSales": 50000000,
    "totalOrders": 500,
    "avgTransaction": 100000,
    "totalCustomers": 200,
    "totalStores": 5,
    "salesChart": [{ "date": "2026-07-11", "sales": 5000000, "orders": 50 }],
    "storeSalesChart": [{ "storeId": 1, "storeName": "Jakarta", "data": [...] }],
    "stores": [{ "id": 1, "name": "Jakarta", "sales": 5000000, "transactions": 50 }]
  }
}
```

---

### GET `/report/best-seller`
Auth required. **Query:** `store`, `startDate`, `endDate`, `limit`.

**Response:**
```json
{
  "success": true,
  "data": {
    "bestSellers": [{ "id": 1, "name": "Nasi Goreng", "image": "...", "sold": 100, "revenue": 2500000 }],
    "summary": { "totalUnitsSold": 500, "totalRevenue": 25000000, "activeProducts": 50 }
  }
}
```

---

### GET `/report/profit-per-product`
Auth required. **Query:** `store`, `startDate`, `endDate`.

**Response:**
```json
{
  "success": true,
  "data": [
    { "productId": 1, "productName": "Nasi Goreng", "qtySold": 100, "totalSales": 2500000, "totalHpp": 1000000, "profit": 1500000, "margin": 60 }
  ]
}
```

---

## Promo Campaign

### GET `/promo/campaigns`
Auth required. **Query:** `store` (number).

### GET `/promo/campaigns/stats`
Auth required. **Query:** `store`.

### GET `/promo/campaigns/:id`
Auth required.

### POST `/promo/campaigns`
Auth required (super_admin/admin). Create promo campaign with rules & rewards.

**Request:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `store` | number | YES | - | Store ID |
| `name` | string | YES | - | Campaign name |
| `type` | string | YES | - | `happy_hour`, `birthday`, `buy_x_get_y`, `spend_get`, `manual`, `automatic` |
| `discountType` | string | No | `percentage` | `percentage`, `fixed`, `free_item`, `buy_x_get_y` |
| `discountValue` | number | No | `0` | Discount amount/percentage |
| `maxDiscount` | number | No | null | Cap for percentage discounts |
| `minPurchase` | number | No | `0` | Minimum cart subtotal |
| `startDate` | date | YES | - | ISO date |
| `endDate` | date | YES | - | ISO date |
| `startTime` | string | No | null | HH:mm:ss |
| `endTime` | string | No | null | HH:mm:ss |
| `daysOfWeek` | number[] | No | null | 0-6 (Sun-Sat) |
| `applicableTo` | string | No | `all` | `all`, `specific_products`, `specific_categories`, `specific_members` |
| `applicableIds` | number[] | No | null | Product/category/member IDs |
| `maxUsageTotal` | number | No | null | Global usage cap |
| `maxUsagePerMember` | number | No | null | Per-member usage cap |
| `priority` | number | No | `0` | Higher = evaluated first |
| `isCombinable` | boolean | No | `false` | Can stack with other promos |
| `rules` | object[] | No | - | Array of `{ ruleType, condition, priority }` |
| `rewards` | object[] | No | - | Array of `{ rewardType, rewardValue, maxRewardValue, productId, quantity, condition }` |

**Rules ruleType:** `time`, `birthday`, `buy_x_get_y`, `spend_threshold`, `member_tier`, `first_purchase`, `custom`
**Rewards rewardType:** `discount_percentage`, `discount_fixed`, `free_item`, `buy_x_get_y`, `points_multiplier`, `cashback`

### PUT `/promo/campaigns/:id`
Auth required (super_admin/admin). Same fields, all optional.

### PUT `/promo/campaigns/:id/status`
Auth required (super_admin/admin). Toggle campaign status.

### DELETE `/promo/campaigns/:id`
Auth required (super_admin/admin).

### POST `/promo/apply`
Auth required. Apply promo to cart.

**Request:**
```json
{
  "store": "number (required)",
  "memberId": "number (optional)",
  "code": "string (optional)",
  "cartItems": [{ "productId": 1, "quantity": 2, "price": 25000 }],
  "subtotal": 50000
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "applicablePromos": [{ "campaignId": 1, "name": "Happy Hour", "discountAmount": 5000 }],
    "bestPromo": { "campaignId": 1, "name": "Happy Hour", "discountAmount": 5000 }
  }
}
```

### POST `/promo/usage`
Auth required (admin/cashier). Record promo usage event.

### POST `/promo/auto-activate`
Auth required (super_admin). Auto-activate campaigns based on schedule.

---

## Product Bundle / Combo

### GET `/product-bundle/get-all`
Auth required. **Query:** `store`, `status`, `search`, `page`, `limit`.

**Response:**
```json
{
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1, "name": "Paket Hemat A", "sku": "BNDL-20260718-0042",
        "bundlePrice": 75000, "originalPrice": 100000,
        "discountAmount": 25000, "discountPercentage": 25.0,
        "status": "active",
        "items": [{ "product": 10, "quantity": 2, "unitPrice": 30000, "productData": { "nameProduct": "Kopi Susu", "stock": 100 } }]
      }
    ],
    "total": 25, "pagination": { "page": 1, "limit": 10, "totalPages": 3 },
    "stats": { "active": 10, "draft": 5, "inactive": 10, "total": 25 }
  }
}
```

### GET `/product-bundle/get-by-id/:id`
Auth required.

### POST `/product-bundle/create`
Auth required (super_admin/admin).

**Request:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `name` | string | YES | - |
| `description` | string | No | - |
| `bundlePrice` | number | No | `0` |
| `items` | object[] | YES | - |
| `items[].product` | number | YES | - |
| `items[].quantity` | No | `1` |
| `items[].unitPrice` | No | product price |
| `isAvailable` | boolean | No | `true` |
| `status` | string | No | `draft` |
| `validFrom` | date | No | null |
| `validUntil` | date | No | null |

### PUT `/product-bundle/update/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/product-bundle/delete/:id`
Auth required (super_admin/admin).

### PATCH `/product-bundle/status/:id`
Auth required (super_admin/admin). Toggle bundle status.

---

## Delivery Management

### GET `/delivery/orders`
Auth required. **Query:** `store`, `status`, `page`, `limit`.

### GET `/delivery/orders/stats`
Auth required. **Query:** `store`.

**Response:**
```json
{
  "success": true,
  "data": { "total": 100, "pending": 10, "assigned": 5, "inTransit": 8, "delivered": 70, "cancelled": 7 }
}
```

### GET `/delivery/orders/:id`
Auth required.

### POST `/delivery/orders`
Auth required (super_admin/admin).

**Request:**
| Field | Type | Required |
|-------|------|----------|
| `store` | number | YES |
| `customerName` | string | YES |
| `customerPhone` | string | No |
| `deliveryAddress` | string | YES |
| `deliveryNotes` | string | No |
| `destinationLat` | number | No |
| `destinationLng` | number | No |
| `deliveryFee` | number | No |
| `totalDistance` | number | No |
| `source` | string | No (`pos`, `gofood`, `grabfood`, `shopeefood`) |

### PUT `/delivery/orders/status`
Auth required (super_admin/admin). Update delivery status.

### PUT `/delivery/orders/:orderId/assign-driver`
Auth required (super_admin/admin).

### PUT `/delivery/orders/:id/cancel`
Auth required (super_admin/admin).

### GET `/delivery/drivers`
Auth required. **Query:** `store`, `status`.

### GET `/delivery/drivers/:id`
Auth required.

### POST `/delivery/drivers`
Auth required (super_admin/admin).

**Request:**
| Field | Type | Required |
|-------|------|----------|
| `name` | string | YES |
| `store` | number[] | No |
| `phone` | string | No |
| `email` | string | No |
| `vehicleType` | string | No |
| `vehiclePlate` | string | No |
| `status` | string | No (`active`, `inactive`, `busy`, `offline`, `draft`) |

### PUT `/delivery/drivers/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/delivery/drivers/:id`
Auth required (super_admin/admin).

### PUT `/delivery/drivers/:id/status`
Auth required (super_admin/admin). Update driver availability.

### GET `/delivery/marketplace-config`
Auth required. **Query:** `store`.

**Response:**
```json
{
  "success": true,
  "data": {
    "store": 1,
    "gofood": { "enabled": false, "merchantId": null, "apiKey": null },
    "grabfood": { "enabled": false, "merchantId": null, "apiKey": null },
    "shopeefood": { "enabled": false, "merchantId": null, "apiKey": null }
  }
}
```

### POST `/delivery/marketplace-config`
Auth required (super_admin). Save marketplace config.

### GET `/delivery/stats`
Auth required. **Query:** `store`.

---

## Queue Management

### GET `/queue/`
Auth required. **Query:** `store`, `status`, `page`, `limit`.

### GET `/queue/stats`
Auth required. **Query:** `store`.

**Response:**
```json
{
  "success": true,
  "data": { "totalToday": 42, "waitingNow": 5, "seatedToday": 30, "cancelledToday": 3, "avgWaitMinutes": 12 }
}
```

### GET `/queue/:id`
Auth required.

### POST `/queue/`
Auth required (super_admin/admin/cashier).

**Request:**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `store` | number | YES | - |
| `customerName` | string | YES | - |
| `customerPhone` | string | No | null |
| `partySize` | number | No | `1` |
| `priority` | string | No | `normal` (`normal`, `vip`, `elderly`, `pregnant`, `disabled`) |
| `estimatedWaitMinutes` | number | No | null |
| `notes` | string | No | null |

**Response:** Queue entry with auto-generated `queueNumber` (format: `QHHMM-XXX`).

### PUT `/queue/:id`
Auth required (super_admin/admin/cashier). Same fields, all optional.

### PUT `/queue/:id/status`
Auth required (super_admin/admin/cashier). Update queue status (`waiting`, `seated`, `completed`, `cancelled`).

### DELETE `/queue/:id`
Auth required (super_admin/admin).

---

## Supplier Performance

### GET `/supplier-performance/scores`
Auth required. **Query:** `store`, `search`, `period` (monthly|quarterly|yearly|all_time), `grade` (A-F), `page`, `limit`.

**Response:**
```json
{
  "success": true,
  "data": [{
    "id": 1, "supplierId": 5, "period": "monthly",
    "periodStart": "2026-06-01", "periodEnd": "2026-06-30",
    "totalOrders": 15, "completedOrders": 14, "cancelledOrders": 1,
    "onTimeDeliveries": 12, "lateDeliveries": 2, "onTimeRate": "85.71",
    "totalReceivedQty": 500, "defectiveQty": 5, "defectRate": "1.00",
    "totalPurchaseAmount": 5000000, "avgPricePerItem": 10000,
    "priceCompetitivenessScore": 90, "overallScore": "88.14", "grade": "B",
    "supplier": { "id": 5, "name": "PT Sumber Jaya" }
  }],
  "pagination": { "page": 1, "limit": 10, "total": 30, "totalPages": 3 }
}
```

### GET `/supplier-performance/scores/top`
Auth required. **Query:** `store`.

### GET `/supplier-performance/scores/:id`
Auth required.

### GET `/supplier-performance/performance/:supplierId`
Auth required. Detailed performance summary.

### POST `/supplier-performance/scores/calculate`
Auth required (super_admin/admin). Recalculate supplier score.

**Request:**
| Field | Type | Required |
|-------|------|----------|
| `store` | number | YES |
| `supplierId` | number | YES |
| `period` | string | YES (`monthly`, `quarterly`, `yearly`, `all_time`) |
| `periodStart` | date | No (auto-calculated) |
| `periodEnd` | date | No (auto-calculated) |

**Score formula:** onTime(40%) + (100-defectRate)(30%) + priceCompetitiveness(30%)
**Grade:** A (>=90), B (>=80), C (>=70), D (>=60), F (<60)

### PUT `/supplier-performance/scores/:id/notes`
Auth required (super_admin/admin). Update notes.

---

## Best Selling

### GET `/best-selling/get-chart-by-year`
Auth required (super_admin/admin). **Query:** `store`, `year`.

### GET `/best-selling/get-chart-by-month`
Auth required (super_admin/admin). **Query:** `store`, `year`, `month`.

### GET `/best-selling/get-chart-current-and-two-days-before`
Auth required. **Query:** `store`.

### GET `/best-selling/get-chart-current-and-seven-days-before`
Auth required. **Query:** `store`.

### GET `/best-selling/get-earning-today`
Auth required. **Query:** `store`.

**Response:**
```json
{
  "success": true,
  "data": { "total": 5000000, "orders": 50, "avgOrder": 100000 }
}
```

---

## Overview (Dashboard)

All require auth. **Query:** `store` (number).

| Endpoint | Response `data` |
|----------|-----------------|
| GET `/overview/product` | `{ total, active, inactive }` |
| GET `/overview/category` | `{ total }` |
| GET `/overview/location` | `{ total, active }` |
| GET `/overview/member` | `{ total, active }` |
| GET `/overview/user` | `{ total, active }` |
| GET `/overview/best-selling` | Array of top products |
| GET `/overview/members/latest` | Array of recent members |
| GET `/overview/categories/latest` | Array of recent categories |
| GET `/overview/locations/latest` | Array of recent locations |
| GET `/overview/products/latest` | Array of recent products |

---

## POS Extended

### GET `/pos/lookup-barcode`
Auth required. **Query:** `barcode` (string), `store` (number).

**Response:**
```json
{
  "success": true,
  "data": { "id": 1, "nameProduct": "Nasi Goreng", "price": 25000, "stock": 100 }
}
```

---

### POST `/pos/transfer`
Auth required (super_admin/admin).

**Request:**
```json
{
  "fromStore": "number (required)",
  "toStore": "number (required)",
  "items": [
    { "product": "number (required)", "quantity": "number (required)", "notes": "string (default: '')" }
  ],
  "notes": "string (default: '')",
  "transferredBy": "number (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Stock transfer created",
  "data": { "id": 1, "transferNumber": "TRF-1717234567890", "status": "pending" }
}
```

---

### GET `/pos/transfer-history`
Auth required. **Query:** `page`, `limit`, `status`, `startDate`, `endDate`, `store`.

### GET `/pos/transfer/:id`
Auth required.

### PUT `/pos/transfer/:id/receive`
Auth required (super_admin/admin). Confirms transfer, moves stock.

### PUT `/pos/transfer/:id/cancel`
Auth required (super_admin/admin).

### POST `/pos/adjust`
Auth required (super_admin/admin).

**Request:**
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

**Request:**
```json
{
  "items": "array of { productId, quantity, reason } (required, min 1)",
  "reason": "string (default: '')",
  "returnedBy": "number (optional)"
}
```

### POST `/pos/order/:id/return`
Auth required (super_admin/admin). Same structure as PO return.

### GET `/pos/member/:id/point-history`
Auth required. **Query:** `page`, `limit`.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "type": "earn", "points": 100, "description": "Order #100", "createdAt": "2026-07-11" },
    { "id": 2, "type": "redeem", "points": -50, "description": "Discount redemption", "createdAt": "2026-07-10" }
  ],
  "pagination": { "total": 20, "page": 1, "limit": 10, "totalPages": 2 }
}
```

---

### GET `/pos/dashboard/summary`
Auth required. **Query:** `store` (number).

**Response:**
```json
{
  "success": true,
  "data": {
    "todaySales": 5000000,
    "todayOrders": 50,
    "monthSales": 150000000,
    "activeMembers": 200,
    "lowStockCount": 5
  }
}
```

---

### GET `/pos/product/price-by-store`
Auth required (super_admin/admin). **Query:** `productId` (number).

### PUT `/pos/product/update-price-by-store`
Auth required (super_admin/admin).

**Request:**
```json
{
  "productId": "number (required)",
  "storePrices": [
    { "storeId": 1, "price": 25000 },
    { "storeId": 2, "price": 27000 }
  ]
}
```

### POST `/pos/invoice/send-wa`
Auth required.

**Request:**
```json
{ "orderId": "number (required)", "phone": "string (required)" }
```

### POST `/pos/invoice/send-email`
Auth required.

**Request:**
```json
{ "orderId": "number (required)", "email": "string (required, valid email)" }
```

### GET `/pos/whatsapp/status`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": { "connected": true, "number": "6281234567890" }
}
```

---

### POST `/pos/whatsapp/logout`
Auth required (super_admin/admin).

### POST `/pos/whatsapp/restart`
Auth required (super_admin/admin).

### POST `/pos/product/add-batch`
Auth required (super_admin/admin).

**Request:**
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
Auth required. **Query:** `productId`, `store`.

---

## Accounts Receivable

### GET `/accounts-receivable/list`
Auth required. **Query:** `page`, `limit`, `status` (pending|partial|paid), `store`.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "orderId": 100,
      "customerName": "PT Maju",
      "totalAmount": 5000000,
      "paidAmount": 2000000,
      "remainingAmount": 3000000,
      "dueDate": "2026-07-31",
      "status": "partial"
    }
  ],
  "pagination": { "total": 10, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

### GET `/accounts-receivable/aging`
Auth required. **Query:** `store` (number).

**Response:**
```json
{
  "success": true,
  "data": {
    "current": 10000000,
    "days1To30": 5000000,
    "days31To60": 2000000,
    "days61To90": 1000000,
    "over90": 500000
  }
}
```

---

### GET `/accounts-receivable/:id`
Auth required.

### POST `/accounts-receivable/create`
Auth required (super_admin/admin).

**Request:**
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

**Request:**
```json
{ "amount": "number (required)", "paymentMethod": "string (optional)", "notes": "string (optional)" }
```

### PUT `/accounts-receivable/:id`
Auth required (super_admin/admin). Same fields, all optional.

### DELETE `/accounts-receivable/:id`
Auth required (super_admin/admin).

---

## Tax Config

### GET `/tax-config/`
Auth required. **Query:** `page`, `limit`, `search`.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "PPN 11%", "rate": 11, "type": "ppn", "status": "active" }
  ],
  "pagination": { "total": 5, "page": 1, "limit": 10, "totalPages": 1 }
}
```

---

### GET `/tax-config/get-tax-config/:id`
Auth required.

### POST `/tax-config/add-new-tax-config`
Auth required (super_admin/admin).

**Request:**
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
Auth required. Seeds default PPh 2026 tax configuration.

---

## Invoice

### GET `/invoice/setting`
Auth required. **Query:** `store` (number).

**Response:**
```json
{
  "success": true,
  "data": {
    "store": 1,
    "showStoreName": true,
    "showAddress": true,
    "showMemberInfo": true,
    "showLogo": true,
    "showSocialMedia": true,
    "socialMediaVisibility": { "instagram": true, "facebook": true },
    "logo": "https://..."
  }
}
```

---

### PUT `/invoice/setting`
Auth required (super_admin/admin). Content-Type: `multipart/form-data`.

**Request:**
| Field | Type | Required |
|-------|------|----------|
| `store` | number | **YES** |
| `showStoreName` | boolean | No |
| `showAddress` | boolean | No |
| `showMemberInfo` | boolean | No |
| `showLogo` | boolean | No |
| `showSocialMedia` | boolean | No |
| `socialMediaVisibility` | JSON object | No |
| `removeLogo` | boolean | No |
| `logo` | file | No |

### POST `/invoice/setting/reset`
Auth required (super_admin/admin). Resets to defaults.

---

## Notification

### GET `/notification/`
Auth required. **Query:** `page` (number).

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "title": "Low Stock", "message": "Beras stock below minimum", "type": "warning", "isRead": false, "createdAt": "2026-07-11T10:00:00Z" }
  ],
  "pagination": { "total": 20, "page": 1, "limit": 20, "totalPages": 1 }
}
```

---

### GET `/notification/unread`
Auth required.

**Response:**
```json
{ "success": true, "data": { "count": 5 } }
```

---

### PUT `/notification/:id/read`
Auth required. Marks single notification as read.

### PUT `/notification/read-all`
Auth required. Marks all notifications as read.

---

## Currency

### GET `/currency/`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "code": "IDR", "name": "Indonesian Rupiah", "symbol": "Rp", "exchangeRate": 1, "isDefault": true }
  ]
}
```

---

### GET `/currency/:id`
Auth required.

### POST `/currency/`
Auth required (super_admin/admin).

**Request:**
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
Auth required (super_admin/admin). Sets this currency as default, unsets others.

---

## Audit Log

### GET `/audit-log/`
Auth required (super_admin). **Query:** `page`, `limit`.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "entity": "product",
      "entityId": 10,
      "action": "update",
      "userId": 1,
      "userName": "admin",
      "changes": { "price": { "old": 20000, "new": 25000 } },
      "createdAt": "2026-07-11T10:30:00Z"
    }
  ],
  "pagination": { "total": 500, "page": 1, "limit": 20, "totalPages": 25 }
}
```

---

### GET `/audit-log/:entity/:entityId`
Auth required (super_admin). Returns audit trail for specific entity.

---

## Social Media

### GET `/social-media/get-social-media`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "name": "Instagram", "url": "https://instagram.com/mystore", "icon": "instagram", "isActive": true }
  ]
}
```

---

### POST `/social-media/add-social-media`
Auth required (super_admin/admin).

**Request:**
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
Auth required. **Query:** `page`, `limit`, `date`, `status` (pending|confirmed|completed|cancelled|no_show), `store`.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "customerName": "John",
      "customerPhone": "08123456789",
      "reservationDate": "2026-07-12",
      "startTime": "19:00",
      "endTime": "21:00",
      "guestCount": 4,
      "table": { "id": 1, "tableNumber": "T1" },
      "status": "confirmed"
    }
  ],
  "pagination": { "total": 15, "page": 1, "limit": 10, "totalPages": 2 }
}
```

---

### GET `/reservation/available-tables/list`
Auth required. **Query:** `store`, `date`, `time`, `guestCount`.

### GET `/reservation/:id`
Auth required.

### POST `/reservation/`
Auth required.

**Request:**
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
Auth required (super_admin/admin). Cancels reservation.

---

## Split Bill

### POST `/split-bill/create`
Auth required (super_admin/admin).

**Request:**
```json
{
  "orderId": "number (required)",
  "items": [
    { "idProduct": "number (required)", "qty": "number (required)" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Split bill created",
  "data": { "id": 1, "orderId": 100, "items": [...], "total": 25000 }
}
```

---

### GET `/split-bill/get-by-order/:orderId`
Auth required.

### PUT `/split-bill/pay/:id`
Auth required (super_admin/admin).

### DELETE `/split-bill/cancel/:id`
Auth required (super_admin/admin).

### POST `/split-bill/merge`
Auth required (super_admin/admin).

**Request:**
```json
{ "orderId": "number (required)" }
```

---

## Export

### GET `/export/master-data`
Auth required (super_admin/admin). **Query:** `store` (number). Returns Excel file with all master data.

---

## Receipt

### GET `/receipt/order/:orderId`
Auth required.

**Response:**
```json
{
  "success": true,
  "data": {
    "orderNumber": "ORD-20260711-001",
    "store": { "name": "Store Jakarta", "address": "Jl. Sudirman 123" },
    "items": [...],
    "subTotal": 50000,
    "tax": 5500,
    "total": 55500,
    "paymentMethod": "cash",
    "paymentAmount": 60000,
    "change": 4500,
    "createdAt": "2026-07-11T10:30:00Z"
  }
}
```

---

## FAQ

### GET `/faq/faq`
No auth. **Query:** `search` (string), `category` (string).

**Response:**
```json
{
  "success": true,
  "data": [
    { "id": 1, "question": "How to add product?", "answer": "Go to Product > Add...", "category": "product" }
  ]
}
```

---

### POST `/faq/faq/ask`
No auth. Ask Gemini AI assistant.

**Request:**
```json
{ "question": "string (required)" }
```

**Response:**
```json
{
  "success": true,
  "data": { "answer": "AI-generated answer here" }
}
```

---

## Misc

### GET `/`
No auth. Health check.

**Response:**
```
POS API is running
```

### POST `/print-thermal`
No auth. ESC/POS thermal print via Bluetooth.

---

**Total: ~260 endpoints across 54 modules**
