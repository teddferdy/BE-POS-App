const { z } = require('zod')

// --- Helpers ---
const strToNum = () =>
  z
    .any()
    .refine((v) => v !== '' && v !== null && v !== undefined, {
      message: 'required'
    })
    .transform((v) => Number(v))
    .refine((v) => !isNaN(v), { message: 'must be a number' })

const optionalStrToNum = () =>
  z
    .any()
    .optional()
    .transform((v) => {
      if (v === '' || v === null || v === undefined) return null
      const n = Number(v)
      return isNaN(n) ? null : n
    })

const jsonField = () =>
  z.union([z.string(), z.array(z.any()), z.record(z.any())]).transform((v) => {
    if (typeof v === 'string') {
      if (v === '' || v === 'null' || v === 'undefined') return null
      try {
        return JSON.parse(v)
      } catch {
        throw new Error('invalid JSON')
      }
    }
    return v
  })

const storeArray = () =>
  z
    .union([z.array(z.number().int()), z.array(strToNum()), z.string()])
    .transform((v) => {
      if (typeof v === 'string') {
        try {
          const p = JSON.parse(v)
          return Array.isArray(p) ? p.map(Number) : [Number(p)]
        } catch {
          return [Number(v)]
        }
      }
      return v.map(Number)
    })

const statusEnum = z.enum(['active', 'inactive', 'draft']).default('active')

// ===================== Auth =====================
exports.loginSchema = z.object({
  userName: z.string().min(1, 'Username/email is required'),
  password: z.string().min(1, 'Password is required')
})

exports.registerSchema = z
  .object({
    userName: z.string().min(1, 'Username is required'),
    password: z.string().min(6, 'Password min 6 characters'),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    userType: z.enum(['admin', 'user']).default('user'),
    fullName: z.string().optional().default(''),
    phoneNumber: z.string().optional().default(''),
    gender: z.string().optional().default(''),
    address: z.string().optional().default(''),
    dateOfBirth: z.string().optional().nullable(),
    placeOfBirth: z.string().optional().default(''),
  store: optionalStrToNum().nullable(),
    shift: strToNum().optional().default(0),
    position: strToNum().optional().default(0),
    accessMenu: jsonField().optional().nullable()
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Password and confirm password do not match',
    path: ['confirmPassword']
  })

exports.resetPasswordSchema = z.object({
  email: z.string().email('Invalid email').optional(),
  userName: z.string().optional()
})

// ===================== Product =====================
exports.createProductSchema = z.object({
  nameProduct: z.string().optional().default(''),
  category: optionalStrToNum(),
  status: statusEnum,
  description: z.string().optional().default(''),
  price: optionalStrToNum().default(0),
  costPrice: optionalStrToNum().default(0),
  stock: strToNum().optional().default(0),
  minStock: strToNum().optional().default(0),
  unit: z.string().optional().default('pcs'),
  baseUnit: z.string().optional().default('pcs'),
  conversionFactor: z.coerce.string().optional().default('1'),
  point: strToNum().optional().default(0),
  barcode: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  hasModifiers: z.union([z.boolean(), z.string()]).optional().default(false),
  modifiers: jsonField().optional().default([]),
  isOption: z.union([z.boolean(), z.string()]).optional().default(false),
  options: jsonField().optional().default([]),
  isAvailable: z.union([z.boolean(), z.string()]).optional().default(true),
  stores: storeArray().optional().nullable(),
  supplier: strToNum().optional().nullable(),
  tax: jsonField().optional().nullable(),
  priceTiers: jsonField().optional().default([]),
  currencyId: strToNum().optional().nullable(),
  currencyCode: z.string().optional().nullable(),
  tipeProduk: z.string().optional().default('menu'),
  composition: jsonField().optional().default([]),
  redeemPoints: strToNum().optional().default(0),
  estimationTime: strToNum().optional().default(0),
  createdBy: z.union([z.number(), strToNum()]).optional().nullable(),
  image: z.string().optional().nullable()
})

exports.updateProductSchema = exports.createProductSchema.partial().extend({
  id: strToNum()
})

// ===================== Category =====================
exports.createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required'),
  description: z.string().optional().nullable(),
  value: z.string().optional(),
  image: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  status: statusEnum,
  store: storeArray().optional().nullable(),
  isActive: z.union([z.boolean(), z.string()]).optional()
})

exports.updateCategorySchema = exports.createCategorySchema.partial()

// ===================== Order =====================
const orderItemSchema = z
  .object({
    product: strToNum(),
    productId: strToNum().optional(),
    productName: z.string().optional(),
    quantity: strToNum(),
    price: strToNum().optional().default(0),
    notes: z.string().optional().default(''),
    modifiers: z.array(z.any()).optional().default([]),
    variant: z.string().optional()
  })
  .passthrough()

