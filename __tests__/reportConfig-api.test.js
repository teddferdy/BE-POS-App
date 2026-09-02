require('dotenv').config()

const request = require('supertest')
const express = require('express')
const jwt = require('jsonwebtoken')
const reportConfigRoutes = require('../api/routes/reportConfig')

jest.mock('../db/models', () => ({
  reportConfig: {
    findAll: jest.fn(() => Promise.resolve([])),
    findOne: jest.fn(() => Promise.resolve(null)),
    findOrCreate: jest.fn(({ defaults }) => Promise.resolve([{ ...defaults, save: jest.fn() }, true]))
  }
}))

const secret = process.env.JWT_SECRET_KEY || 'secret-key-user'
const token = jwt.sign({ id: 9999, userName: 'superadmin', roleType: 'super_admin' }, secret)

const app = express()
app.use(express.json())
app.use('/report-config', reportConfigRoutes)

describe('reportConfig routes', () => {
  test('GET /report-config returns list', async () => {
    const res = await request(app)
      .get('/report-config')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  test('GET /report-config/meta returns column catalogs', async () => {
    const res = await request(app)
      .get('/report-config/meta')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.success).toBe(true)
    const keys = res.body.data.map((d) => d.key)
    expect(keys).toContain('daily')
    expect(keys).toContain('sales')
  })

  test('GET /report-config/:key returns single config', async () => {
    const res = await request(app)
      .get('/report-config/daily')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.key).toBe('daily')
  })

  test('PUT /report-config/:key upserts and returns config', async () => {
    const res = await request(app)
      .put('/report-config/daily')
      .set('Authorization', `Bearer ${token}`)
      .send({ config: { selectedColumns: ['tanggal', 'netProfit'], accentColor: '#123456' } })
      .expect(200)
    expect(res.body.data.key).toBe('daily')
    expect(res.body.data.config.accentColor).toBe('#123456')
  })

  test('PUT rejects unknown report key', async () => {
    const res = await request(app)
      .put('/report-config/bogus')
      .set('Authorization', `Bearer ${token}`)
      .send({ config: { selectedColumns: [] } })
    expect(res.status).toBe(404)
  })
})