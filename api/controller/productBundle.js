const db = require('../../db/models')
const { Op } = require('sequelize')
const { createAudit } = require('../../utils/auditLog')

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

const bundleController = {
  async getAll(req, res) {
    try {
      const userRole = req.user?.roleType
      const effectiveStore =
        userRole === 'super_admin'
          ? req.storeId || req.query.store || req.cookies.store
          : req.storeId || req.cookies.store
      const { status, search, page = 1, limit = 10 } = req.query

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
        order: [['createdAt', 'DESC']],
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

      return res.status(200).json({ message: 'success', data: bundle })
    } catch (error) {
      console.error('Bundle getById error:', error)
      return res.status(500).json({ message: error.message })
    }
  },

  async create(req, res) {
    try {
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
        maxQuantity
      } = req.body

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

      const bundle = await db.product_bundle.create({
        store: req.storeId || req.cookies.store || null,
        name,
        sku,
        description,
        image,
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
        'product_bundle',
        bundle.id,
        'CREATE',
        null,
        result.toJSON(),
        req
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
        maxQuantity
      } = req.body

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

      await bundle.update({
        name: name || bundle.name,
        description:
          description !== undefined ? description : bundle.description,
        image: image !== undefined ? image : bundle.image,
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
          maxQuantity !== undefined ? maxQuantity : bundle.maxQuantity
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
        'product_bundle',
        bundle.id,
        'UPDATE',
        oldData,
        result.toJSON(),
        req
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
        'product_bundle',
        bundle.id,
        'DELETE',
        oldData,
        null,
        req
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
      const { status } = req.body

      const bundle = await db.product_bundle.findByPk(id)
      if (!bundle) {
        return res.status(404).json({ message: 'Bundle tidak ditemukan' })
      }

      const oldData = bundle.toJSON()

      await bundle.update({ status })

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
        'product_bundle',
        bundle.id,
        'STATUS_CHANGE',
        oldData,
        result.toJSON(),
        req
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