exports.createOrderSchema = z.object({
  store: strToNum(),
  tableId: strToNum().optional().nullable(),
  customerId: strToNum().optional().nullable(),
  customerName: z.string().optional().nullable(),
  customerPhone: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  discountId: strToNum().optional().nullable(),
  promoCode: z.string().optional().nullable(),
  discountType: z
    .enum(['none', 'percent', 'nominal'])
    .optional()
    .default('none'),
  discountValue: strToNum().optional().default(0),
  notes: z.string().optional().default(''),
  source: z.enum(['pos', 'online', 'qr', 'waiter']).optional().default('pos'),
  cashierId: strToNum().optional().nullable(),
  cashierName: z.string().optional().nullable(),
  currencyId: strToNum().optional().nullable(),
  currencyCode: z.string().optional().nullable(),
  exchangeRate: z.string().optional().default('1'),
  totalCovers: strToNum().optional().default(0),
  shiftId: strToNum().optional().nullable(),
  subTotal: strToNum().optional().default(0),
  taxRate: z.string().optional().default('0'),
  serviceChargeRate: z.string().optional().default('0'),
  paymentMethod: z
    .enum(['cash', 'qris', 'debit', 'credit', 'other', 'points', 'transfer', 'e-wallet'])
    .optional(),
  appliedDiscountId: strToNum().optional().nullable(),
  pointDiscountAmount: strToNum().optional().default(0),
  redeemedPoints: strToNum().optional().default(0)
})

exports.updateOrderStatusSchema = z.object({
  id: strToNum(),
  store: strToNum().optional(),
  status: z.enum([
    'pending',
    'confirmed',
    'preparing',
    'ready',
    'served',
    'paid',
    'cancelled',
    'void'
  ]),
  changedBy: strToNum().optional().nullable(),
  changedByName: z.string().optional().nullable(),
  notes: z.string().optional().default('')
})

exports.updateOrderItemStatusSchema = z.object({
  id: strToNum(),
  itemId: strToNum(),
  itemStatus: z.string().min(1)
})

// ===================== Location =====================
exports.createLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required'),
  store: strToNum().optional().nullable(),
  address: z.string().optional().nullable(),
  detailLocation: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  province: z.string().optional().nullable(),
  district: z.string().optional().nullable(),
  village: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  latitude: z.string().optional().nullable(),
  longitude: z.string().optional().nullable(),
  mainBranch: z.union([z.boolean(), z.string()]).optional().default(false),
  description: z.string().optional().nullable(),
  openingHours: jsonField().optional().nullable(),
  managerName: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')),
  phoneNumber: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  status: statusEnum,
  socialMedia: jsonField().optional().nullable(),
  dailyTarget: strToNum().optional().default(0),
  image: z.string().optional().nullable()
})

exports.updateLocationSchema = exports.createLocationSchema
  .partial()
  .passthrough()
// ponytail: passthrough preserves locationId, id, storeId, coordinates, etc.
// that the controller needs but aren't in the base schema

// ===================== Supplier =====================
exports.createSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required'),
  store: storeArray().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')),
  contactPerson: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: statusEnum,
  products: z
    .array(
      z.object({
        name: z.string().min(1),
        price: strToNum().optional().default(0),
        unit: z.string().optional().default('pcs'),
        leadTime: z.number().optional().default(0),
        leadTimeUnit: z.string().optional().default('hari'),
        qualityRating: strToNum().optional().default(0),
        minOrderQty: z.string().optional().default("1"),
        notes: z.string().optional().nullable(),
        lastPrice: z.number().optional().default(0),
        productId: z.number().optional().nullable()
      }).passthrough()
    )
    .optional()
    .nullable()
})

exports.updateSupplierSchema = exports.createSupplierSchema.partial()

// ===================== Ingredient =====================
exports.createIngredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  store: strToNum().optional().nullable(),
  category: strToNum().optional().nullable(),
  supplier: strToNum().optional().nullable(),
  stock: strToNum().optional().default(0),
  minStock: strToNum().optional().default(0),
  unit: z.string().optional().default('pcs'),
  baseUnit: z.string().optional().default('pcs'),
  conversionFactor: z.coerce.string().optional().default('1'),
  costPrice: strToNum().optional().default(0),
  status: statusEnum
})

exports.updateIngredientSchema = exports.createIngredientSchema.partial()

// ===================== User =====================
const userBaseSchema = z.object({
  userName: z.string().min(1, 'Username is required'),
  password: z.string().min(6, 'Password min 6 characters'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
  email: z.string().email().optional().or(z.literal('')),
  userType: z.enum(['admin', 'user', 'kasir']).default('user'),
  fullName: z.string().optional().default(''),
  phoneNumber: z.string().optional().default(''),
  gender: z.string().optional().default(''),
  address: z.string().optional().default(''),
  dateOfBirth: z.string().optional().nullable(),
  placeOfBirth: z.string().optional().default(''),
  store: optionalStrToNum().nullable(),
  shift: optionalStrToNum().nullable(),
  position: optionalStrToNum().nullable(),
  roleId: optionalStrToNum().nullable(),
  department: z.string().optional().nullable(),
  departmentId: optionalStrToNum().nullable(),
  employmentType: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  status: statusEnum,
  accessMenu: jsonField().optional().nullable(),
  monthlySalary: z.string().optional().nullable(),
  dailySalary: z.string().optional().nullable()
})
exports.createUserSchema = userBaseSchema.refine(
  (d) => d.password === d.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  }
)

