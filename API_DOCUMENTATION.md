# POS System - API Documentation

**Base URL:** `https://api-bisa-nota.vercel.app`
**Auth:** `Authorization: Bearer <JWT_TOKEN>` header
**Roles:** `super_admin`, `admin`, `user`
**Content-Type:** `application/json` (unless FormData)

---

## Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/login` | No | Login, returns JWT |
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/reset-password` | No | Reset password |
| POST | `/auth/logout` | Yes | Logout |
| GET | `/auth/get-user` | Yes | Get current user |
| GET | `/auth/get-all-user` | Yes (super_admin) | Get all users |
| GET | `/auth/generate-employee-id` | Yes | Generate employee ID |
| PUT | `/auth/change-profile-user` | Yes (super_admin) | Change user role |
| PUT | `/auth/edit-user` | Yes | Edit profile |

---

## Product

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/product/get-product` | Yes | Get products (cashier) |
| GET | `/product/get-product-by-super-admin` | Yes | Get products (super admin) |
| GET | `/product/get-product-all` | Yes | Get all products |
| GET | `/product/get-by-id/:id` | Yes | Get product by ID |
| POST | `/product/add-product` | Yes (super_admin/admin) | Create product |
| PUT | `/product/edit-product` | Yes (super_admin/admin) | Update product |
| DELETE | `/product/delete-product/:id` | Yes (super_admin/admin) | Delete product |
| GET | `/product/template` | Yes | Download Excel template |
| GET | `/product/download` | Yes | Download product data |
| POST | `/product/import` | Yes | Import from Excel |

---

## Category

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/category/get-category-all` | Yes | Get all categories |
| GET | `/category/get-category/:id` | Yes | Get category by ID |
| POST | `/category/add-new-category` | Yes (super_admin/admin) | Create category |
| PUT | `/category/edit-category/:id` | Yes (super_admin/admin) | Update category |
| DELETE | `/category/delete-category/:id` | Yes (super_admin/admin) | Delete category |
| GET | `/category/download-template` | Yes | Download template |
| GET | `/category/download` | Yes | Download data |
| POST | `/category/upload-excel` | Yes | Import from Excel |

---

## Location (Store)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/location/get-location-public` | No | Get active locations |
| GET | `/location/get-location-all` | Yes (super_admin) | Get all locations |
| GET | `/location/get-location-detail/:locationId` | Yes | Get location detail |
| GET | `/location/generate-id` | Yes (super_admin) | Generate location ID |
| POST | `/location/add-new-location` | Yes (super_admin) | Create location |
| PUT | `/location/edit-location` | Yes (super_admin) | Update location |
| DELETE | `/location/delete-location` | Yes (super_admin) | Delete location |

---

## Member

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/member/get-member` | Yes | Get all members |
| GET | `/member/get-member/:id` | Yes | Get member by ID |
| POST | `/member/add-new-member` | Yes (super_admin/admin) | Create member |
| PUT | `/member/edit-member/:id` | Yes (super_admin/admin) | Update member |
| DELETE | `/member/delete-member/:id` | Yes (super_admin/admin) | Delete member |
| PUT | `/member/edit-point-member/:phoneNumber` | Yes | Edit member points |

---

## Member Tier

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/member-tier/get-all` | Yes | Get all tiers |
| GET | `/member-tier/detail/:id` | Yes | Get tier detail |
| GET | `/member-tier/get-by-points` | Yes | Get tier by points |
| POST | `/member-tier/add` | Yes (super_admin/admin) | Create tier |
| PUT | `/member-tier/edit/:id` | Yes (super_admin/admin) | Update tier |
| DELETE | `/member-tier/delete/:id` | Yes (super_admin/admin) | Delete tier |
| POST | `/member-tier/update-members` | Yes | Batch update member tiers |

---

## Order

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/order/create` | Yes | Create order |
| GET | `/order/get-orders` | Yes | Get orders by store |
| GET | `/order/get-order/:id` | Yes | Get order by ID |
| GET | `/order/kitchen` | Yes | Get kitchen orders |
| PUT | `/order/update-status` | Yes | Update order status |
| PUT | `/order/update-item-status` | Yes | Update item status |
| GET | `/order/customer-menu` | No | Customer menu |
| GET | `/order/customer-member` | No | Customer member lookup |
| GET | `/order/customer-order/:id` | No | Customer order status |
| POST | `/order/customer-create` | No | Customer self-order |
| GET | `/order/receipt-html/:id` | No | Receipt HTML |

---

## Checkout

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/checkout/checkout-item` | Yes (super_admin/admin) | Process checkout |
| PUT | `/checkout/edit-checkout-item` | Yes | Edit checkout |
| DELETE | `/checkout/delete-checkout-item` | Yes | Delete checkout |

