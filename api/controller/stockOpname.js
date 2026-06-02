const db = require('../../db/models')
const { Op } = require('sequelize')
const excelJS = require('exceljs')
const { createAudit } = require('../../utils/auditLog')

const generateOpnameNumber = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const timestamp = Date.now()
  return `SO-${year}${month}${day}-${timestamp}`
}

const STOCK_OPNAME_EXCEL_HEADERS = [
  { header: 'No.', key: 'no', width: 6 },
  { header: 'Kode Barang', key: 'kodeBarang', width: 15 },
  { header: 'Nama Barang', key: 'namaBarang', width: 25 },
  { header: 'Satuan', key: 'satuan', width: 10 },
  { header: 'Lokasi', key: 'lokasi', width: 20 },
  { header: 'Stok Awal', key: 'stokAwalJumlah', width: 14 },
  { header: 'Barang Masuk', key: 'barangMasukJumlah', width: 16 },
  { header: 'Barang Keluar', key: 'barangKeluarJumlah', width: 16 },
  { header: 'Stok Akhir', key: 'stokAkhirJumlah', width: 14 },
  { header: 'Stok Fisik', key: 'stokFisikJumlah', width: 14 },
  { header: 'Selisih', key: 'selisihJumlah', width: 12 },
  { header: 'Keterangan', key: 'keterangan', width: 25 }
]

