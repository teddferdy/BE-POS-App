const db = require('../../db/models')
const Product = db.product
const Category = db.category
const StockHistory = db.stock_history
const excelJS = require('exceljs')
const fs = require('fs')
const { Op } = require('sequelize')
const {
  uploadToCloudinary,
  deleteFromCloudinary
} = require('../../utils/cloudinaryStorage')
const { createNotification } = require('../../utils/createNotification')
const { createAudit } = require('../../utils/auditLog')
const {
  downloadProductTemplate,
  parseProductTemplate
} = require('../../utils/excelTemplate')

exports.getProductByLocationSuperAdmin = async (req, res) => {
  try {
    const getAllProduct = await Product.findAll({
      where: {
        status: 'active'
      }
    }).then((res) =>
      res.map((items) => {
        const getData = {
          ...items.dataValues
        }
        return getData
      })
    )

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: getAllProduct?.length > 0 ? getAllProduct : []
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Get All In Cashier List
exports.getAllProduct = async (req, res) => {
  const { nameProduct, category } = req.query

  try {
    const { store } = req.cookies
    const userRole = req.user?.roleType
    const filters = {}

    // Store filtering - only for non-super-admin
    if (store && userRole !== 'super_admin') {
      filters.store = store
    }

    if (nameProduct) {
      filters.nameProduct = {
        [Op.like]: `${nameProduct}%`
      }
    }

    if (Number(category)) {
      filters.category = Number(category)
    }

    filters.status = 'active'

    const getAllProduct = await Product.findAll({
      where: filters,
      include: [
        { model: Category, as: 'categoryData', attributes: ['value', 'name'] }
      ]
    })

    const resolvedCategories = getAllProduct.map((items) => ({
      id: items.id,
      productId: items.id,
      nameProduct: items.nameProduct,
      barcode: items.barcode,
      unit: items.unit,
      stock: items.stock,
      minStock: items.minStock,
      price: items.price,
      costPrice: items.costPrice,
      category: items.category,
      nameCategory: items.categoryData
        ? items.categoryData.value || items.categoryData.name
        : null,
      ...items.dataValues
    }))

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: resolvedCategories.length > 0 ? resolvedCategories : []
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Get All In Table
exports.getAllProductInTable = async (req, res) => {
  const { page = 1, pageSize = 10, status = 'all' } = req.query

  try {
    const offset = (page - 1) * pageSize

    let statusCondition = {}
    if (status === 'active' || status === 'true') {
      statusCondition = { status: 'active' }
    } else if (status === 'inactive' || status === 'false') {
      statusCondition = { status: 'inactive' }
    }

    const whereCondition = {
      ...statusCondition
    }

    const getAllProduct = await Product.findAll({
      where: whereCondition,
      limit: parseInt(pageSize),
      offset: parseInt(offset),
      include: [{ model: Category, as: 'categoryData', attributes: ['name'] }]
    })

    const resolvedCategories = getAllProduct.map((items) => ({
      ...items.dataValues,
      nameCategory: items.categoryData ? items.categoryData.name : null
    }))

    const totalProducts = await Product.count({
      where: whereCondition
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: resolvedCategories.length > 0 ? resolvedCategories : [],
      pagination: {
        currentPage: parseInt(page),
        pageSize: parseInt(pageSize),
        totalItems: totalProducts,
        totalPages: Math.ceil(totalProducts / pageSize)
      }
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    })
  }
}

// Function Post Add Form Product
exports.postAddProduct = async (req, res) => {
  const {
    nameProduct,
    category,
    status,
    description,
    price,
    costPrice,
    stock,
    minStock,
    unit,
    baseUnit,
    conversionFactor,
    point,
    barcode,
    brand,
    hasModifiers,
    modifiers,
    isOption,
    options,
    isAvailable,
    createdBy,
    image,
    stores,
    supplier,
    tax,
    priceTiers,
    currencyId,
    currencyCode,
    tipeProduk,
    composition
  } = req.body

  const normalizeStatus = (val) => {
    if (typeof val === 'boolean') return val ? 'active' : 'inactive'
    if (val === 'active' || val === 'inactive') return val
    return 'active'
  }
  const toIntOrNull = (val) => {
    if (val === '' || val === null || val === undefined) return null
    const n = Number(val)
    return Number.isNaN(n) ? null : n
  }
  const toJsonOrNull = (val) => {
    if (val === '' || val === null || val === undefined) return null
    if (typeof val === 'string') {
      try {
        return JSON.parse(val)
      } catch {
        return null
      }
    }
    return val
  }

  try {
    const existingProduct = await Product.findOne({
      where: {
        nameProduct
      }
    })

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product with this name already exists.'
      })
    }

    if (!nameProduct) {
      return res.status(400).json({
        success: false,
        message: 'nameProduct is required'
      })
    }

    const imageFile = req.file
    let imageUrl = null

    if (imageFile) {
      imageUrl = await uploadToCloudinary(imageFile.path, 'pos-app-products')
    }

    let parsedStores = []
    if (stores) {
      try {
        parsedStores = JSON.parse(stores)
      } catch (e) {
        parsedStores = []
      }
    }

    let parsedPriceTiers = []
    const normalizedCategory = toIntOrNull(category)
    if (normalizedCategory === null) {
      return res.status(400).json({
        success: false,
        message: 'category is required and must be a valid ID'
      })
    }
    const normalizedSupplier = toIntOrNull(supplier)
    const normalizedTax = toJsonOrNull(tax)

    const postData = await Product.create({
      nameProduct,
      category: normalizedCategory,
      description,
      price,
      costPrice,
      stock,
      minStock,
      unit,
      baseUnit: baseUnit || unit || 'pcs',
      conversionFactor: conversionFactor != null ? conversionFactor : 1,
      point: point || 0,
      redeemPoints: redeemPoints || 0,
      barcode: barcode || null,
      brand: brand || null,
      hasModifiers,
      modifiers: hasModifiers
        ? typeof modifiers === 'string'
          ? JSON.parse(modifiers)
          : modifiers
        : [],
      isOption,
      options: isOption
        ? typeof options === 'string'
          ? JSON.parse(options)
          : options
        : [],
      isAvailable,
      status: normalizeStatus(status),
      createdBy,
      tipeProduk,
      image: imageUrl || image,
      store: parsedStores,
      supplier: normalizedSupplier,
      tax: normalizedTax,
      priceTiers: parsedPriceTiers,
      currencyId: currencyId || null,
      currencyCode: currencyCode || null,
      composition: composition || []
    })

    const sku = `PRD-${String(postData.id).padStart(5, '0')}`
    await Product.update({ sku }, { where: { id: postData.id } })
    postData.sku = sku

    const initialStock = Number(stock) || 0
    if (initialStock > 0) {
      await StockHistory.create({
        product: postData.id,
        referenceType: 'adjustment',
        quantityBefore: 0,
        quantityChange: initialStock,
        quantityAfter: initialStock,
        unit: unit || 'pcs',
        notes: 'Initial stock',
        createdBy
      })
    }

    createNotification({
      type: 'product_created',
      store: parsedStores?.[0] || req.user?.store,
      referenceId: postData.id,
      referenceType: 'product',
      params: [nameProduct],
      createdBy: req.user?.fullName || 'System'
    }).catch(console.error)
    createAudit(
      req,
      'create',
      'product',
      postData.id,
      `Created product: ${postData.nameProduct}`
    )

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: postData
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    })
  }
}