---

## Table

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/table/get-tables` | Yes | Get tables by store |
| GET | `/table/get-tables-with-orders` | Yes | Tables with orders |
| GET | `/table/get-availability` | Yes | Table availability |
| POST | `/table/create` | Yes (super_admin/admin) | Create table |
| PUT | `/table/update/:id` | Yes (super_admin/admin) | Update table |
| DELETE | `/table/delete/:id` | Yes (super_admin/admin) | Delete table |
| PUT | `/table/update-status/:id` | Yes | Update table status |

---

## Discount

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/discount/get-discount-by-location` | Yes | Get active discounts |
| GET | `/discount/get-discount` | Yes | Get all discounts |
| GET | `/discount/get-discount/:id` | Yes | Get discount by ID |
| GET | `/discount/lookup-by-code/:code` | No | Lookup promo by code |
| POST | `/discount/add-new-discount` | Yes (super_admin/admin) | Create discount |
| PUT | `/discount/edit-discount/:id` | Yes (super_admin/admin) | Update discount |
| DELETE | `/discount/delete-discount/:id` | Yes (super_admin/admin) | Delete discount |
| GET | `/discount/template` | Yes | Download template |
| GET | `/discount/download` | Yes | Download data |
| POST | `/discount/import` | Yes | Import from Excel |

---

## Shift

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/shift/get-shift` | Yes | Get all shifts |
| GET | `/shift/dropdown` | Yes | Shift dropdown |
| POST | `/shift/add-new-shift` | Yes (super_admin/admin) | Create shift |
| PUT | `/shift/edit-shift/:id` | Yes (super_admin/admin) | Update shift |
| DELETE | `/shift/delete-shift/:id` | Yes (super_admin/admin) | Delete shift |

---

## Type Payment

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/type-payment/get-type-payment` | Yes | Get active payment types |
| GET | `/type-payment/get-list-type-payment` | Yes | Get all payment types |
| GET | `/type-payment/get-by-id/:id` | Yes | Get by ID |
| POST | `/type-payment/add-new-type-payment` | Yes (super_admin/admin) | Create |
| PUT | `/type-payment/edit-type-payment/:id` | Yes (super_admin/admin) | Update |
| DELETE | `/type-payment/delete-type-payment/:id` | Yes (super_admin/admin) | Delete |
| GET | `/type-payment/template` | Yes | Download template |
| GET | `/type-payment/download` | Yes | Download data |
| POST | `/type-payment/import` | Yes | Import from Excel |

---

## Supplier

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/supplier/` | Yes | Get all suppliers |
| GET | `/supplier/detail/:id` | Yes | Get supplier detail |
| GET | `/supplier/:id` | Yes | Get supplier by ID |
| POST | `/supplier/` | Yes (super_admin/admin) | Create supplier |
| PUT | `/supplier/:id` | Yes (super_admin/admin) | Update supplier |
| DELETE | `/supplier/:id` | Yes (super_admin/admin) | Delete supplier |
| GET | `/supplier/template` | Yes | Download template |
| GET | `/supplier/download` | Yes | Download data |
| POST | `/supplier/import` | Yes | Import from Excel |

---

## Ingredient

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/ingredient/get-all` | Yes | Get all ingredients |
| GET | `/ingredient/get-by-id/:id` | Yes | Get by ID |
| POST | `/ingredient/add` | Yes (super_admin/admin) | Create ingredient |
| PUT | `/ingredient/edit/:id` | Yes (super_admin/admin) | Update ingredient |
| PUT | `/ingredient/adjust-stock/:id` | Yes | Adjust stock |
| DELETE | `/ingredient/delete/:id` | Yes (super_admin/admin) | Delete ingredient |
| GET | `/ingredient/download-template` | Yes | Download template |
| GET | `/ingredient/download` | Yes | Download data |
| POST | `/ingredient/import` | Yes | Import from Excel |