const employeeBaseSchema = z.object({
  userName: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  confirmPassword: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')),
  userType: z.enum(['admin', 'user', 'kasir']).default('user'),
  fullName: z.string().optional().default(''),
  phoneNumber: z.string().optional().default(''),
  gender: z.string().optional().default(''),
  address: z.string().optional().default(''),
  dateOfBirth: z.string().optional().nullable(),
  placeOfBirth: z.string().optional().default(''),
  employeeId: z.string().optional().nullable(),
  store: optionalStrToNum().nullable(),
  shift: optionalStrToNum().nullable(),
  position: optionalStrToNum().nullable(),
  roleId: optionalStrToNum().nullable(),
  department: z.string().optional().nullable(),
  departmentId: optionalStrToNum().nullable(),
  employmentType: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  contractDuration: z.string().optional().nullable(),
  status: statusEnum,
  accessMenu: jsonField().optional().nullable(),
  monthlySalary: z.string().optional().nullable(),
  dailySalary: z.string().optional().nullable()
})
exports.createEmployeeSchema = employeeBaseSchema.superRefine((d, ctx) => {
  if (d.status !== 'draft') {
    if (!d.userName)
      ctx.addIssue({
        code: 'custom',
        message: 'Username is required',
        path: ['userName']
      })
    if (!d.password || d.password.length < 6)
      ctx.addIssue({
        code: 'custom',
        message: 'Password min 6 characters',
        path: ['password']
      })
    if (!d.confirmPassword)
      ctx.addIssue({
        code: 'custom',
        message: 'Confirm password is required',
        path: ['confirmPassword']
      })
    if (d.password !== d.confirmPassword)
      ctx.addIssue({
        code: 'custom',
        message: 'Passwords do not match',
        path: ['confirmPassword']
      })
  }
})
exports.updateUserSchema = userBaseSchema.partial().extend({
  id: strToNum()
})

// ===================== Discount =====================
exports.createDiscountSchema = z.object({
  name: z.string().min(1, 'Discount name is required'),
  store: strToNum().nullable().optional(),
  type: z.preprocess(
    (val) => (val === '' || val === undefined ? 'percent' : val),
    z.enum(['percent', 'nominal'])
  ),
  value: strToNum().optional().default(0),
  maximumDiscount: strToNum().optional().default(0),
  minimumOrder: strToNum().optional().default(0),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  code: z.string().nullable().optional(),
  conditions: jsonField().optional(),
  status: z.union([z.boolean(), z.string()]).optional().default(true),
  description: z.string().nullable().optional()
})

exports.updateDiscountSchema = exports.createDiscountSchema.partial()

// ===================== Purchase Order =====================
const poItemSchema = z.object({
  product: strToNum().optional().nullable(),
  productName: z.string().optional(),
  ingredient: strToNum().optional().nullable(),
  ingredientName: z.string().optional(),
  supplier: strToNum().optional().nullable(),
  quantity: strToNum(),
  price: strToNum().optional().default(0),
  unit: z.string().optional().default('pcs'),
  conversionToBase: strToNum().optional().default(1)
})

exports.createPurchaseOrderSchema = z.object({
  store: strToNum(),
  items: z.array(poItemSchema).min(1, 'At least one item is required'),
  notes: z.string().optional().default(''),
  discount: strToNum().optional().default(0),
  additionalCost: strToNum().optional().default(0),
  overDeliveryTolerance: strToNum().optional().default(10),
  pic: strToNum().optional().nullable(),
  createdBy: z.union([z.number(), strToNum()]).optional().nullable(),
  status: z
    .enum(['draft', 'pending', 'ordered', 'received', 'cancelled'])
    .optional()
    .default('draft'),
  orderDate: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  paymentMethod: z.enum(['cash', 'credit']).optional().default('cash'),
  tenor: strToNum().optional().default(0),
  dpPercent: strToNum().optional().default(0)
})

exports.updatePurchaseOrderSchema = exports.createPurchaseOrderSchema.partial()

