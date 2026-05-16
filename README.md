# POS Backend API

Point of Sale (POS) Backend Application built with Node.js, Express, and PostgreSQL.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Real-time**: Socket.IO
- **Authentication**: JWT with bcrypt
- **File Storage**: AWS S3 & Cloudinary
- **Deployment**: Vercel

---

## Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL v14+
- npm or yarn

### Installation

```bash
# Clone repository
git clone <repository-url>
cd BE-POS-App

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your database and service credentials
```

### Database Setup

```bash
# Run database migrations
npm run sync
```

### Running the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

---

## API Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "message": "Success message",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message"
}
```

### Pagination Response
```json
{
  "success": true,
  "message": "Success",
  "data": [...],
  "pagination": {
    "currentPage": 1,
    "pageSize": 10,
    "totalItems": 100,
    "totalPages": 10
  }
}
```

---

## Authentication

### Login
```
POST /auth/login
Body: { "email": "...", "password": "..." }
```

### Register
```
POST /auth/register
Body: { "email": "...", "password": "...", "userName": "..." }
```

### Get Current User
```
GET /auth/get-user
Headers: Authorization: Bearer <token>
```

### Update User
```
PUT /auth/edit-user
Headers: Authorization: Bearer <token>
Body: { "userName": "...", "phoneNumber": "...", "position": "..." }
```

---

## Roles & Permissions

| Role | Description | Access |
|------|-------------|--------|
| **super_admin** | Owner - manage all stores | Full access |
| **admin** | Store manager | Store-level access |
| **user** | Staff/Cashier | Limited access |

### Role Management Endpoints
```
GET    /role/get-role              # Get all roles (dropdown)
GET    /role/get-role-all          # Get roles with pagination
POST   /role/add-new-role          # Create new role
PUT    /role/edit-role/:id         # Update role
DELETE /role/delete-role/:id      # Delete role
PUT    /role/update-user-role      # Change user role
GET    /role/get-users-by-role    # Get users by role
PUT    /role/update-access-menu   # Update role permissions
```

---

## Store Management (Locations)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/location/get-location` | Get all stores (dropdown) |
| GET | `/location/get-location-all` | Get stores with pagination |
| POST | `/location/add-new-location` | Create new store |
| PUT | `/location/edit-location` | Update store |
| DELETE | `/location/delete-location/:id` | Delete store |
| GET | `/location/template/:storeId` | Download Excel template |
| POST | `/location/import` | Import from Excel |

---

## Product Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/product/get-product` | Get products for cashier |
| GET | `/product/get-product-by-super-admin` | Get by store (superadmin) |
| GET | `/product/get-product-all` | Get products with pagination |
| POST | `/product/add-product` | Create product |
| PUT | `/product/edit-product` | Update product |
| DELETE | `/product/delete-product/:id` | Delete product |
| GET | `/product/template/:storeId` | Download template |
| POST | `/product/import` | Import from Excel |

---

## Category Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/category/get-category` | Get categories (dropdown) |
| GET | `/category/get-category-all` | Get with pagination |
| POST | `/category/add-new-category` | Create category |
| PUT | `/category/edit-category/:id` | Update category |
| DELETE | `/category/delete-category/:id` | Delete category |
| GET | `/category/download-excel` | Export to Excel |

---

## Sub-Category Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sub-category/get-all-sub-category` | Get all sub-categories |
| GET | `/sub-category/by-category/:id` | Get by category |
| POST | `/sub-category/add-new-sub-category` | Create sub-category |
| PUT | `/sub-category/edit-sub-category/:id` | Update sub-category |
| DELETE | `/sub-category/delete-sub-category/:id` | Delete sub-category |

---

## Table Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/table/get-table` | Get tables by store |
| GET | `/table/availability` | Get table availability |
| GET | `/table/active-orders` | Get tables with active orders |
| POST | `/table/add-new-table` | Create table |
| PUT | `/table/edit-table/:id` | Update table |
| PUT | `/table/edit-status/:id` | Update status |
| DELETE | `/table/delete-table/:id` | Delete table |

---

## Order Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/order/create-order` | Create new order |
| GET | `/order/get-order-by-store` | Get orders by store |
| GET | `/order/get-order-by-id/:id` | Get order by ID |
| PUT | `/order/edit-order/:id` | Update order |
| PUT | `/order/update-status/:id` | Update order status |
| PUT | `/order/edit-item/:id` | Update order item |
| DELETE | `/order/delete-order/:id` | Delete order |
| POST | `/order/apply-discount/:id` | Apply discount |

---

## Checkout & Transaction

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/checkout/checkout-item` | Process checkout |
| PUT | `/checkout/edit-checkout/:id` | Update checkout |
| DELETE | `/checkout/delete-checkout/:id` | Delete checkout |

---

## Best Selling & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/best-selling/get-best-selling` | Get best selling products |
| GET | `/best-selling/get-chart-by-month` | Monthly chart |
| GET | `/best-selling/get-chart-current-and-seven-days-before` | 7 days chart |
| GET | `/best-selling/get-chart-current-and-two-days-before` | 2 days chart |
| GET | `/best-selling/get-earning-today` | Today's earnings |