---

## Ingredient Category

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/ingredient-category/get-all` | Yes | Get all |
| GET | `/ingredient-category/get-by-id/:id` | Yes | Get by ID |
| POST | `/ingredient-category/add` | Yes (super_admin/admin) | Create |
| PUT | `/ingredient-category/edit/:id` | Yes (super_admin/admin) | Update |
| DELETE | `/ingredient-category/delete/:id` | Yes (super_admin/admin) | Delete |
| GET | `/ingredient-category/template` | Yes | Download template |
| GET | `/ingredient-category/download` | Yes | Download data |
| POST | `/ingredient-category/import` | Yes | Import |

---

## Stock History

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/stock-history/get-all` | Yes | Get all stock history |
| GET | `/stock-history/get-by-product/:productId` | Yes | Get by product |
| GET | `/stock-history/low-stock` | Yes | Low stock (by store) |
| GET | `/stock-history/low-stock-all` | No | Low stock (all stores) |

---

## Stock Opname

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/stock-opname/get-all` | Yes | Get all |
| GET | `/stock-opname/get-by-id/:id` | Yes | Get by ID |
| GET | `/stock-opname/check-exists` | Yes | Check existing opname |
| GET | `/stock-opname/composition-items` | Yes | Get composition items |
| POST | `/stock-opname/create` | Yes (super_admin/admin) | Create |
| PUT | `/stock-opname/update/:id` | Yes (super_admin/admin) | Update |
| DELETE | `/stock-opname/delete/:id` | Yes (super_admin/admin) | Delete |
| PATCH | `/stock-opname/status/:id` | Yes (super_admin/admin) | Change status |
| GET | `/stock-opname/download-excel` | Yes | Download Excel |
| POST | `/stock-opname/export-selected` | Yes | Export selected |
| POST | `/stock-opname/upload-excel` | Yes | Upload Excel |

---

## Expense

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/expense/get-all` | Yes | Get all expenses |
| GET | `/expense/get-by-id/:id` | Yes | Get by ID |
| GET | `/expense/get-summary` | Yes | Get summary |
| POST | `/expense/add` | Yes (super_admin/admin) | Create |
| PUT | `/expense/edit/:id` | Yes (super_admin/admin) | Update |
| DELETE | `/expense/delete/:id` | Yes (super_admin/admin) | Delete |
| PUT | `/expense/approve/:id` | Yes (super_admin/admin) | Approve |
| PUT | `/expense/reject/:id` | Yes (super_admin/admin) | Reject |

---

## Expense Category

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/expense-category/get-all` | Yes | Get all |
| POST | `/expense-category/add` | Yes (super_admin/admin) | Create |
| PUT | `/expense-category/edit/:id` | Yes (super_admin/admin) | Update |
| DELETE | `/expense-category/delete/:id` | Yes (super_admin/admin) | Delete |

---

## Cash Register

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/cash-register/open` | Yes (super_admin/admin) | Open register |
| PUT | `/cash-register/close/:id` | Yes (super_admin/admin) | Close register |
| GET | `/cash-register/current` | Yes | Get current register |
| GET | `/cash-register/history` | Yes | Get history |

---

## Purchase Order

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/purchase-order/get-all` | Yes | Get all POs |
| GET | `/purchase-order/get-by-id/:id` | Yes | Get PO by ID |
| POST | `/purchase-order/create` | Yes (super_admin/admin) | Create PO |
| PUT | `/purchase-order/update/:id` | Yes (super_admin/admin) | Update PO |
| DELETE | `/purchase-order/delete/:id` | Yes (super_admin/admin) | Delete PO |
| PUT | `/purchase-order/receive/:id` | Yes (super_admin/admin) | Receive PO |
| PUT | `/purchase-order/cancel/:id` | Yes (super_admin/admin) | Cancel PO |
| GET | `/purchase-order/template` | Yes | Download template |
| GET | `/purchase-order/download` | Yes | Download data |
| POST | `/purchase-order/import` | Yes | Import from Excel |

---

## Purchase Payment

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/purchase-payment/list` | Yes | List all payments |
| GET | `/purchase-payment/detail/:id` | Yes | Get by ID |
| GET | `/purchase-payment/by-po/:poId` | Yes | Get by PO |
| GET | `/purchase-payment/by-supplier/:supplierId` | Yes | Get by supplier |
| GET | `/purchase-payment/ap-dashboard` | Yes | AP dashboard |
| POST | `/purchase-payment/create` | Yes (super_admin/admin) | Record payment |
| DELETE | `/purchase-payment/delete/:id` | Yes (super_admin/admin) | Delete payment |