// ===================== Reservation =====================
exports.createReservationSchema = z.object({
  store: strToNum(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().optional().nullable(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  reservationDate: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Time is required'),
  endTime: z.string().optional().nullable(),
  guestCount: strToNum().optional().default(1),
  tableId: strToNum().optional().nullable(),
  notes: z.string().optional().default(''),
  status: z
    .enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show'])
    .optional()
    .default('pending')
})

exports.updateReservationSchema = exports.createReservationSchema.partial()

// ===================== Table =====================
exports.createTableSchema = z.object({
  store: strToNum().optional().nullable(),
  name: z.string().min(1, 'Table name is required'),
  capacity: strToNum().optional().default(4),
  status: z
    .enum(['available', 'occupied', 'reserved', 'maintenance'])
    .optional()
    .default('available'),
  description: z.string().optional().nullable()
})

exports.updateTableSchema = exports.createTableSchema.partial().extend({
  id: strToNum()
})

// ===================== Tax Config =====================
exports.createTaxConfigSchema = z.object({
  store: strToNum().optional().nullable(),
  name: z.string().min(1, 'Tax name is required'),
  rate: z.union([z.number(), z.string()]).transform((v) => {
    if (typeof v === 'number') return v
    return parseFloat(v)
  }),
  type: z.enum(['ppn', 'service_charge', 'other']).optional().default('ppn'),
  status: statusEnum,
  description: z.string().optional().nullable()
})

exports.updateTaxConfigSchema = exports.createTaxConfigSchema.partial()

// ===================== Expense =====================
exports.createExpenseSchema = z.object({
  store: strToNum().optional().nullable(),
  categoryId: strToNum().optional().nullable(),
  amount: strToNum().optional().nullable(),
  description: z.string().optional().nullable(),
  date: z.string().optional(),
  notes: z.string().optional().default(''),
  status: z
    .enum(['draft', 'pending', 'approved', 'rejected'])
    .optional()
    .default('pending')
})

exports.updateExpenseSchema = exports.createExpenseSchema.partial()

// ===================== Member =====================
exports.createMemberSchema = z.object({
  store: strToNum().optional().nullable(),
  nameMember: z.string().min(1, 'Member name is required'),
  phoneNumber: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')),
  point: strToNum().optional().default(0),
  tier: strToNum().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  gender: z.string().optional().default(''),
  address: z.string().optional().nullable(),
  createdBy: strToNum().optional(),
  status: z.string().optional().default('active')
})

exports.updateMemberSchema = exports.createMemberSchema.partial()

// ===================== Goods Receipt =====================
const grItemSchema = z.object({
  purchaseOrderItem: strToNum().optional().nullable(),
  product: strToNum().optional().nullable(),
  productName: z.string().optional(),
  ingredient: strToNum().optional().nullable(),
  ingredientName: z.string().optional(),
  qtyReceived: strToNum().optional().default(0),
  quantity: strToNum().optional().default(0),
  conditionNotes: z.string().optional().default(''),
  unit: z.string().optional().default('pcs'),
  price: strToNum().optional().default(0),
  costPrice: strToNum().optional().default(0),
  conversionToBase: strToNum().optional().default(1)
})

exports.createGoodsReceiptSchema = z.object({
  store: strToNum().optional().nullable(),
  purchaseOrderId: strToNum().optional().nullable(),
  supplier: strToNum().optional().nullable(),
  items: z.array(grItemSchema).min(1, 'At least one item is required'),
  notes: z.string().optional().default(''),
  receivedDate: z.string().optional(),
  status: z.string().optional().default('pending')
})

exports.updateGoodsReceiptSchema = exports.createGoodsReceiptSchema.partial()

// ===================== Production Order =====================
exports.createProductionOrderSchema = z.object({
  store: strToNum().optional().nullable(),
  productItemId: strToNum(),
  plannedQty: strToNum(),
  scheduledDate: z.string().optional().nullable(),
  notes: z.string().optional().default(''),
  status: z
    .enum(['planned', 'in_progress', 'completed', 'cancelled', 'draft'])
    .optional()
    .default('planned')
})

exports.updateProductionOrderSchema =
  exports.createProductionOrderSchema.partial()

// ===================== Stock Opname =====================
exports.createStockOpnameSchema = z.object({
  store: strToNum().optional().nullable(),
  auditDate: z.string().optional().nullable(),
  auditor: z.string().optional().nullable(),
  notes: z.string().optional().default(''),
  status: statusEnum,
  items: z.array(z.record(z.any())).optional().default([])
})

exports.updateStockOpnameSchema = exports.createStockOpnameSchema.partial()

// ===================== Shift =====================
exports.createShiftSchema = z.object({
  store: strToNum().optional().nullable(),
  nama_shift: z.string().min(1, 'Shift name is required'),
  tipe_shift: z.string().optional().default(''),
  jam_mulai: z.string().min(1, 'Start time is required'),
  jam_selesai: z.string().min(1, 'End time is required'),
  tanggal_mulai: z.string().optional().nullable(),
  tanggal_selesai: z.string().optional().nullable(),
  karyawan: jsonField().optional().default([]),
  status: statusEnum
})

exports.updateShiftSchema = exports.createShiftSchema.partial().extend({
  id: strToNum()
})

// ===================== Department / Position =====================
exports.createDepartmentSchema = z.object({
  store: strToNum().optional().nullable(),
  name: z.string().min(1, 'Department name is required'),
  description: z.string().optional().nullable(),
  status: statusEnum
})

exports.updateDepartmentSchema = exports.createDepartmentSchema.partial().extend({
  id: strToNum()
})

exports.createPositionSchema = z.object({
  store: strToNum().optional().nullable(),
  name: z.string().min(1, 'Position name is required'),
  departmentId: strToNum().optional().nullable(),
  description: z.string().optional().nullable(),
  status: statusEnum
})

exports.updatePositionSchema = exports.createPositionSchema.partial().extend({
  id: strToNum()
})

// ===================== Cash Register =====================
exports.openCashRegisterSchema = z.object({
  store: strToNum(),
  initialBalance: strToNum(),
  cashierId: strToNum().optional().nullable(),
  notes: z.string().optional().default('')
})

exports.closeCashRegisterSchema = z.object({
  id: strToNum(),
  finalBalance: strToNum(),
  notes: z.string().optional().default('')
})

// ===================== BOM =====================
exports.createBomSchema = z.object({
  productId: strToNum(),
  name: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  status: z.string().optional().default('active'),
  createdBy: strToNum().optional(),
  lines: z
    .array(
      z.object({
        ingredientId: strToNum(),
        qty: z.union([z.number(), strToNum()]),
        unit: z.string().optional().default('pcs'),
        notes: z.string().optional().default('')
      })
    )
    .min(1, 'At least one ingredient is required')
})

exports.updateBomSchema = exports.createBomSchema.partial()

// ===================== Stock Transfer =====================
exports.createStockTransferSchema = z.object({
  fromStore: strToNum(),
  toStore: strToNum(),
  transferredBy: z.string().optional().default(''),
  items: z
    .array(
      z.object({
        product: strToNum().optional(),
        productId: strToNum().optional(),
        quantity: strToNum().optional(),
        qty: strToNum().optional(),
        unit: z.string().optional().default('pcs'),
        notes: z.string().optional().default('')
      })
    )
    .min(1, 'At least one item is required'),
  notes: z.string().optional().default('')
})

// ===================== Checkout / POS =====================
exports.createCheckoutSchema = z.object({
  idCustomer: z.union([z.number(), strToNum()]).optional(),
  discountId: z.union([z.number(), strToNum()]).nullable().optional(),
  paymentMethod: z.string().min(1),
  paymentAmount: z.union([z.number(), strToNum()]),
  notes: z.string().optional().default(''),
  items: z
    .array(
      z.object({
        idProduct: z.union([z.number(), strToNum()]),
        qty: z.union([z.number(), strToNum()]),
        price: z.union([z.number(), strToNum()]).optional(),
        notes: z.string().optional().default('')
      })
    )
    .min(1, 'At least one item is required')
})

// ===================== Type Payment =====================
exports.createTypePaymentSchema = z.object({
  name: z.string().min(1, 'name is required'),
  icon: z.string().optional().default(''),
  type: z.string().optional().default('cash'),
  status: z.union([z.boolean(), z.string()]).optional().default('active'),
  store: z
    .union([z.string(), z.array(z.number().int()), z.array(strToNum())])
    .optional()
    .nullable()
    .transform((v) => {
      if (v === null || v === undefined || v === '') return null
      if (typeof v === 'string') {
        if (v === 'all') return 'all'
        try {
          const p = JSON.parse(v)
          return Array.isArray(p) ? p.map(Number) : [Number(p)]
        } catch {
          return [Number(v)]
        }
      }
      return v.map(Number)
    })
})
exports.updateTypePaymentSchema = exports.createTypePaymentSchema.partial()

// ===================== Expense Category =====================
exports.createExpenseCategorySchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional().default(''),
  icon: z.string().optional().default(''),
  status: statusEnum
})
exports.updateExpenseCategorySchema =
  exports.createExpenseCategorySchema.partial()

