# POS SYSTEM - ENDPOINT AUDIT CHECKLIST
# Generated: 2026-06-01

## 1. MASTER DATA - PRODUCT & CATEGORY

### Product Management
- [x] GET /product/get-product - Filter by store, nameProduct, category
- [x] POST /product/add-product - Create with initial stock history
- [x] PUT /product/edit-product - Update product
- [x] GET /product/get-by-id - Get product by ID
- [x] DELETE /product/delete-product/:id - Delete product
- [x] GET /product/lookup-barcode - Barcode scan for POS ✅ NEW

### Category Management
- [ ] GET /category/get-category-all - Get all categories with pagination
- [ ] POST /category/add-new-category - Create category
- [ ] PUT /category/edit-category/:id - Update category
- [ ] DELETE /category/delete-category/:id - Delete category

### Sub-Category Management
- [ ] GET /sub-category/get-all-sub-category - Get all with pagination
- [ ] POST /sub-category/add-subcategory - Create
- [ ] PUT /sub-category/edit-subcategory/:id - Update
- [ ] DELETE /sub-category/delete-subcategory/:id - Delete

---

## 2. STOCK MANAGEMENT

### Stock Opname
- [x] GET /stock-opname/get-all - List all opnames
- [x] POST /stock-opname/create - Create opname with items
- [x] GET /stock-opname/get-by-id - Get opname detail (return productId) ✅ FIXED
- [x] PUT /stock-opname/update - Update opname (accept productId) ✅ FIXED
- [x] DELETE /stock-opname/delete - Delete opname
- [x] POST /stock-opname/change-status - Change status to completed/cancelled

### Stock History
- [x] GET /stock-history/get-all - List with filters (referenceType, product, date range)
- [x] GET /stock-history/low-stock - Get low stock products

### Stock Transfer ✅ NEW
- [x] POST /pos/transfer - Create stock transfer between stores
- [x] GET /pos/transfer-history - Get transfer history

### Stock Adjustment ✅ NEW
- [x] POST /pos/adjust - Adjust stock with reason

---

## 3. PURCHASE & SALES RETURNS

### Purchase Order Return ✅ NEW
- [x] POST /pos/purchase-order/:id/return - Create purchase return
- [x] Auto-deduct stock from inventory
- [x] Write to stock_history with referenceType='purchase_return'

### Sales Order Return ✅ NEW
- [x] POST /pos/order/:id/return - Create sales return
- [x] Auto-add stock back to inventory
- [x] Write to stock_history with referenceType='sale_return'

---

## 4. POS CASHIER FLOW

### Cash Register
- [x] POST /cash-register/open - Open shift with opening balance
- [x] POST /cash-register/:id/close - Close shift with summary
- [x] GET /cash-register/current - Get current open register
- [x] GET /cash-register/history - Get register history

### Order Management
- [x] POST /order/create-order - Create order with items
- [x] PUT /order/update-status/:id - Update order status
- [x] POST /order/apply-discount - Apply discount to order
- [x] POST /order/payment - Process payment (deduct stock, write history)
- [x] POST /order/void - Void order

### Checkout
- [x] POST /checkout/checkout-item - Process checkout (atomic: validate → deduct → history)

---

## 5. LOYALTY & POINTS

### Member Points ✅ NEW
- [x] POST /pos/member/:id/add-points - Add points to member
- [x] GET /pos/member/:id/point-history - Get point history

---

## 6. DASHBOARD & REPORTING

### Dashboard ✅ NEW
- [x] GET /pos/dashboard/summary - Get sales, orders, products, members, charts

### Best Selling
- [x] GET /best-selling - Get best selling products

---

## 7. MULTI-STORE PRICING

### Product Price by Store ✅ NEW
- [x] GET /pos/product/price-by-store - Get product prices by store
- [x] PUT /pos/product/update-price-by-store - Update store-specific prices

---

## 8. DIGITAL RECEIPT