---

## Purchase Return

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/purchase-return/get-all` | Yes | Get all |
| GET | `/purchase-return/get-by-id/:id` | Yes | Get by ID |
| GET | `/purchase-return/by-po/:poId` | Yes | Get by PO |
| POST | `/purchase-return/create` | Yes (super_admin/admin) | Create |
| PATCH | `/purchase-return/approve/:id` | Yes (super_admin/admin) | Approve |
| PATCH | `/purchase-return/reject/:id` | Yes (super_admin/admin) | Reject |

---

## Goods Receipt

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/goods-receipt/get-all` | Yes | Get all |
| GET | `/goods-receipt/get-by-id/:id` | Yes | Get by ID |
| GET | `/goods-receipt/by-po/:poId` | Yes | Get by PO |
| GET | `/goods-receipt/export` | Yes | Export Excel |
| POST | `/goods-receipt/create` | Yes (super_admin/admin) | Create |
| PUT | `/goods-receipt/update/:id` | Yes (super_admin/admin) | Update |
| DELETE | `/goods-receipt/delete/:id` | Yes (super_admin/admin) | Delete |
| PATCH | `/goods-receipt/status/:id` | Yes (super_admin/admin) | Change status |

---

## BOM (Bill of Materials)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/bom/get-all` | Yes (super_admin/admin) | Get all BOMs |
| GET | `/bom/get-by-id/:id` | Yes | Get by ID |
| POST | `/bom/add` | Yes (super_admin/admin) | Create BOM |
| PUT | `/bom/edit/:id` | Yes (super_admin/admin) | Update BOM |
| DELETE | `/bom/delete/:id` | Yes (super_admin/admin) | Delete BOM |

---

## Production Order

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/production-order/get-all` | Yes | Get all |
| GET | `/production-order/get-by-id/:id` | Yes | Get by ID |
| POST | `/production-order/create` | Yes (super_admin/admin) | Create |
| PUT | `/production-order/update/:id` | Yes (super_admin/admin) | Update |
| DELETE | `/production-order/delete/:id` | Yes (super_admin/admin) | Delete |
| PATCH | `/production-order/status/:id` | Yes (super_admin/admin) | Change status |
| POST | `/production-order/start/:id` | Yes (super_admin/admin) | Start production |
| POST | `/production-order/complete/:id` | Yes (super_admin/admin) | Complete production |

---

## Sales Return

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/sales-return/get-all` | Yes | Get all |
| GET | `/sales-return/get-by-id/:id` | Yes | Get by ID |
| PATCH | `/sales-return/approve/:id` | Yes (super_admin/admin) | Approve |
| PATCH | `/sales-return/reject/:id` | Yes (super_admin/admin) | Reject |

---

## Employee

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/employee/get-employee` | Yes | Get all employees |
| GET | `/employee/get-employee/:id` | Yes | Get by DB ID |
| GET | `/employee/get-employee-detail/:employeeID` | Yes | Get by employee ID |
| POST | `/employee/add-employee` | Yes (super_admin/admin) | Create |
| PUT | `/employee/edit-employee` | Yes (super_admin/admin) | Update |
| DELETE | `/employee/delete-employee/:id` | Yes (super_admin/admin) | Delete |

---

## Department

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/department/get-department` | Yes | Get all |
| GET | `/department/get-department-all` | Yes | Get departments |
| GET | `/department/get-department/:id` | Yes | Get by ID |
| POST | `/department/add-new-department` | Yes (super_admin/admin) | Create |
| PUT | `/department/edit-department/:id` | Yes (super_admin/admin) | Update |
| DELETE | `/department/delete-department/:id` | Yes (super_admin/admin) | Delete |
| GET | `/department/download-template` | Yes | Download template |
| GET | `/department/download` | Yes | Download data |
| POST | `/department/upload` | Yes | Import from Excel |

---

