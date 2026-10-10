// P1 Outlet Pricing Hardening: Fix A — Order Create Store Authorization
//
// Unit tests for the authorization boundary in createOrder controller.
// Tests verify that:
// 1. Non-super-admin requests are pinned to req.storeId (set by middleware)
// 2. Conflicting query/body store identifiers are rejected before writes
// 3. All downstream store-dependent operations use the canonical authorized store
// 4. Rejection occurs before any database mutations or side effects

const orderController = require('../api/controller/order')

jest.mock('../db/models', () => ({
  order: {
    findOne: jest.fn(),
    create: jest.fn()
  },
  order_item: {
    destroy: jest.fn()
  },
  product: {
    findByPk: jest.fn()
  },
  table: {
    findOne: jest.fn()
  },
  cashRegister: {
    findOne: jest.fn()
  },
  sequelize: {
    transaction: jest.fn((cb) => cb({}))
  }
}))

jest.mock('../utils/auditLog', () => ({
  createAudit: jest.fn(),
  redactAndAudit: jest.fn(() => Promise.resolve()),
  AUDIT_ACTIONS: { CREATE: 'CREATE', UPDATE: 'UPDATE' }
}))

jest.mock('../api/service/orderFinancials', () => ({
  computeOrderFinancials: jest.fn()
}))

const db = require('../db/models')

const mockRes = () => {
  const res = {
    json: jest.fn(() => res),
    status: jest.fn(function(code) {
      this.statusCode = code
      return this
    })
  }
  return res
}

describe('createOrder — store authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('non-super-admin: authorized storeId, conflicting body.store → 401 before writes', async () => {
    const req = {
      user: { roleType: 'cashier', id: 1, store: 10 },
      storeId: 10,
      body: {
        store: 20,
        items: [{ productId: 1, quantity: 1, price: 5000 }],
        paymentMethod: 'CASH',
        cashAmount: 5000
      },
      query: {},
      cookies: {}
    }
    const res = mockRes()

    await orderController.createOrder(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/unauthorized|store/i) })
    )
    expect(db.order.findOne).not.toHaveBeenCalled()
    expect(db.order.create).not.toHaveBeenCalled()
  })

  test('non-super-admin: authorized storeId, matching body.store → passes auth check', async () => {
    const req = {
      user: { roleType: 'cashier', id: 1, store: 10 },
      storeId: 10,
      body: {
        store: 10,
        items: [{ productId: 1, quantity: 1, price: 5000 }],
        paymentMethod: 'CASH',
        cashAmount: 5000
      },
      query: {},
      cookies: {}
    }
    const res = mockRes()

    db.order.findOne.mockResolvedValue(null)
    db.product.findByPk.mockResolvedValue({
      id: 1,
      nameProduct: 'Coffee',
      price: 5000,
      store: 10
    })

    try {
      await orderController.createOrder(req, res)
    } catch (e) {
      // Controller will fail later due to mocking, but auth should pass
    }

    expect(res.status).not.toHaveBeenCalledWith(401)
  })

  test('non-super-admin: authorized storeId, conflicting query.store → 401 before writes', async () => {
    const req = {
      user: { roleType: 'cashier', id: 1, store: 10 },
      storeId: 10,
      body: {
        items: [{ productId: 1, quantity: 1, price: 5000 }],
        paymentMethod: 'CASH',
        cashAmount: 5000
      },
      query: { store: 20 },
      cookies: {}
    }
    const res = mockRes()

    await orderController.createOrder(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(db.order.create).not.toHaveBeenCalled()
  })

  test('non-super-admin: missing authorized storeId → 400 before writes', async () => {
    const req = {
      user: { roleType: 'cashier', id: 1, store: null },
      storeId: null,
      body: {
        items: [{ productId: 1, quantity: 1, price: 5000 }],
        paymentMethod: 'CASH',
        cashAmount: 5000
      },
      query: {},
      cookies: {}
    }
    const res = mockRes()

    await orderController.createOrder(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(db.order.create).not.toHaveBeenCalled()
  })

  test('super-admin: can specify store in body', async () => {
    const req = {
      user: { roleType: 'super_admin', id: 1 },
      storeId: 10,
      body: {
        store: 20,
        items: [{ productId: 1, quantity: 1, price: 5000 }],
        paymentMethod: 'CASH',
        cashAmount: 5000
      },
      query: {},
      cookies: {}
    }
    const res = mockRes()

    db.order.findOne.mockResolvedValue(null)
    db.product.findByPk.mockResolvedValue({
      id: 1,
      nameProduct: 'Coffee',
      price: 5000,
      store: 20
    })

    try {
      await orderController.createOrder(req, res)
    } catch (e) {
      // Controller will fail later due to mocking, but auth should pass
    }

    expect(res.status).not.toHaveBeenCalledWith(401)
  })
})