// ===================== Ingredient Category =====================
exports.createIngredientCategorySchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional().default(''),
  status: z.enum(['active', 'inactive', 'draft']).optional().default('active')
})
exports.updateIngredientCategorySchema =
  exports.createIngredientCategorySchema.partial()

// ===================== Member Tier =====================
exports.createMemberTierSchema = z.object({
  name: z.string().min(1, 'name is required'),
  minPoints: z.union([z.number(), strToNum()]).optional().default(0),
  maxPoints: z.union([z.number(), strToNum()]).nullable().optional(),
  discountPercent: z.union([z.number(), strToNum()]).optional().default(0),
  pointMultiplier: z.union([z.number(), strToNum()]).optional().default(1),
  benefits: z.string().optional().default(''),
  color: z.string().optional().default(''),
  status: statusEnum
})
exports.updateMemberTierSchema = exports.createMemberTierSchema.partial()

// ===================== Role =====================
exports.createRoleSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional().default(''),
  status: z.string().optional().default('active'),
  createdBy: z.union([z.number(), z.string()]).optional().nullable(),
  accessMenu: z.array(z.any()).optional().default([]),
  permissions: z
    .union([z.string(), z.array(z.any()), z.record(z.any())])
    .optional()
    .default({})
})
exports.updateRoleSchema = exports.createRoleSchema.extend({
  id: z.union([z.number(), z.string()]),
  modifiedBy: z.union([z.number(), z.string()]).optional().nullable()
}).partial()