### Invoice Distribution ✅ NEW
- [x] POST /pos/invoice/send-wa - Send invoice via WhatsApp
- [x] POST /pos/invoice/send-email - Send invoice via email

---

## 9. BATCH & EXPIRY MANAGEMENT

### Product Batch ✅ NEW
- [x] POST /pos/product/add-batch - Add batch with expiry date
- [x] GET /pos/product/batches - Get batches by product/store

---

## CRITICAL CHAIN VERIFICATION

### Add Product → Inventory → Stock Opname → Low Stock
✅ Product created with initial stock history
✅ Product searchable in stock opname via barcode/name
✅ Stock opname items accept productId
✅ Stock opname return productId for FE populate
✅ Stock mutations tracked in stock_history
✅ Low stock detection via minStock

### POS Checkout → Stock Deduction → History
✅ Order created with items
✅ Payment processed (atomic transaction)
✅ Stock deducted per item
✅ Stock history written with referenceType='sale'
✅ Best selling updated
✅ Table status updated (if applicable)

### Stock Transfer → History
✅ Transfer created between stores
✅ Stock deducted from source store
✅ Stock added to destination store
✅ History written with referenceType='transfer'

### Purchase Return → Stock Adjustment
✅ Return created from received PO
✅ Stock deducted (return to supplier)
✅ History written with referenceType='purchase_return'

### Sales Return → Stock Adjustment
✅ Return created from paid order
✅ Stock added back (customer return)
✅ History written with referenceType='sale_return'

---

## RESPONSE STANDARDIZATION

All endpoints follow standard response format:

### GET (List)
```json
{
  "success": true,
  "message": "Success",
  "data": [...],
  "pagination": { "total", "page", "limit", "totalPages" }
}
```

### GET (Detail)
```json
{
  "success": true,
  "message": "Success",
  "data": { ... }
}
```

### POST/PUT
```json
{
  "success": true,
  "message": "Success",
  "data": { ... }
}
```

### DELETE
```json
{
  "success": true,
  "message": "Success"
}
```

---

## STATUS CODES

- 200: GET/PUT success
- 201: POST success (create)
- 204: DELETE success (no content)
- 400: Bad request (validation error)
- 404: Not found
- 500: Server error

---

## MODELS CREATED ✅

- stock_transfer
- stock_transfer_item
- purchase_return
- purchase_return_item
- sales_return
- sales_return_item
- member_point_history
- product_batch
- product_store_price

---

## MIGRATIONS EXECUTED ✅

- 20260601105439-create-stock-transfer
- 20260601105748-create-purchase-return
- 20260601105950-create-sales-return
- 20260601105951-create-member-point-history
- 20260601105953-create-product-batch
- 20260601105954-create-product-store-price

---

## ROUTES REGISTERED ✅

- POST /pos/lookup-barcode
- POST /pos/transfer
- GET /pos/transfer-history
- POST /pos/adjust
- POST /pos/purchase-order/:id/return
- POST /pos/order/:id/return
- POST /pos/member/:id/add-points
- GET /pos/member/:id/point-history
- GET /pos/dashboard/summary
- GET /pos/product/price-by-store
- PUT /pos/product/update-price-by-store
- POST /pos/invoice/send-wa
- POST /pos/invoice/send-email
- POST /pos/product/add-batch
- GET /pos/product/batches

---

## COMMITS PUSHED ✅

1. 805862e - feat: add POS core endpoints
2. 9394085 - feat: register POS routes in main API

---

## NEXT STEPS (OPTIONAL)

- [ ] Implement WhatsApp API integration (currently stub)
- [ ] Implement Email service integration (currently stub)
- [ ] Add approval workflow for returns (currently auto-approved)
- [ ] Add approval workflow for stock transfers (currently pending)
- [ ] Create FE pages for POS cashier screen
- [ ] Create FE pages for stock transfer management
- [ ] Create FE pages for return management
- [ ] Create FE pages for batch management