const stockOpnameController = {
  async getAll(req, res) {
    try {
      const { store } = req.cookies
      const userRole = req.user?.roleType
      const { page = 1, limit = 10, status, startDate, endDate } = req.query

      const where = {}
      if (store && userRole !== 'super_admin') {
        where.store = store
      }

      if (status) {
        where.status = status
      }

      if (startDate || endDate) {
        where.date = {}
        if (startDate) where.date[Op.gte] = new Date(startDate)
        if (endDate) where.date[Op.lte] = new Date(endDate)
      }

      const offset = (parseInt(page) - 1) * parseInt(limit)

      const [opnames, total, draftCount, completedCount, cancelledCount] = await Promise.all([
        db.stockOpname.findAll({
          where,
          include: [
            { model: db.stockOpnameItem, as: 'items' },
            { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
          ],
          order: [['createdAt', 'DESC']],
          limit: parseInt(limit),
          offset
        }),
        db.stockOpname.count({ where }),
        db.stockOpname.count({ where: { ...where, status: 'draft' } }),
        db.stockOpname.count({ where: { ...where, status: 'completed' } }),
        db.stockOpname.count({ where: { ...where, status: 'cancelled' } })
      ])

      const totalItemsResult = await db.stockOpnameItem.count({
        include: [{
          model: db.stockOpname,
          as: 'parentOpname',
          where
        }]
      })

      const data = opnames.map((opname) => {
        const items = opname.items || []
        const totalItems = items.length
        const totalSelisih = items.reduce((sum, item) => sum + (item.selisihJumlah || 0), 0)
        const highVarianceItems = items.filter((item) => Math.abs(item.selisihJumlah || 0) > 0).length

        return {
          id: opname.id,
          opnameNumber: opname.opnameNumber,
          auditDate: opname.auditDate,
          auditor: opname.auditor,
          notes: opname.notes,
          status: opname.status,
          store: opname.storeData ? { id: opname.storeData.id, name: opname.storeData.name } : null,
          stats: { totalItems, totalSelisih, highVarianceItems },
           items: items.map((item) => ({
             id: item.id,
             product: item.product,
             kodeBarang: item.kodeBarang,
             namaBarang: item.namaBarang,
             satuan: item.satuan,
             lokasiId: item.lokasiId,
             stokAwalJumlah: item.stokAwalJumlah,
             barangMasukJumlah: item.barangMasukJumlah,
             barangKeluarJumlah: item.barangKeluarJumlah,
             stokAkhirJumlah: item.stokAkhirJumlah,
             stokFisikJumlah: item.stokFisikJumlah,
             selisihJumlah: item.selisihJumlah,
             keterangan: item.keterangan
           })),
          createdAt: opname.createdAt,
          updatedAt: opname.updatedAt
        }
      })

      return res.status(200).json({
        success: true,
        message: 'Success',
        data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit))
        },
        stats: {
          total,
          draft: draftCount,
          completed: completedCount,
          cancelled: cancelledCount,
          totalItems: totalItemsResult
        }
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const userRole = req.user?.roleType

      const whereClause = { id }
      if (store && userRole !== 'super_admin') {
        whereClause.store = store
      }

      const opname = await db.stockOpname.findOne({
        where: whereClause,
        include: [
          { model: db.stockOpnameItem, as: 'items' },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ]
      })

      if (!opname) {
        return res.status(404).json({
          success: false,
          message: 'Stock opname not found'
        })
      }

      const items = opname.items || []
      const totalItems = items.length
      const totalSelisih = items.reduce((sum, item) => sum + (item.selisihJumlah || 0), 0)
      const highVarianceItems = items.filter((item) => Math.abs(item.selisihJumlah || 0) > 0).length

       const data = {
         id: opname.id,
         opnameNumber: opname.opnameNumber,
         auditDate: opname.auditDate,
         auditor: opname.auditor,
         notes: opname.notes,
         status: opname.status,
         store: opname.storeData ? { id: opname.storeData.id, name: opname.storeData.name } : null,
         stats: { totalItems, totalSelisih, highVarianceItems },
         items: items.map((item) => ({
           id: item.id,
           product: item.product, // Add productId field for frontend compatibility
           kodeBarang: item.kodeBarang,
           namaBarang: item.namaBarang,
           satuan: item.satuan,
           lokasiId: item.lokasiId,
           stokAwalJumlah: item.stokAwalJumlah,
           barangMasukJumlah: item.barangMasukJumlah,
           barangKeluarJumlah: item.barangKeluarJumlah,
           stokAkhirJumlah: item.stokAkhirJumlah,
           stokFisikJumlah: item.stokFisikJumlah,
           selisihJumlah: item.selisihJumlah,
           keterangan: item.keterangan
         })),
       }

      return res.status(200).json({
        success: true,
        message: 'Success',
        data
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async create(req, res) {
    try {
      const { store } = req.cookies
      const userStore = req.user?.store
      const { items, notes, date, auditDate, auditor } = req.body
      let effectiveStore = store || userStore

      if (!effectiveStore && items && items.length > 0) {
        effectiveStore = items[0].lokasiId
      }

      if (!effectiveStore) {
        return res.status(400).json({
          success: false,
          message: 'Store tidak ditemukan. Pastikan store/lokasi sudah terdaftar.'
        })
      }

      if (!items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Items are required'
        })
      }

      const opnameNumber = generateOpnameNumber()

      const totalAdjustment = items.reduce((sum, item) => {
        return sum + (item.selisihJumlah || 0)
      }, 0)

       const opname = await db.stockOpname.create({
         store: effectiveStore,
         opnameNumber,
         date: date || new Date(),
         auditDate: auditDate || null,
         auditor: auditor || null,
         totalAdjustment,
         status: 'draft',
         notes,
         createdBy: req.user?.id || null
       })

        const opnameItems = items.map((item) => ({
          stockOpname: opname.id,
          kodeBarang: item.kodeBarang || null,
          namaBarang: item.namaBarang || null,
          satuan: item.satuan || null,
          lokasiId: item.lokasiId || null,
          lokasi: item.lokasi !== null && item.lokasi !== undefined ? String(item.lokasi) : null,
          product: item.product || item.productId || null, // Accept both product and productId for FE compatibility
          ingredientName: item.ingredientName || null,
         systemStock: item.systemStock !== undefined ? item.systemStock : (item.stokAkhirJumlah || 0),
         actualStock: item.actualStock !== undefined ? item.actualStock : (item.stokFisikJumlah || 0),
         adjustment: item.adjustment !== undefined ? item.adjustment : (item.selisihJumlah || 0),
         unit: item.unit || item.satuan || 'pcs',
         notes: item.notes || item.keterangan || null,
         stokAwalJumlah: item.stokAwalJumlah || 0,
         barangMasukJumlah: item.barangMasukJumlah || 0,
         barangKeluarJumlah: item.barangKeluarJumlah || 0,
         stokAkhirJumlah: item.stokAkhirJumlah || 0,
         stokFisikJumlah: item.stokFisikJumlah || 0,
         selisihJumlah: item.selisihJumlah || 0,
         keterangan: item.keterangan || null
       }))

       await db.stockOpnameItem.bulkCreate(opnameItems)

      const created = await db.stockOpname.findByPk(opname.id, {
        include: [{ model: db.stockOpnameItem, as: 'items' }]
      })

      await createAudit(req, 'create', 'stock_opname', created.id, 'Created stock_opname: ' + created.id)

      return res.status(201).json({
        success: true,
        message: 'Success create stock opname',
        data: created
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const userRole = req.user?.roleType
      const { items, notes, date, auditDate, auditor } = req.body

      const whereClause = { id }
      if (store && userRole !== 'super_admin') {
        whereClause.store = store
      }

      const opname = await db.stockOpname.findOne({
        where: whereClause
      })

      if (!opname) {
        return res.status(404).json({
          success: false,
          message: 'Stock opname not found'
        })
      }

      if (opname.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: `Cannot update stock opname with status "${opname.status}". Only draft can be updated.`
        })
      }

      if (items) {
        await db.sequelize.transaction(async (t) => {
          await db.stockOpnameItem.destroy({
            where: { stockOpname: id },
            transaction: t
          })

            const opnameItems = items.map((item) => ({
              stockOpname: id,
              kodeBarang: item.kodeBarang || null,
              namaBarang: item.namaBarang || null,
              satuan: item.satuan || null,
              lokasiId: item.lokasiId || null,
              lokasi: item.lokasi !== null && item.lokasi !== undefined ? String(item.lokasi) : null,
              product: item.product || item.productId || null, // Accept both product and productId for FE compatibility
              ingredientName: item.ingredientName || null,
             systemStock: item.systemStock !== undefined ? item.systemStock : (item.stokAkhirJumlah || 0),
             actualStock: item.actualStock !== undefined ? item.actualStock : (item.stokFisikJumlah || 0),
             adjustment: item.adjustment !== undefined ? item.adjustment : (item.selisihJumlah || 0),
             unit: item.unit || item.satuan || 'pcs',
             notes: item.notes || item.keterangan || null,
             stokAwalJumlah: item.stokAwalJumlah || 0,
             barangMasukJumlah: item.barangMasukJumlah || 0,
             barangKeluarJumlah: item.barangKeluarJumlah || 0,
             stokAkhirJumlah: item.stokAkhirJumlah || 0,
             stokFisikJumlah: item.stokFisikJumlah || 0,
             selisihJumlah: item.selisihJumlah || 0,
             keterangan: item.keterangan || null
           }))

          await db.stockOpnameItem.bulkCreate(opnameItems, { transaction: t })
        })
      }

      const allItems = await db.stockOpnameItem.findAll({
        where: { stockOpname: id }
      })

      const totalAdjustment = allItems.reduce((sum, item) => {
        return sum + item.selisihJumlah
      }, 0)

      await opname.update({
        totalAdjustment,
        auditDate: auditDate !== undefined ? auditDate : opname.auditDate,
        auditor: auditor !== undefined ? auditor : opname.auditor,
        notes: notes !== undefined ? notes : opname.notes,
        date: date || opname.date
      })

      const updated = await db.stockOpname.findByPk(id, {
        include: [{ model: db.stockOpnameItem, as: 'items' }]
      })

      await createAudit(req, 'update', 'stock_opname', id, 'Updated stock_opname: ' + id)

      return res.status(200).json({
        success: true,
        message: 'Success update stock opname',
        data: updated
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const { store } = req.cookies
      const userRole = req.user?.roleType

      const whereClause = { id }
      if (store && userRole !== 'super_admin') {
        whereClause.store = store
      }

      const opname = await db.stockOpname.findOne({
        where: whereClause
      })

      if (!opname) {
        return res.status(404).json({
          success: false,
          message: 'Stock opname not found'
        })
      }

      if (opname.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: `Cannot delete stock opname with status "${opname.status}". Only draft can be deleted.`
        })
      }

      await db.stockOpnameItem.destroy({
        where: { stockOpname: id }
      })

      await opname.destroy()

      await createAudit(req, 'delete', 'stock_opname', id, 'Deleted stock_opname: ' + id)

      return res.status(200).json({
        success: true,
        message: 'Success delete stock opname'
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async changeStatus(req, res) {
    try {
      const { id } = req.params
      const { status } = req.body
      const { store } = req.cookies
      const userRole = req.user?.roleType

      if (!['completed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be "completed" or "cancelled"'
        })
      }

      const whereClause = { id }
      if (store && userRole !== 'super_admin') {
        whereClause.store = store
      }

      const opname = await db.stockOpname.findOne({ where: whereClause })

      if (!opname) {
        return res.status(404).json({
          success: false,
          message: 'Stock opname not found'
        })
      }

      if (opname.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message: `Cannot change status from "${opname.status}". Only draft can be changed.`
        })
      }

      await opname.update({
        status,
        modifiedBy: req.user?.id || null
      })

      await createAudit(req, 'update', 'stock_opname', id, 'Updated stock_opname status to ' + status + ': ' + id)

      if (status === 'completed') {
        const updated = await db.stockOpname.findByPk(id, {
          include: [{ model: db.stockOpnameItem, as: 'items' }]
        })

        for (const item of updated.items) {
          const product = await db.product.findOne({
            where: {
              nameProduct: { [Op.iLike]: item.namaBarang.trim() }
            }
          })
          if (product && item.stokFisikJumlah !== null && item.stokFisikJumlah !== undefined) {
            const oldStock = Number(product.stock) || 0
            const newStock = Number(item.stokFisikJumlah) || 0
            const diff = newStock - oldStock

            await product.update({ stock: newStock })

            await db.stock_history.create({
              product: product.id,
              store: opname.store,
              referenceType: 'opname',
              quantityBefore: oldStock,
              quantityChange: diff,
              quantityAfter: newStock,
              unit: item.unit || 'pcs',
              notes: `Stock opname: ${item.namaBarang} (${item.keterangan || ''})`,
              createdBy: req.user?.id || null
            })
          }
        }

        const updatedWithItems = await db.stockOpname.findByPk(id, {
          include: [{ model: db.stockOpnameItem, as: 'items' }]
        })

        return res.status(200).json({
          success: true,
          message: `Status changed to "${status}"`,
          data: updatedWithItems
        })
      }

      const updated = await db.stockOpname.findByPk(id)
      return res.status(200).json({
        success: true,
        message: `Status changed to "${status}"`,
        data: updated
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async downloadExcel(req, res) {
    try {
      const { store } = req.cookies
      const userRole = req.user?.roleType

      const locationWhere = { status: true }
      if (store && userRole !== 'super_admin') {
        locationWhere.store = store
      }

      const locations = await db.location.findAll({
        where: locationWhere,
        attributes: ['id', 'name']
      })

      const workbook = new excelJS.Workbook()
      const worksheet = workbook.addWorksheet('Stock Opname')

      worksheet.columns = STOCK_OPNAME_EXCEL_HEADERS.map((h) => ({
        header: h.header,
        key: h.key,
        width: h.width
      }))

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4472C4' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25

      headerRow.eachCell((cell) => {
        cell.protection = { locked: true }
      })

      const locationList = locations.map((l) => l.name).join(',')
      const maxRows = 100

      for (let row = 2; row <= maxRows; row++) {
        worksheet.getCell(`A${row}`).value = row - 1
        worksheet.getCell(`A${row}`).protection = { locked: true }

        const inputCols = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'L']
        inputCols.forEach((col) => {
          worksheet.getCell(`${col}${row}`).protection = { locked: false }
        })

        const formulaStyle = {
          fill: {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF3F3F3' }
          }
        }

        worksheet.getCell(`I${row}`).value = {
          formula: `F${row}+G${row}-H${row}`
        }
        worksheet.getCell(`I${row}`).protection = { locked: true }
        worksheet.getCell(`I${row}`).numFmt = '#,##0'
        worksheet.getCell(`I${row}`).fill = formulaStyle.fill

        worksheet.getCell(`K${row}`).value = { formula: `J${row}-I${row}` }
        worksheet.getCell(`K${row}`).protection = { locked: true }
        worksheet.getCell(`K${row}`).numFmt = '#,##0'
        worksheet.getCell(`K${row}`).fill = formulaStyle.fill

        if (locationList) {
          worksheet.getCell(`E${row}`).dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [`"${locationList}"`],
            showDropDown: true
          }
        }
      }

      worksheet.protect('', {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        insertHyperlinks: false,
        deleteColumns: false,
        deleteRows: false,
        sort: false,
        autoFilter: false,
        pivotTables: false
      })

      const buffer = await workbook.xlsx.writeBuffer()

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=stock-opname-template.xlsx'
      )

      return res.send(buffer)
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async uploadExcel(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Tidak ada file yang diupload'
        })
      }

      const workbook = new excelJS.Workbook()
      await workbook.xlsx.load(req.file.buffer)

      const worksheet = workbook.getWorksheet('Stock Opname')
      if (!worksheet) {
        return res.status(400).json({
          success: false,
          message: 'Sheet "Stock Opname" tidak ditemukan'
        })
      }

      const headers = []
      worksheet.getRow(1).eachCell((cell) => {
        headers.push(cell.value ? cell.value.toString().trim() : '')
      })

      const EXPECTED = [
        'No.', 'Kode Barang', 'Nama Barang', 'Satuan', 'Lokasi',
        'Stok Awal', 'Barang Masuk', 'Barang Keluar', 'Stok Akhir',
        'Stok Fisik', 'Selisih', 'Keterangan'
      ]

      const isValid = EXPECTED.every((h, i) => headers[i] === h)
      if (!isValid) {
        return res.status(400).json({
          success: false,
          message: 'Header tidak valid. Pastikan menggunakan template yang benar'
        })
      }

      const items = []
      const errors = []
      const itemLokasiNames = new Set()

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber < 2) return
        const v = row.values
        if (!v[3]) return

        const lokasi = v[5] ? String(v[5]).trim() : null
        if (lokasi) itemLokasiNames.add(lokasi)
      })

      let effectiveStore = req.cookies?.store || req.user?.store

      if (!effectiveStore && itemLokasiNames.size > 0) {
        const firstLokasi = [...itemLokasiNames][0]
        const location = await db.location.findOne({
          where: { name: firstLokasi }
        })
        if (location) effectiveStore = location.id
      }

      if (!effectiveStore) {
        const firstLocation = await db.location.findOne({ where: { status: true } })
        if (firstLocation) effectiveStore = firstLocation.id
      }

      if (!effectiveStore) {
        return res.status(400).json({
          success: false,
          message: 'Tidak dapat menentukan store/lokasi. Pastikan lokasi sudah terdaftar.'
        })
      }

      const locationMap = {}
      const allLocations = await db.location.findAll({ attributes: ['id', 'name'] })
      allLocations.forEach((loc) => {
        locationMap[loc.name.toLowerCase().trim()] = loc.id
      })

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber < 2) return
        const v = row.values
        if (!v[3]) return

        const kodeBarang = v[2] ? String(v[2]).trim() : null
        const namaBarang = v[3] ? String(v[3]).trim() : null
        const satuan = v[4] ? String(v[4]).trim() : null
        const lokasiName = v[5] ? String(v[5]).trim() : null
        const stokAwal = parseFloat(v[6]) || 0
        const barangMasuk = parseFloat(v[7]) || 0
        const barangKeluar = parseFloat(v[8]) || 0
        const stokAkhir = parseFloat(v[9])
        const stokAkhirVal = !isNaN(stokAkhir) ? stokAkhir : (stokAwal + barangMasuk - barangKeluar)
        const stokFisik = parseFloat(v[10]) || 0
        const selisih = parseFloat(v[11])
        const selisihVal = !isNaN(selisih) ? selisih : (stokFisik - stokAkhirVal)
        const keterangan = v[12] ? String(v[12]).trim() : null

        if (!namaBarang) {
          errors.push(`Baris ${rowNumber}: Nama barang wajib diisi`)
          return
        }

        const lokasiId = lokasiName ? (locationMap[lokasiName.toLowerCase().trim()] || null) : null

        items.push({
          kodeBarang,
          namaBarang,
          satuan: satuan || 'pcs',
          lokasiId,
          lokasi: lokasiName,
          stokAwalJumlah: stokAwal,
          barangMasukJumlah: barangMasuk,
          barangKeluarJumlah: barangKeluar,
          stokAkhirJumlah: stokAkhirVal,
          stokFisikJumlah: stokFisik,
          selisihJumlah: selisihVal,
          keterangan,
          systemStock: stokAkhirVal,
          actualStock: stokFisik,
          adjustment: selisihVal,
          unit: satuan || 'pcs',
          notes: keterangan
        })
      })

      if (errors.length > 0) {
        return res.status(400).json({ success: false, message: 'Terdapat kesalahan', errors })
      }

      if (items.length === 0) {
        return res.status(400).json({ success: false, message: 'Tidak ada data yang valid untuk diupload' })
      }

      const opnameNumber = generateOpnameNumber()
      const totalAdjustment = items.reduce((sum, i) => sum + i.selisihJumlah, 0)

      const result = await db.sequelize.transaction(async (t) => {
        const opname = await db.stockOpname.create({
          store: effectiveStore,
          opnameNumber,
          date: req.body.date ? new Date(req.body.date) : new Date(),
          auditDate: req.body.auditDate || null,
          auditor: req.body.auditor || req.user?.userName || req.user?.id || null,
          totalAdjustment,
          status: 'draft',
          notes: req.body.notes || 'Upload dari Excel',
          createdBy: req.user?.id || null
        }, { transaction: t })

        const opnameItems = items.map((item) => ({
          stockOpname: opname.id,
          ...item
        }))

        await db.stockOpnameItem.bulkCreate(opnameItems, { transaction: t })

        return db.stockOpname.findByPk(opname.id, {
          include: [{ model: db.stockOpnameItem, as: 'items' }],
          transaction: t
        })
      })

      await createAudit(req, 'import', 'stock_opname', null, 'Imported stock_opname from file')

      return res.status(201).json({
        success: true,
        message: `Berhasil upload ${items.length} item stock opname`,
        data: result
      })
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async exportSelected(req, res) {
    try {
      const { ids } = req.body

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'ids harus berupa array dan tidak boleh kosong'
        })
      }

      const opnames = await db.stockOpname.findAll({
        where: { id: { [Op.in]: ids } },
        include: [
          { model: db.stockOpnameItem, as: 'items' },
          { model: db.location, as: 'storeData', attributes: ['id', 'name'] }
        ],
        order: [['createdAt', 'DESC']]
      })

      if (opnames.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Stock opname tidak ditemukan'
        })
      }

      const workbook = new excelJS.Workbook()
      const worksheet = workbook.addWorksheet('Stock Opname')

      worksheet.columns = STOCK_OPNAME_EXCEL_HEADERS.map((h) => ({
        header: h.header,
        key: h.key,
        width: h.width
      }))

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' } }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4472C4' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25

      let rowIndex = 2

      for (const opname of opnames) {
        const storeName = opname.storeData ? opname.storeData.name : '-'
        worksheet.mergeCells(`A${rowIndex}:L${rowIndex}`)
        const titleCell = worksheet.getCell(`A${rowIndex}`)
        titleCell.value = `${opname.opnameNumber} - ${storeName} (${opname.status})`
        titleCell.font = { bold: true, size: 12 }
        titleCell.alignment = { vertical: 'middle' }
        worksheet.getRow(rowIndex).height = 22
        rowIndex++

        worksheet.mergeCells(`A${rowIndex}:L${rowIndex}`)
        const dateCell = worksheet.getCell(`A${rowIndex}`)
        dateCell.value = `Audit: ${opname.auditDate || '-'} | Auditor: ${opname.auditor || '-'} | Notes: ${opname.notes || '-'}`
        dateCell.font = { italic: true, size: 10, color: { argb: '666666' } }
        worksheet.getRow(rowIndex).height = 18
        rowIndex++

        const items = opname.items || []
        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          worksheet.getCell(`A${rowIndex}`).value = i + 1
          worksheet.getCell(`B${rowIndex}`).value = item.kodeBarang || ''
          worksheet.getCell(`C${rowIndex}`).value = item.namaBarang || ''
          worksheet.getCell(`D${rowIndex}`).value = item.satuan || ''
          worksheet.getCell(`E${rowIndex}`).value = item.lokasi || ''
          worksheet.getCell(`F${rowIndex}`).value = item.stokAwalJumlah ?? 0
          worksheet.getCell(`G${rowIndex}`).value = item.barangMasukJumlah ?? 0
          worksheet.getCell(`H${rowIndex}`).value = item.barangKeluarJumlah ?? 0
          worksheet.getCell(`I${rowIndex}`).value = item.stokAkhirJumlah ?? 0
          worksheet.getCell(`J${rowIndex}`).value = item.stokFisikJumlah ?? 0
          worksheet.getCell(`K${rowIndex}`).value = item.selisihJumlah ?? 0
          worksheet.getCell(`L${rowIndex}`).value = item.keterangan || ''
          rowIndex++
        }

        rowIndex++
      }

      worksheet.columns.forEach((col) => {
        col.width = col.width || 12
      })

      const buffer = await workbook.xlsx.writeBuffer()

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      )
      res.setHeader(
        'Content-Disposition',
        'attachment; filename=stock-opname-export-selected.xlsx'
      )

      return res.send(buffer)
    } catch (error) {
      console.error(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }
}

module.exports = stockOpnameController
