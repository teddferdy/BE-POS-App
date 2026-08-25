const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')
const { uploadToCloudinaryWithDedup } = require('../../utils/cloudinaryStorage')

// ponytail: FE bisa kirim JSON langsung atau FormData (image + data JSON) —
// sama seperti pola location add/edit
const parseBundleBody = (req) => {
  let body = req.body || {}
  if (body.data) {
    try {
      body = typeof body.data === 'string' ? JSON.parse(body.data) : body.data
    } catch {
      return null
    }
  }
  return body
}

const generateBundleSku = (prefix = 'BNDL') => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `${prefix}-${year}${month}${day}-${random}`
}

// ponytail: bundle yang sudah lewat validUntil otomatis non-aktif —
// dipanggil lazy di getAll/getById, pola sama seperti discount.
// Kasir juga tetap aman karena query di product.js sudah filter validUntil.
const expireStaleBundles = async (extraWhere = {}) => {
  try {
    await db.product_bundle.update(
      { status: 'inactive' },
      {
        where: {
          ...extraWhere,
          status: 'active',
          validUntil: {
            [Op.and]: [{ [Op.ne]: null }, { [Op.lt]: new Date() }]
          }
        }
      }
    )
  } catch (e) {
    console.error('Expire stale bundles error:', e.message)
  }
}

// ponytail: hitung jumlah transaksi (distinct order) yang memakai bundle —
// order cancelled/void tidak dihitung agar pencatatan akurat
const countBundleUsage = async (bundleId) => {
  try {
    const rows = await db.sequelize.query(
      `SELECT COUNT(DISTINCT oi."order") AS count
       FROM order_item oi
       JOIN "order" o ON o.id = oi."order"
       WHERE oi."bundleId" = :bundleId
         AND oi."deletedAt" IS NULL
         AND o."deletedAt" IS NULL
         AND o."status" NOT IN ('cancelled', 'void')`,
      {
        replacements: { bundleId: Number(bundleId) },
        type: db.sequelize.QueryTypes.SELECT
      }
    )
    return Number(rows?.[0]?.count || 0)
  } catch (e) {
    console.error('Count bundle usage error:', e.message)
    return 0
  }
}