// ===================== Purchase Payment =====================
exports.createPurchasePaymentSchema = z.object({
  purchaseOrder: z.union([z.number(), strToNum()]),
  supplier: z.union([z.number(), strToNum()]).optional(),
  amount: z.union([z.number(), strToNum()]),
  paymentMethod: z.string().min(1),
  paymentDate: z.string().optional(),
  reference: z.string().optional().default(''),
  notes: z.string().optional().default('')
})
exports.updatePurchasePaymentSchema =
  exports.createPurchasePaymentSchema.partial()

// ===================== Purchase Return =====================
exports.createPurchaseReturnSchema = z.object({
  purchaseOrder: z.union([z.number(), strToNum()]),
  reason: z.string().optional().nullable(),
  returnedBy: z.union([z.number(), strToNum()]).optional().nullable(),
  items: z.array(z.record(z.any())).min(1, 'At least one item is required'),
  notes: z.string().optional().nullable()
})
exports.updatePurchaseReturnSchema =
  exports.createPurchaseReturnSchema.partial()

// ===================== Split Bill =====================
exports.createSplitBillSchema = z.object({
  orderId: z.union([z.number(), strToNum()]),
  items: z
    .array(
      z.object({
        idProduct: z.union([z.number(), strToNum()]),
        qty: z.union([z.number(), strToNum()])
      })
    )
    .min(1, 'At least one item is required')
})

// ===================== Currency =====================
exports.createCurrencySchema = z.object({
  code: z.string().min(1, 'code is required').max(10),
  name: z.string().min(1, 'name is required'),
  symbol: z.string().optional().default(''),
  exchangeRate: z.union([z.number(), strToNum()]).optional().default(1),
  isDefault: z
    .union([
      z.boolean(),
      z.string().transform((v) => v === 'true' || v === '1')
    ])
    .optional()
    .default(false)
})
exports.updateCurrencySchema = exports.createCurrencySchema.partial()

// ===================== Social Media =====================
exports.createSocialMediaSchema = z.object({
  name: z.string().min(1, 'name is required'),
  url: z.string().min(1, 'url is required'),
  icon: z.string().optional().default(''),
  isActive: z
    .union([
      z.boolean(),
      z.string().transform((v) => v === 'true' || v === '1')
    ])
    .optional()
    .default(true)
})
exports.updateSocialMediaSchema = exports.createSocialMediaSchema.partial()

// ===================== FAQ =====================
exports.createFaqSchema = z.object({
  question: z.string().min(1, 'question is required'),
  answer: z.string().min(1, 'answer is required'),
  category: z.string().optional().default(''),
  order: z.union([z.number(), strToNum()]).optional().default(0),
  isActive: z
    .union([
      z.boolean(),
      z.string().transform((v) => v === 'true' || v === '1')
    ])
    .optional()
    .default(true)
})
exports.updateFaqSchema = exports.createFaqSchema.partial()

// ===================== Notification =====================
exports.createNotificationSchema = z.object({
  title: z.string().min(1, 'title is required'),
  message: z.string().min(1, 'message is required'),
  type: z.string().optional().default('info'),
  targetUser: z.union([z.number(), strToNum()]).nullable().optional()
})

// ===================== Accounts Receivable =====================
exports.createAccountsReceivableSchema = z.object({
  orderId: z.union([z.number(), strToNum()]),
  customerName: z.string().optional().default(''),
  totalAmount: z.union([z.number(), strToNum()]),
  paidAmount: z.union([z.number(), strToNum()]).optional().default(0),
  dueDate: z.string().optional(),
  notes: z.string().optional().default('')
})
exports.updateAccountsReceivableSchema =
  exports.createAccountsReceivableSchema.partial()

// ===================== Invoice =====================
exports.createInvoiceSchema = z.object({
  orderId: z.union([z.number(), strToNum()]),
  customerName: z.string().optional().default(''),
  notes: z.string().optional().default('')
})
exports.updateInvoiceSchema = exports.createInvoiceSchema.partial()

// ===================== Invoice Setting =====================
exports.updateInvoiceSettingSchema = z.object({
  store: strToNum(),
  showStoreName: z.union([z.boolean(), z.string()]).optional(),
  showAddress: z.union([z.boolean(), z.string()]).optional(),
  showMemberInfo: z.union([z.boolean(), z.string()]).optional(),
  showLogo: z.union([z.boolean(), z.string()]).optional(),
  showSocialMedia: z.union([z.boolean(), z.string()]).optional(),
  socialMediaVisibility: z.union([z.string(), z.record(z.any())]).optional(),
  addressFieldsVisibility: z.union([z.string(), z.record(z.any())]).optional(),
  memberFieldsVisibility: z.union([z.string(), z.record(z.any())]).optional(),
  removeLogo: z.union([z.boolean(), z.string()]).optional(),
  logo: z.any().optional()
})