## Position

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/position/get-position` | Yes | Get all |
| GET | `/position/get-position/:id` | Yes | Get by ID |
| GET | `/position/get-position-all` | Yes | Get positions |
| POST | `/position/add-new-position` | Yes (super_admin/admin) | Create |
| PUT | `/position/edit-position/:id` | Yes (super_admin/admin) | Update |
| DELETE | `/position/delete-position/:id` | Yes (super_admin/admin) | Delete |
| GET | `/position/download-template` | Yes | Download template |
| GET | `/position/download` | Yes | Download data |
| POST | `/position/upload` | Yes | Import from Excel |

---

## Role

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/role/get-role` | No | Get roles (dropdown) |
| GET | `/role/get-role-all` | Yes (super_admin) | Get roles (table) |
| GET | `/role/get-role-by-id/:id` | Yes | Get by ID |
| POST | `/role/add-new-role` | Yes (super_admin) | Create role |
| PUT | `/role/edit-role/:id` | Yes (super_admin) | Update role |
| DELETE | `/role/delete-role/:id` | Yes (super_admin) | Delete role |
| PUT | `/role/update-user-role` | Yes (super_admin) | Update user role |
| GET | `/role/get-users-by-role` | Yes | Get users by role |
| PUT | `/role/update-access-menu` | Yes (super_admin) | Update role access |

---

## Report

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/report/daily` | Yes | Daily report |
| GET | `/report/profit-loss` | Yes | Profit & loss |
| GET | `/report/cash-flow` | Yes | Cash flow |
| GET | `/report/sales-summary` | Yes | Sales summary |
| GET | `/report/best-seller` | Yes | Best seller report |
| GET | `/report/profit-per-product` | Yes | Profit per product |

---

## POS Extended

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/pos/lookup-barcode` | Yes | Barcode lookup |
| POST | `/pos/transfer` | Yes (super_admin/admin) | Stock transfer |
| GET | `/pos/transfer-history` | Yes | Transfer history |
| GET | `/pos/transfer/:id` | Yes | Get transfer by ID |
| PUT | `/pos/transfer/:id/receive` | Yes (super_admin/admin) | Receive transfer |
| PUT | `/pos/transfer/:id/cancel` | Yes (super_admin/admin) | Cancel transfer |
| POST | `/pos/adjust` | Yes (super_admin/admin) | Stock adjustment |
| POST | `/pos/purchase-order/:id/return` | Yes (super_admin/admin) | PO return |
| POST | `/pos/order/:id/return` | Yes (super_admin/admin) | Sales return |
| GET | `/pos/member/:id/point-history` | Yes | Loyalty point history |
| GET | `/pos/dashboard/summary` | Yes | Dashboard summary |
| GET | `/pos/product/price-by-store` | Yes | Multi-store pricing |
| PUT | `/pos/product/update-price-by-store` | Yes (super_admin/admin) | Update price by store |
| POST | `/pos/invoice/send-wa` | Yes | Send invoice via WhatsApp |
| POST | `/pos/invoice/send-email` | Yes | Send invoice via email |
| GET | `/pos/whatsapp/status` | Yes | WhatsApp status |
| POST | `/pos/whatsapp/logout` | Yes (super_admin/admin) | Logout WhatsApp |
| POST | `/pos/whatsapp/restart` | Yes (super_admin/admin) | Restart WhatsApp |
| POST | `/pos/product/add-batch` | Yes (super_admin/admin) | Add product batch |
| GET | `/pos/product/batches` | Yes | Get product batches |

---

## Accounts Receivable

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/accounts-receivable/list` | Yes | List all AR |
| GET | `/accounts-receivable/aging` | Yes | Aging report |
| GET | `/accounts-receivable/:id` | Yes | Get by ID |
| POST | `/accounts-receivable/create` | Yes (super_admin/admin) | Create AR |
| POST | `/accounts-receivable/:id/pay` | Yes | Record payment |
| PUT | `/accounts-receivable/:id` | Yes (super_admin/admin) | Update AR |
| DELETE | `/accounts-receivable/:id` | Yes (super_admin/admin) | Delete AR |

---

## Tax Config

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/tax-config/` | Yes | Get all tax configs |
| GET | `/tax-config/get-tax-config/:id` | Yes | Get by ID |
| POST | `/tax-config/add-new-tax-config` | Yes (super_admin/admin) | Create |
| PUT | `/tax-config/edit-tax-config/:id` | Yes (super_admin/admin) | Update |
| DELETE | `/tax-config/delete-tax-config/:id` | Yes (super_admin/admin) | Delete |
| GET | `/tax-config/template` | Yes | Download template |
| GET | `/tax-config/download` | Yes | Download data |
| POST | `/tax-config/import` | Yes | Import |
| POST | `/tax-config/seed` | Yes | Seed default PPh 2026 |