const bundleController = {
  async getAll(req, res) {
    try {
      const userRole = req.user?.roleType
      const effectiveStore =
        userRole === 'super_admin'
          ? req.storeId || req.query.store || req.cookies.store
          : req.storeId || req.cookies.store
      const { status, search, page = 1, limit = 10 } = req.query

      // ponytail: expire dulu supaya stats & list akurat
      await expireStaleBundles(
        effectiveStore ? { store: effectiveStore } : {}
      )

      const where = {}
      if (effectiveStore) where.store = effectiveStore
      if (status) where.status = status
      if (search) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${search}%` } },
          { sku: { [Op.iLike]: `%${search}%` } }
        ]
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const statsWhere = effectiveStore ? { store: effectiveStore } : {}
      const [activeCount, draftCount, inactiveCount] = await Promise.all([
        db.product_bundle.count({ where: { ...statsWhere, status: 'active' } }),
        db.product_bundle.count({ where: { ...statsWhere, status: 'draft' } }),
        db.product_bundle.count({
          where: { ...statsWhere, status: 'inactive' }
        })
      ])

      const stats = {
        active: activeCount,
        draft: draftCount,
        inactive: inactiveCount,
        total: activeCount + draftCount + inactiveCount
      }

      const { count, rows } = await db.product_bundle.findAndCountAll({
        where,
        include: [
          {
            model: db.product_bundle_item,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: ['id', 'nameProduct', 'price', 'image', 'stock']
              }
            ]
          }
        ],
        order: [['updatedAt', 'DESC']],
        limit: parseInt(limit),
        offset
      })

      return res.status(200).json({
        message: 'success',
        data: {
          items: rows,
          total: count,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit))
          },
          stats
        }
      })
    } catch (error) {
      console.error('Bundle getAll error:', error)
      return res.status(500).json({ message: error.message })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params

      await expireStaleBundles()

      const bundle = await db.product_bundle.findByPk(id, {
        include: [
          {
            model: db.product_bundle_item,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: [
                  'id',
                  'nameProduct',
                  'price',
                  'image',
                  'stock',
                  'unit'
                ]
              }
            ]
          }
        ]
      })

      if (!bundle) {
        return res.status(404).json({ message: 'Bundle tidak ditemukan' })
      }

      // ponytail: jumlah transaksi yang memakai bundle ini (untuk detail page)
      const usageCount = await countBundleUsage(id)
      const data = bundle.toJSON()
      data.usageCount = usageCount

      return res.status(200).json({ message: 'success', data })
    } catch (error) {
      console.error('Bundle getById error:', error)
      return res.status(500).json({ message: error.message })
    }
  },

  async create(req, res) {
    try {
      const body = parseBundleBody(req)
      if (!body) {
        return res.status(400).json({ message: 'Invalid JSON format in data field' })
      }
      const {
        name,
        description,
        image,
        bundlePrice,
        items,
        isAvailable,
        status,
        validFrom,
        validUntil,
        minQuantity,
        maxQuantity,
        store
      } = body

      if (!items || items.length === 0) {
        return res
          .status(400)
          .json({ message: 'Minimal harus ada 1 item dalam bundle' })
      }

      const sku = generateBundleSku()

      let originalPrice = 0
      for (const item of items) {
        const product = await db.product.findByPk(item.product)
        if (!product) {
          return res
            .status(400)
            .json({ message: `Produk ID ${item.product} tidak ditemukan` })
        }
        const itemPrice = item.unitPrice || product.price
        originalPrice += itemPrice * (item.quantity || 1)
      }

      const discountAmount = originalPrice - (bundlePrice || 0)
      const discountPercentage =
        originalPrice > 0
          ? ((discountAmount / originalPrice) * 100).toFixed(2)
          : 0

      const effectiveStore =
        store !== undefined ? store : req.storeId || req.cookies.store || null

      let imageUrl = image || null
      if (req.file) {
        const { url } = await uploadToCloudinaryWithDedup(
          req.file.path,
          'pos-app-bundles'
        )
        imageUrl = url
      }

      const bundle = await db.product_bundle.create({
        store: effectiveStore,
        name,
        sku,
        description,
        image: imageUrl,
        bundlePrice: bundlePrice || 0,
        originalPrice,
        discountAmount: Math.max(discountAmount, 0),
        discountPercentage: parseFloat(discountPercentage),
        isAvailable: isAvailable !== undefined ? isAvailable : true,
        status: status || 'draft',
        validFrom: validFrom || null,
        validUntil: validUntil || null,
        minQuantity: minQuantity || 1,
        maxQuantity: maxQuantity || null
      })

      for (const item of items) {
        const product = await db.product.findByPk(item.product)
        const itemPrice = item.unitPrice || product.price
        await db.product_bundle_item.create({
          bundleId: bundle.id,
          product: item.product,
          quantity: item.quantity || 1,
          unitPrice: itemPrice,
          isOptional: item.isOptional || false
        })
      }

      const result = await db.product_bundle.findByPk(bundle.id, {
        include: [
          {
            model: db.product_bundle_item,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: ['id', 'nameProduct', 'price', 'image', 'stock']
              }
            ]
          }
        ]
      })

      await createAudit(
        req,
        'CREATE',
        'product_bundle',
        bundle.id,
        'Created bundle: ' + bundle.name,
        null,
        result.toJSON()
      )

      return res
        .status(201)
        .json({ message: 'Bundle berhasil dibuat', data: result })
    } catch (error) {
      console.error('Bundle create error:', error)
      return res.status(500).json({ message: error.message })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const bundle = await db.product_bundle.findByPk(id, {
        include: [{ model: db.product_bundle_item, as: 'items' }]
      })

      if (!bundle) {
        return res.status(404).json({ message: 'Bundle tidak ditemukan' })
      }

      const oldData = bundle.toJSON()

      const body = parseBundleBody(req)
      if (!body) {
        return res.status(400).json({ message: 'Invalid JSON format in data field' })
      }
      const {
        name,
        description,
        image,
        bundlePrice,
        items,
        isAvailable,
        status,
        validFrom,
        validUntil,
        minQuantity,
        maxQuantity,
        store
      } = body

      let originalPrice = 0
      if (items && items.length > 0) {
        await db.product_bundle_item.destroy({ where: { bundleId: bundle.id } })

        for (const item of items) {
          const product = await db.product.findByPk(item.product)
          if (!product) {
            return res
              .status(400)
              .json({ message: `Produk ID ${item.product} tidak ditemukan` })
          }
          const itemPrice = item.unitPrice || product.price
          originalPrice += itemPrice * (item.quantity || 1)

          await db.product_bundle_item.create({
            bundleId: bundle.id,
            product: item.product,
            quantity: item.quantity || 1,
            unitPrice: itemPrice,
            isOptional: item.isOptional || false
          })
        }
      } else {
        const existingItems = await db.product_bundle_item.findAll({
          where: { bundleId: bundle.id }
        })
        for (const item of existingItems) {
          originalPrice += item.unitPrice * item.quantity
        }
      }

      const finalBundlePrice =
        bundlePrice !== undefined ? bundlePrice : bundle.bundlePrice
      const discountAmount = originalPrice - finalBundlePrice
      const discountPercentage =
        originalPrice > 0
          ? ((discountAmount / originalPrice) * 100).toFixed(2)
          : 0

      let imageUrl = image !== undefined ? image : bundle.image
      if (req.file) {
        const { url } = await uploadToCloudinaryWithDedup(
          req.file.path,
          'pos-app-bundles'
        )
        imageUrl = url
      }

      await bundle.update({
        name: name || bundle.name,
        description:
          description !== undefined ? description : bundle.description,
        image: imageUrl,
        bundlePrice: finalBundlePrice,
        originalPrice,
        discountAmount: Math.max(discountAmount, 0),
        discountPercentage: parseFloat(discountPercentage),
        isAvailable:
          isAvailable !== undefined ? isAvailable : bundle.isAvailable,
        status: status || bundle.status,
        validFrom: validFrom !== undefined ? validFrom : bundle.validFrom,
        validUntil: validUntil !== undefined ? validUntil : bundle.validUntil,
        minQuantity:
          minQuantity !== undefined ? minQuantity : bundle.minQuantity,
        maxQuantity:
          maxQuantity !== undefined ? maxQuantity : bundle.maxQuantity,
        store: store !== undefined ? store : bundle.store
      })

      const result = await db.product_bundle.findByPk(bundle.id, {
        include: [
          {
            model: db.product_bundle_item,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: ['id', 'nameProduct', 'price', 'image', 'stock']
              }
            ]
          }
        ]
      })

      await createAudit(
        req,
        'UPDATE',
        'product_bundle',
        bundle.id,
        'Updated bundle: ' + bundle.name,
        oldData,
        result.toJSON()
      )

      return res
        .status(200)
        .json({ message: 'Bundle berhasil diupdate', data: result })
    } catch (error) {
      console.error('Bundle update error:', error)
      return res.status(500).json({ message: error.message })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const bundle = await db.product_bundle.findByPk(id)

      if (!bundle) {
        return res.status(404).json({ message: 'Bundle tidak ditemukan' })
      }

      const oldData = bundle.toJSON()

      await db.product_bundle_item.destroy({ where: { bundleId: bundle.id } })
      await bundle.destroy()

      await createAudit(
        req,
        'DELETE',
        'product_bundle',
        bundle.id,
        'Deleted bundle: ' + oldData.name,
        oldData,
        null
      )

      return res.status(200).json({ message: 'Bundle berhasil dihapus' })
    } catch (error) {
      console.error('Bundle delete error:', error)
      return res.status(500).json({ message: error.message })
    }
  },

  async changeStatus(req, res) {
    try {
      const { id } = req.params
      const { status, validFrom, validUntil } = req.body

      const bundle = await db.product_bundle.findByPk(id)
      if (!bundle) {
        return res.status(404).json({ message: 'Bundle tidak ditemukan' })
      }

      // ponytail: FE bisa ikut mengirim masa berlaku baru saat aktivasi
      const updates = {}
      for (const [key, raw] of [
        ['validFrom', validFrom],
        ['validUntil', validUntil]
      ]) {
        if (raw === undefined) continue
        if (raw === null || raw === '') {
          updates[key] = null
          continue
        }
        const d = new Date(raw)
        if (isNaN(d.getTime())) {
          return res
            .status(400)
            .json({ message: `${key === 'validFrom' ? 'Tanggal mulai' : 'Tanggal berakhir'} tidak valid` })
        }
        updates[key] = d
      }

      const effectiveFrom =
        updates.validFrom !== undefined ? updates.validFrom : bundle.validFrom
      const effectiveUntil =
        updates.validUntil !== undefined ? updates.validUntil : bundle.validUntil

      // ponytail: bundle yang validUntil-nya sudah lewat tidak boleh
      // diaktifkan — nanti langsung di-auto-expire lagi di list berikutnya
      if (
        status === 'active' &&
        effectiveUntil &&
        new Date(effectiveUntil) < new Date()
      ) {
        return res.status(400).json({
          message:
            'Tanggal berakhir bundle sudah lewat. Perbarui masa berlaku sebelum mengaktifkan.'
        })
      }

      if (
        effectiveFrom &&
        effectiveUntil &&
        new Date(effectiveUntil) < new Date(effectiveFrom)
      ) {
        return res.status(400).json({
          message: 'Tanggal berakhir harus setelah tanggal mulai'
        })
      }

      const oldData = bundle.toJSON()

      await bundle.update({ status, ...updates })

      const result = await db.product_bundle.findByPk(id, {
        include: [
          {
            model: db.product_bundle_item,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: ['id', 'nameProduct', 'price', 'image', 'stock']
              }
            ]
          }
        ]
      })

      await createAudit(
        req,
        'STATUS_CHANGE',
        'product_bundle',
        bundle.id,
        'Changed bundle status: ' + bundle.name,
        oldData,
        result.toJSON()
      )

      return res
        .status(200)
        .json({ message: 'Status bundle berhasil diubah', data: result })
    } catch (error) {
      console.error('Bundle changeStatus error:', error)
      return res.status(500).json({ message: error.message })
    }
  }
}

module.exports = bundleController