// ===================== POS endpoints =====================
exports.createPosTransferSchema = z.object({
  fromStore: strToNum(),
  toStore: strToNum(),
  items: z
    .array(
      z.object({
        product: strToNum(),
        quantity: strToNum(),
        notes: z.string().optional().default('')
      })
    )
    .min(1, 'At least one item'),
  notes: z.string().optional().default(''),
  transferredBy: strToNum().optional()
})

exports.createPosAdjustSchema = z.object({
  productId: strToNum(),
  qty: strToNum().optional(),
  sign: z.enum(['+', '-']).optional(),
  value: strToNum().optional(),
  reason: z.string().optional().default(''),
  storeId: strToNum().optional()
})

exports.createPosReturnSchema = z.object({
  items: z.array(z.record(z.any())).min(1, 'At least one item'),
  reason: z.string().optional().default(''),
  returnedBy: strToNum().optional()
})

exports.updatePriceByStoreSchema = z.object({
  productId: strToNum(),
  storePrices: z.union([z.string(), z.array(z.any()), z.record(z.any())])
})

exports.sendInvoiceWaSchema = z.object({
  orderId: z.union([z.number(), strToNum()]),
  phone: z.string().min(1, 'Phone is required')
})

exports.sendInvoiceEmailSchema = z.object({
  orderId: z.union([z.number(), strToNum()]),
  email: z.string().email('Invalid email')
})

exports.addBatchSchema = z.object({
  productId: strToNum(),
  batchCode: z.string().min(1, 'Batch code is required'),
  expiryDate: z.string().optional().nullable(),
  qty: strToNum(),
  store: strToNum()
})

// ===================== DELIVERY =====================
exports.createDriverSchema = z.object({
  name: z.string().min(1, 'Driver name is required'),
  store: storeArray().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')),
  vehicleType: z.string().optional().nullable(),
  vehiclePlate: z.string().optional().nullable(),
  status: statusEnum,
  notes: z.string().optional().nullable()
})
exports.updateDriverSchema = exports.createDriverSchema.partial()

exports.createDeliveryOrderSchema = z.object({
  order: optionalStrToNum(),
  store: strToNum(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().optional().nullable(),
  deliveryAddress: z.string().min(1, 'Delivery address is required'),
  deliveryNotes: z.string().optional().nullable(),
  destinationLat: optionalStrToNum(),
  destinationLng: optionalStrToNum(),
  deliveryFee: optionalStrToNum().default(0),
  totalDistance: optionalStrToNum(),
  source: z.string().optional().default('pos')
})

exports.updateDeliveryStatusSchema = z.object({
  id: strToNum(),
  status: z.enum([
    'pending',
    'assigned',
    'picked_up',
    'in_transit',
    'delivered',
    'cancelled'
  ]),
  note: z.string().optional().nullable(),
  changedBy: optionalStrToNum(),
  changedByName: z.string().optional().nullable()
})

exports.assignDriverSchema = z.object({
  driverId: strToNum(),
  driverName: z.string().optional().nullable()
})

exports.cancelDeliverySchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required')
})

exports.updateDriverStatusSchema = z.object({
  status: z.enum(['active', 'inactive', 'busy', 'offline', 'draft'])
})

exports.marketplaceConfigSchema = z.object({
  store: strToNum(),
  gofood: z
    .object({
      enabled: z.boolean().optional().default(false),
      merchantId: z.string().optional().nullable(),
      apiKey: z.string().optional().nullable()
    })
    .optional()
    .nullable(),
  grabfood: z
    .object({
      enabled: z.boolean().optional().default(false),
      merchantId: z.string().optional().nullable(),
      apiKey: z.string().optional().nullable()
    })
    .optional()
    .nullable(),
  shopeefood: z
    .object({
      enabled: z.boolean().optional().default(false),
      merchantId: z.string().optional().nullable(),
      apiKey: z.string().optional().nullable()
    })
    .optional()
    .nullable()
})

// ===================== FAQ =====================
exports.askFaqSchema = z.object({
  question: z.string().min(1, 'Question is required')
})

// ===================== Queue / Waitlist =====================
exports.createQueueSchema = z.object({
  store: strToNum(),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().optional().nullable(),
  partySize: z
    .number()
    .int()
    .min(1, 'Party size must be at least 1')
    .default(1),
  priority: z
    .enum(['normal', 'vip', 'elderly', 'pregnant', 'disabled'])
    .default('normal'),
  estimatedWaitMinutes: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedTo: strToNum().optional().nullable()
})

exports.updateQueueSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerPhone: z.string().optional().nullable(),
  partySize: z.number().int().min(1).optional(),
  priority: z
    .enum(['normal', 'vip', 'elderly', 'pregnant', 'disabled'])
    .optional(),
  estimatedWaitMinutes: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedTo: strToNum().optional().nullable()
})

exports.updateQueueStatusSchema = z.object({
  status: z.enum(['waiting', 'seated', 'cancelled', 'no_show', 'expired']),
  tableId: strToNum().optional().nullable(),
  notes: z.string().optional().nullable()
})