---

## Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/report/sales` | Sales report |
| GET | `/report/daily-summary` | Daily summary |
| GET | `/report/profit-loss` | Profit & loss |

---

## Member & Loyalty

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/member/get-member` | Get all members |
| POST | `/member/add-new-member` | Create member |
| PUT | `/member/edit-member/:id` | Update member |
| DELETE | `/member/delete-member/:id` | Delete member |

### Member Tiers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/member-tier/get-member-tier` | Get all tiers |
| POST | `/member-tier/add-new-member-tier` | Create tier |
| PUT | `/member-tier/edit-member-tier/:id` | Update tier |
| DELETE | `/member-tier/delete-member-tier/:id` | Delete tier |

---

## Discount Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/discount/get-discount-by-location` | Get active discounts |
| GET | `/discount/get-discount` | Get all discounts |
| POST | `/discount/add-new-discount` | Create discount |
| PUT | `/discount/edit-discount/:id` | Update discount |
| DELETE | `/discount/delete-discount/:id` | Delete discount |

---

## Payment Types

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/type-payment/get-type-payment-by-location` | Get active payment types |
| GET | `/type-payment/get-type-payment` | Get all payment types |
| POST | `/type-payment/add-new-type-payment` | Create payment type |
| PUT | `/type-payment/edit-type-payment/:id` | Update payment type |
| DELETE | `/type-payment/delete-type-payment/:id` | Delete payment type |

---

## Shift Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/shift/get-shift` | Get all shifts |
| POST | `/shift/add-new-shift` | Create shift |
| PUT | `/shift/edit-shift/:id` | Update shift |
| DELETE | `/shift/delete-shift/:id` | Delete shift |

---

## Inventory Management

### Suppliers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/supplier` | Get all suppliers |
| POST | `/supplier` | Create supplier |
| PUT | `/supplier/:id` | Update supplier |
| DELETE | `/supplier/:id` | Delete supplier |

### Purchase Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/purchase-order` | Get all purchase orders |
| POST | `/purchase-order` | Create purchase order |
| PUT | `/purchase-order/:id` | Update purchase order |
| POST | `/purchase-order/:id/receive` | Receive order |

### Stock
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stock-history` | Get stock history |
| GET | `/stock-opname` | Get stock opname |
| POST | `/stock-opname` | Create stock opname |

---

## Expense Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/expense-category` | Get expense categories |
| POST | `/expense-category` | Create category |
| GET | `/expense` | Get all expenses |
| POST | `/expense` | Create expense |
| PUT | `/expense/:id` | Update expense |
| POST | `/expense/:id/approve` | Approve expense |

---

## Cash Register

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/cash-register/open` | Open cash register |
| POST | `/cash-register/:id/close` | Close cash register |
| GET | `/cash-register/current` | Get current register |
| GET | `/cash-register/history` | Get register history |

---

## Invoice Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoice/logo` | Get logos |
| POST | `/invoice/logo` | Upload logo |
| PUT | `/invoice/logo/:id` | Update logo |
| GET | `/invoice/footer` | Get footers |
| POST | `/invoice/footer` | Create footer |
| GET | `/invoice/social-media` | Get social media |

---

## Environment Variables

```env
# Server
PORT=5001

# Database Development
DB_DEV_HOST=127.0.0.1
DB_DEV_PORT=5432
DB_DEV_DATABASE=cashier_app
DB_DEV_USERNAME=postgres
DB_DEV_PASSWORD=your_password

# Database Production
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_DATABASE=your_database
POSTGRES_HOST=your_host

# JWT
JWT_SECRET=your_jwt_secret

# Frontend
FRONTEND_URL=http://localhost:3000

# AWS S3
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=your_region
AWS_BUCKET_NAME=your_bucket

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
```

---

## Project Structure

```
BE-POS-App/
├── api/
│   ├── controller/     # Route controllers (business logic)
│   ├── routes/         # API routes (endpoints)
│   ├── service/        # Services (Socket.IO)
│   └── index.js        # Express app entry point
├── config/
│   ├── config.js       # Database configuration
│   └── database.js     # Database connection
├── db/
│   ├── models/         # Sequelize models (data schemas)
│   └── seeders/        # Database seeders
├── scripts/
│   └── migrate.js      # Migration scripts
├── utils/
│   ├── authorization.js # Auth & RBAC utilities
│   ├── jwtConvert.js   # JWT helpers
│   ├── cloudinaryStorage.js # Cloud storage
│   └── excelTemplate.js # Excel import/export
├── files/              # Temp file storage
├── docs/               # Documentation
├── package.json
├── eslint.config.mjs
├── .prettierrc
└── vercel.json
```

---

## Socket.IO Events

The server supports real-time communication at `/socket.io`.

### Events
- `order:created` - New order created
- `order:updated` - Order status changed
- `table:updated` - Table status changed

---

## License

ISC