// Render Edit Form Product
exports.editProductByLocationAndId = async (req, res) => {
  const {
    id,
    nameProduct,
    category,
    status,
    description,
    price,
    costPrice,
    stock,
    minStock,
    unit,
    baseUnit,
    conversionFactor,
    point,
    barcode,
    brand,
    hasModifiers,
    modifiers,
    isOption,
    options,
    isAvailable,
    image: newImage,
    stores,
    supplier,
    tax,
    priceTiers,
    currencyId,
    currencyCode,
    tipeProduk,
    composition
  } = req.body

  const normalizeStatus = (val) => {
    if (typeof val === 'boolean') return val ? 'active' : 'inactive'
    if (val === 'active' || val === 'inactive') return val
    return 'active'
  }
  const toIntOrNull = (val) => {
    if (val === '' || val === null || val === undefined) return null
    const n = Number(val)
    return Number.isNaN(n) ? null : n
  }
  const toJsonOrNull = (val) => {
    if (val === '' || val === null || val === undefined) return null
    if (typeof val === 'string') {
      try {
        return JSON.parse(val)
      } catch {
        return null
      }
    }
    return val
  }

  try {
    const getAllProductByIdAndLocation = await Product.findOne({
      where: {
        id: id
      }
    })

    if (!getAllProductByIdAndLocation) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      })
    }

    const oldImage = getAllProductByIdAndLocation.image
    let imageUrl = oldImage

    if (req.file) {
      if (oldImage) {
        await deleteFromCloudinary(oldImage)
      }

      imageUrl = await uploadToCloudinary(req.file.path, 'pos-app-products')
    }

    let parsedStores = []
    if (stores) {
      try {
        parsedStores = JSON.parse(stores)
      } catch (e) {
        parsedStores = []
      }
    }

    let parsedPriceTiers = []
    if (priceTiers) {
      try {
        parsedPriceTiers =
          typeof priceTiers === 'string' ? JSON.parse(priceTiers) : priceTiers
      } catch (e) {
        parsedPriceTiers = []
      }
    }

    const reqBody = {
      nameProduct,
      image: imageUrl,
      category: category !== undefined ? toIntOrNull(category) : undefined,
      description,
      price,
      costPrice,
      stock,
      minStock,
      unit,
      baseUnit: baseUnit !== undefined ? baseUnit : getAllProductByIdAndLocation.baseUnit,
      conversionFactor: conversionFactor != null ? conversionFactor : getAllProductByIdAndLocation.conversionFactor,
      point: point || 0,
      redeemPoints: redeemPoints || 0,
      barcode: barcode || null,
      brand: brand || null,
      hasModifiers,
      modifiers: hasModifiers
        ? typeof modifiers === 'string'
          ? JSON.parse(modifiers)
          : modifiers
        : [],
      isOption,
      options: isOption
        ? typeof options === 'string'
          ? JSON.parse(options)
          : options
        : [],
      isAvailable,
      status: status !== undefined ? normalizeStatus(status) : undefined,
      store: parsedStores,
      supplier: toIntOrNull(supplier),
      tax: toJsonOrNull(tax),
      priceTiers: parsedPriceTiers,
      currencyId: currencyId || null,
      currencyCode: currencyCode || null,
      tipeProduk,
      composition: composition || []
    }

    const oldStock = Number(getAllProductByIdAndLocation.stock) || 0
    const newStock = Number(reqBody.stock) || 0
    const stockDiff = newStock - oldStock

    const [_, editRows] = await Product.update(reqBody, {
      returning: true,
      where: {
        id: id
      }
    })
    const editLocation = editRows[0]

    if (stockDiff !== 0) {
      await StockHistory.create({
        product: id,
        referenceType: 'adjustment',
        quantityBefore: oldStock,
        quantityChange: stockDiff,
        quantityAfter: newStock,
        unit: reqBody.unit || 'pcs',
        notes:
          stockDiff > 0
            ? 'Stock adjustment: added'
            : 'Stock adjustment: reduced',
        createdBy: req.body.createdBy
      })
    }

    createNotification({
      type: 'product_updated',
      store: getAllProductByIdAndLocation.store?.[0] || req.user?.store,
      referenceId: id,
      referenceType: 'product',
      params: [nameProduct],
      createdBy: req.user?.fullName || 'System'
    }).catch(console.error)
    createAudit(req, 'update', 'product', id, `Updated product: ${nameProduct}`)

    return res.status(200).json({
      success: true,
      message: 'Sukses Ubah Product',
      data: editLocation?.dataValues
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteProductByIdAndLocation = async (req, res) => {
  const { id } = req.body
  try {
    const product = await Product.findByPk(id)

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      })
    }

    await Product.destroy({
      where: { id }
    })

    createNotification({
      type: 'product_deleted',
      store: product.store?.[0] || req.user?.store,
      referenceId: id,
      referenceType: 'product',
      params: [product.nameProduct || 'Unknown'],
      createdBy: req.user?.fullName || 'System'
    }).catch(console.error)
    createAudit(
      req,
      'delete',
      'product',
      id,
      `Deleted product: ${product.nameProduct}`
    )

    return res.status(200).json({
      success: true,
      message: 'Success Hapus Product'
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Download Excel Template By Excel with dropdown list of categories by storeId
exports.exportProduct = async (req, res) => {
  const { storeId } = req.params

  const workbook = new excelJS.Workbook()
  const worksheet = workbook.addWorksheet('Product')

  worksheet.columns = [
    { header: 'No.', key: 's_no', width: 10 },
    { header: 'Name Product', key: 'nameProduct', width: 20 },
    { header: 'Image', key: 'image', width: 20 },
    { header: 'Name', key: 'name', width: 20 },
    { header: 'Description', key: 'description', width: 20 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Price', key: 'price', width: 20 }
  ]

  worksheet.getRow(1).font = { bold: true }

  try {
    const categories = await Category.findAll({
      where: { store: storeId },
      attributes: ['name']
    })

    if (!categories.length) {
      return res
        .status(404)
        .json({ success: false, message: 'No categories found for this store' })
    }

    const categoryList = categories.map((cat) => cat.name).join(',')

    worksheet.getCell('F2').dataValidation = {
      type: 'list',
      allowBlank: true,
      formula1: `"${categoryList}"`,
      showDropDown: true
    }

    const buffer = await workbook.xlsx.writeBuffer()

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=product_template.xlsx'
    )

    res.send(buffer)
  } catch (err) {
    console.error('Error exporting product Excel file: ', err)
    res.status(500).send({
      success: false,
      message: 'Something went wrong while generating the Excel file',
      error: err.message
    })
  }
}

// Download Product Data as Excel
exports.downloadData = async (req, res) => {
  const store = req.cookies.store || req.query.store

  const workbook = new excelJS.Workbook()
  const worksheet = workbook.addWorksheet('Products')

  worksheet.columns = [
    { header: 'No', key: 'no', width: 5 },
    { header: 'Nama Produk', key: 'nameProduct', width: 25 },
    { header: 'Kategori', key: 'category', width: 20 },
    { header: 'Harga', key: 'price', width: 15 },
    { header: 'Stok', key: 'stock', width: 10 },
    { header: 'Status', key: 'status', width: 10 }
  ]

  try {
    const where = store ? { store } : {}
    const products = await Product.findAll({
      where,
      include: [{ model: Category, as: 'categoryData', attributes: ['name'] }]
    })

    products.forEach((p, i) => {
      worksheet.addRow({
        no: i + 1,
        nameProduct: p.nameProduct,
        category: p.categoryData?.name || '',
        price: p.price,
        stock: p.stock || 0,
        status: p.status === 'active' ? 'Aktif' : 'Nonaktif'
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=products_${Date.now()}.xlsx`
    )
    res.send(buffer)
  } catch (err) {
    console.error('Error downloading products:', err)
    res.status(500).json({
      success: false,
      message: 'Gagal mengunduh produk',
      error: err.message
    })
  }
}

// Download Product Template
exports.downloadTemplate = async (req, res) => {
  try {
    const categories = await Category.findAll({
      attributes: ['name']
    })

    if (!categories.length) {
      return res.status(404).json({
        success: false,
        message: 'Tidak ada kategori. Silakan buat kategori terlebih dahulu.'
      })
    }

    const Supplier = db.supplier
    const TaxConfig = db.taxConfig

    const [existingProducts, suppliers, taxConfigs] = await Promise.all([
      Product.findAll({
        include: [
          { model: Category, as: 'categoryData', attributes: ['name'] }
        ]
      }),
      Supplier.findAll({ attributes: ['id', 'name'], where: { status: 'active' } }),
      TaxConfig.findAll({ attributes: ['id', 'name', 'rate'], where: { status: 'active' } })
    ])

    const supplierMap = {}
    suppliers.forEach(s => { supplierMap[s.id] = s.name })
    const taxMap = {}
    taxConfigs.forEach(t => { taxMap[t.id] = `${t.name} (${t.rate}%)` })

    const productsWithData = existingProducts.map((p) => {
      let taxName = ''
      if (p.tax) {
        const taxData = typeof p.tax === 'string' ? JSON.parse(p.tax) : p.tax
        taxName = taxData?.name ? `${taxData.name} (${taxData.rate}%)` : (taxMap[p.tax] || '')
      }
      return {
        nameProduct: p.nameProduct,
        sku: p.sku || '',
        barcode: p.barcode || '',
        brand: p.brand || '',
        description: p.description || '',
        categoryName: p.categoryData?.name || '',
        tipeProduk: p.tipeProduk || 'menu',
        unit: p.unit || 'pcs',
        baseUnit: p.baseUnit || 'pcs',
        conversionFactor: p.conversionFactor || 1,
        supplierName: supplierMap[p.supplier] || '',
        taxName,
        price: p.price || 0,
        costPrice: p.costPrice || 0,
        stock: p.stock || 0,
        minStock: p.minStock || 0,
        point: p.point || 0,
        redeemPoints: p.redeemPoints || 0,
        status: p.status,
        isAvailable: p.isAvailable,
        isOption: p.isOption,
        options: p.options || []
      }
    })

    const buffer = await downloadProductTemplate({
      categories,
      existingProducts: productsWithData,
      suppliers,
      taxConfigs
    })

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=template_produk.xlsx'
    )

    res.send(buffer)
  } catch (err) {
    console.error('Error downloading template:', err)
    res.status(500).json({
      success: false,
      message: 'Gagal mengunduh template',
      error: err.message
    })
  }
}

// Import Product from Excel Template
exports.importProduct = async (req, res) => {
  const excelFile = req.files?.['file']?.[0]
  if (!excelFile) {
    return res.status(400).json({
      success: false,
      message: 'File Excel diperlukan'
    })
  }

  try {
    const excelBuffer = fs.readFileSync(excelFile.path)
    const products = await parseProductTemplate(excelBuffer)

    if (!products.length) {
      return res.status(400).json({
        success: false,
        message: 'Data produk tidak ditemukan di file Excel'
      })
    }

    const imageFiles = req.files?.['images'] || []
    const imageMap = {}
    imageFiles.forEach((file) => {
      const baseName = file.originalname.replace(/\.[^/.]+$/, '').toLowerCase()
      imageMap[baseName] = file.path
    })

    const Supplier = db.supplier
    const TaxConfig = db.taxConfig

    const [categories, suppliers, taxConfigs] = await Promise.all([
      Category.findAll({ attributes: ['id', 'name'] }),
      Supplier.findAll({ attributes: ['id', 'name'] }),
      TaxConfig.findAll({ attributes: ['id', 'name', 'rate'] })
    ])

    const categoryMap = categories.reduce((acc, cat) => {
      acc[cat.name.toLowerCase()] = cat.id
      return acc
    }, {})
    const supplierMap = suppliers.reduce((acc, s) => {
      acc[s.name.toLowerCase()] = s.id
      return acc
    }, {})
    const taxMap = taxConfigs.reduce((acc, t) => {
      const label = `${t.name} (${t.rate}%)`.toLowerCase()
      acc[label] = { id: t.id, name: t.name, rate: t.rate }
      return acc
    }, {})

    const parseOptions = (val) => {
      if (!val) return []
      try {
        const parsed = JSON.parse(val)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return val.split(',').map(s => s.trim()).filter(Boolean)
      }
    }

    const results = { created: [], updated: [], errors: [] }

    for (const product of products) {
      try {
        if (!product.nameProduct) {
          results.errors.push({ no: product.no, message: 'Nama produk kosong' })
          continue
        }

        const categoryId = product.category
          ? categoryMap[product.category.toLowerCase()]
          : null
        if (!categoryId && product.category) {
          results.errors.push({ no: product.no, message: `Kategori "${product.category}" tidak ditemukan` })
          continue
        }

        const supplierId = product.supplier
          ? (supplierMap[product.supplier.toLowerCase()] || null)
          : null
        const taxData = product.tax
          ? (taxMap[product.tax.toLowerCase()] || null)
          : null

        const statusValue = String(product.status).toLowerCase() === 'aktif' ? 'active' : 'inactive'
        const isOptionValue = String(product.isOption).toLowerCase() === 'ya'
        const isAvailableValue = String(product.isAvailable).toLowerCase() === 'ya'

        const productData = {
          nameProduct: product.nameProduct,
          sku: product.sku || null,
          barcode: product.barcode || null,
          brand: product.brand || null,
          description: product.description || null,
          category: categoryId,
          tipeProduk: product.tipeProduk || 'menu',
          unit: product.unit || 'pcs',
          baseUnit: product.baseUnit || 'pcs',
          conversionFactor: product.conversionFactor || 1,
          supplier: supplierId,
          tax: taxData ? JSON.stringify(taxData) : null,
          price: product.price || 0,
          costPrice: product.costPrice || 0,
          stock: product.stock || 0,
          minStock: product.minStock || 0,
          point: product.point || 0,
          redeemPoints: product.redeemPoints || 0,
          status: statusValue,
          isAvailable: isAvailableValue,
          isOption: isOptionValue,
          options: parseOptions(product.options)
        }

        const productFileName = product.nameProduct.toLowerCase().replace(/\s+/g, '-')
        let imageUrl = null
        if (imageMap[productFileName]) {
          imageUrl = await uploadToCloudinary(imageMap[productFileName], 'pos-app-products')
        }

        const newProduct = await Product.create({
          ...productData,
          image: imageUrl || null
        })

        if (productData.stock > 0) {
          await StockHistory.create({
            product: newProduct.id,
            type: 'in',
            quantity: productData.stock,
            note: 'Initial stock from import',
            createdBy: req.user?.id || null
          })
        }

        results.created.push({ id: newProduct.id, nameProduct: newProduct.nameProduct })
      } catch (err) {
        results.errors.push({ no: product.no, message: err.message })
      }
    }

    createAudit(req, 'import', 'product', null, `Imported ${results.created.length} products`)

    res.status(200).json({
      success: true,
      message: `Berhasil import ${results.created.length} produk`,
      data: results
    })
  } catch (err) {
    console.error('Error importing products:', err)
    res.status(500).json({
      success: false,
      message: 'Gagal mengimport produk',
      error: err.message
    })
  }
}

exports.getProductById = async (req, res) => {
  try {
    const id = req.params.id || req.query.id

    const product = await Product.findByPk(id, {
      include: [
        { model: Category, as: 'categoryData', attributes: ['id', 'name'] }
      ]
    })

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      })
    }

    const data = product.toJSON()
    if (typeof data.options === 'string') {
      try {
        data.options = JSON.parse(data.options)
      } catch {
        data.options = []
      }
    }
    if (typeof data.modifiers === 'string') {
      try {
        data.modifiers = JSON.parse(data.modifiers)
      } catch {
        data.modifiers = []
      }
    }
    if (typeof data.priceTiers === 'string') {
      try {
        data.priceTiers = JSON.parse(data.priceTiers)
      } catch {
        data.priceTiers = []
      }
    }
    if (typeof data.store === 'string') {
      try {
        data.store = JSON.parse(data.store)
      } catch {
        data.store = []
      }
    }
    if (typeof data.composition === 'string') {
      try {
        data.composition = JSON.parse(data.composition)
      } catch {
        data.composition = []
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Success',
      data
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    })
  }
}