// ===================== Supplier Performance =====================
exports.calculateSupplierScoreSchema = z.object({
  store: strToNum(),
  supplierId: strToNum(),
  period: z.enum(['monthly', 'quarterly', 'yearly', 'all_time']),
  periodStart: z.string().optional().nullable(),
  periodEnd: z.string().optional().nullable()
})

exports.updateSupplierScoreNoteSchema = z.object({
  notes: z.string().optional().nullable()
})

// ===================== Automated Promotions =====================
exports.createPromoCampaignSchema = z.object({
  store: strToNum(),
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  type: z.enum([
    'happy_hour',
    'birthday',
    'buy_x_get_y',
    'spend_get',
    'manual',
    'automatic'
  ]),
  discountType: z
    .enum(['percentage', 'fixed', 'free_item', 'buy_x_get_y'])
    .default('percentage'),
  discountValue: z.number().int().min(0).default(0),
  maxDiscount: z.number().int().optional().nullable(),
  minPurchase: z.number().int().min(0).default(0),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  applicableTo: z
    .enum([
      'all',
      'specific_products',
      'specific_categories',
      'specific_members'
    ])
    .default('all'),
  applicableIds: z.array(z.number().int()).optional().nullable(),
  maxUsageTotal: z.number().int().optional().nullable(),
  maxUsagePerMember: z.number().int().optional().nullable(),
  priority: z.number().int().min(0).default(0),
  isCombinable: z.boolean().default(false),
  autoActivate: z.boolean().default(false),
  rules: z
    .array(
      z.object({
        ruleType: z.enum([
          'time',
          'birthday',
          'buy_x_get_y',
          'spend_threshold',
          'member_tier',
          'first_purchase',
          'custom'
        ]),
        condition: z.record(z.any()),
        priority: z.number().int().min(0).default(0)
      })
    )
    .optional(),
  rewards: z
    .array(
      z.object({
        rewardType: z.enum([
          'discount_percentage',
          'discount_fixed',
          'free_item',
          'buy_x_get_y',
          'points_multiplier',
          'cashback'
        ]),
        rewardValue: z.number().int().min(0),
        maxRewardValue: z.number().int().optional().nullable(),
        productId: z.number().int().optional().nullable(),
        productIds: z.array(z.number().int()).optional().nullable(),
        quantity: z.number().int().min(1).default(1),
        condition: z.record(z.any()).optional().nullable(),
        priority: z.number().int().min(0).default(0)
      })
    )
    .optional()
})

exports.updatePromoCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  type: z
    .enum([
      'happy_hour',
      'birthday',
      'buy_x_get_y',
      'spend_get',
      'manual',
      'automatic'
    ])
    .optional(),
  discountType: z
    .enum(['percentage', 'fixed', 'free_item', 'buy_x_get_y'])
    .optional(),
  discountValue: z.number().int().min(0).optional(),
  maxDiscount: z.number().int().optional().nullable(),
  minPurchase: z.number().int().min(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  applicableTo: z
    .enum([
      'all',
      'specific_products',
      'specific_categories',
      'specific_members'
    ])
    .optional(),
  applicableIds: z.array(z.number().int()).optional().nullable(),
  maxUsageTotal: z.number().int().optional().nullable(),
  maxUsagePerMember: z.number().int().optional().nullable(),
  priority: z.number().int().min(0).optional(),
  isCombinable: z.boolean().optional(),
  autoActivate: z.boolean().optional(),
  status: z
    .enum(['draft', 'active', 'paused', 'expired', 'cancelled'])
    .optional()
})

exports.applyPromoSchema = z.object({
  store: strToNum(),
  orderId: strToNum().optional().nullable(),
  memberId: strToNum().optional().nullable(),
  code: z.string().optional(),
  cartItems: z
    .array(
      z.object({
        productId: z.number().int(),
        quantity: z.number().int().min(1),
        price: z.number().int().min(0)
      })
    )
    .optional(),
  subtotal: z.number().int().min(0).optional()
})

// ===================== Query param helpers =====================
exports.paginationSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('10'),
  store: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional()
})

// ===================== Sales Return =====================
const returnItemSchema = z.object({
  productId: strToNum(),
  orderItemId: strToNum().optional(),
  qty: strToNum().refine((q) => q > 0, 'Qty must be greater than 0'),
  unit: z.string().optional().default('pcs'),
  conversionToBase: z.coerce.number().optional().default(1),
  notes: z.string().optional().default('')
})

exports.createSalesReturnSchema = z.object({
  items: z.array(returnItemSchema).min(1, 'At least one item required'),
  reason: z.string().min(1, 'Reason is required'),
  returnedBy: z.union([strToNum(), z.string()]).optional()
})

exports.approveSalesReturnSchema = z.object({
  id: strToNum()
})

exports.rejectSalesReturnSchema = z.object({
  id: strToNum()
})