---

## Invoice

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/invoice/setting` | Yes | Get invoice settings |
| PUT | `/invoice/setting` | Yes (super_admin/admin) | Update settings |
| POST | `/invoice/setting/reset` | Yes (super_admin/admin) | Reset settings |

---

## Notification

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notification/` | Yes | Get all |
| GET | `/notification/unread` | Yes | Get unread count |
| PUT | `/notification/:id/read` | Yes | Mark as read |
| PUT | `/notification/read-all` | Yes | Mark all as read |

---

## Currency

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/currency/` | Yes | Get all |
| GET | `/currency/:id` | Yes | Get by ID |
| POST | `/currency/` | Yes (super_admin/admin) | Create |
| PUT | `/currency/:id` | Yes (super_admin/admin) | Update |
| DELETE | `/currency/:id` | Yes (super_admin/admin) | Delete |
| PUT | `/currency/:id/default` | Yes (super_admin/admin) | Set default |

---

## Audit Log

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/audit-log/` | Yes (super_admin) | Get all audit logs |
| GET | `/audit-log/:entity/:entityId` | Yes (super_admin) | Get by entity |

---

## Social Media

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/social-media/get-social-media` | Yes | Get all |
| POST | `/social-media/add-social-media` | Yes (super_admin/admin) | Add |
| PUT | `/social-media/edit-social-media/:id` | Yes (super_admin/admin) | Update |
| DELETE | `/social-media/delete-social-media/:id` | Yes (super_admin/admin) | Delete |

---

## Reservation

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/reservation/` | Yes | Get all |
| GET | `/reservation/available-tables/list` | Yes | Get available tables |
| GET | `/reservation/:id` | Yes | Get by ID |
| POST | `/reservation/` | Yes | Create |
| PUT | `/reservation/:id` | Yes (super_admin/admin) | Update |
| DELETE | `/reservation/:id` | Yes (super_admin/admin) | Cancel |

---

## Split Bill

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/split-bill/create` | Yes (super_admin/admin) | Create |
| GET | `/split-bill/get-by-order/:orderId` | Yes | Get by order |
| PUT | `/split-bill/pay/:id` | Yes (super_admin/admin) | Pay split |
| DELETE | `/split-bill/cancel/:id` | Yes (super_admin/admin) | Cancel |
| POST | `/split-bill/merge` | Yes (super_admin/admin) | Merge splits |

---

## Export

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/export/master-data` | Yes (super_admin/admin) | Export all master data |

---

## Receipt

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/receipt/order/:orderId` | Yes | Get order receipt |

---

## FAQ

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/faq/faq` | No | Get/search FAQ |
| POST | `/faq/faq/ask` | No | Ask Gemini AI |

---

## Overview (Dashboard)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/overview/product` | Yes | Product summary |
| GET | `/overview/category` | Yes | Category summary |
| GET | `/overview/location` | Yes | Location summary |
| GET | `/overview/member` | Yes | Member summary |
| GET | `/overview/user` | Yes | User summary |
| GET | `/overview/best-selling` | Yes | Best selling |
| GET | `/overview/members/latest` | Yes | Latest members |
| GET | `/overview/categories/latest` | Yes | Latest categories |
| GET | `/overview/locations/latest` | Yes | Latest locations |
| GET | `/overview/products/latest` | Yes | Latest products |

---

## Best Selling

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/best-selling/get-chart-by-year` | Yes (super_admin/admin) | Yearly chart |
| GET | `/best-selling/get-chart-by-month` | Yes (super_admin/admin) | Monthly chart |
| GET | `/best-selling/get-chart-current-and-two-days-before` | Yes | 2-day chart |
| GET | `/best-selling/get-chart-current-and-seven-days-before` | Yes | 7-day chart |
| GET | `/best-selling/get-earning-today` | Yes | Today's earnings |

---

## Misc

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | No | Health check |
| POST | `/print-thermal` | No | ESC/POS thermal print |

---

**Total: ~210 endpoints across 47 modules**
