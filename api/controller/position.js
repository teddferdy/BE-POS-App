const db = require('../../db/models')
const { Op } = db.Sequelize
const Position = db.position

const positionInclude = [
  {
    model: db.department,
    as: 'departmentData',
    attributes: ['id', 'name']
  }
]

exports.getAllPosition = async (req, res) => {
  try {
    const getAllPosition = await Position.findAll({
      where: { status: true },
      include: positionInclude
    }).then((res) =>
      res.map((items) => {
        const getData = { ...items.dataValues }
        return getData
      })
    )

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: getAllPosition?.length > 0 ? getAllPosition : []
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getAllPositionInTable = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all', search = '' } = req.query
    const offset = (page - 1) * limit

    let whereCondition = {}
    if (status === 'true') {
      whereCondition = { status: true }
    } else if (status === 'false') {
      whereCondition = { status: false }
    }

    if (search) {
      whereCondition = {
        ...whereCondition,
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
          { '$departmentData.name$': { [Op.iLike]: `%${search}%` } }
        ]
      }
    }

    const { rows: getAllPosition, count: totalItems } =
      await Position.findAndCountAll({
        where: whereCondition,
        include: positionInclude,
        offset: parseInt(offset),
        limit: parseInt(limit)
      })

    const totalPages = Math.ceil(totalItems / limit)

    let statsWhere = {}
    if (status === 'true') {
      statsWhere = { status: true }
    } else if (status === 'false') {
      statsWhere = { status: false }
    }

    const totalPositions = await Position.count({ where: statsWhere })

    const totalDepartemenResult = await Position.findAll({
      attributes: [
        [
          db.Sequelize.fn('DISTINCT', db.Sequelize.col('departmentId')),
          'departmentId'
        ]
      ],
      where: {
        departmentId: { [Op.ne]: null },
        ...statsWhere
      },
      raw: true
    })
    const totalDepartemenAktif = totalDepartemenResult.length

    const totalTanpaDeskripsi = await Position.count({
      where: {
        [Op.or]: [{ description: null }, { description: '' }],
        ...statsWhere
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: getAllPosition?.length > 0 ? getAllPosition : [],
      pagination: {
        totalItems,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      },
      stats: {
        totalPositions,
        totalDepartemenAktif,
        totalTanpaDeskripsi
      }
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.addNewPosition = async (req, res) => {
  const body = req.body

  try {
    const findOnePosition = await Position?.findOne({
      where: { name: body?.name }
    })

    if (!findOnePosition?.getDataValue) {
      const creadtedPosition = await Position.create({
        name: body.name,
        departmentId: body.departmentId,
        description: body.description,
        status: body.status,
        store: body.store || req.user?.store,
        createdBy: body.createdBy
      })

      if (creadtedPosition.getDataValue) {
        return res.status(200).json({
          success: true,
          message: 'Position Berhasil Di Buat'
        })
      }
    }
    return res.status(403).json({
      success: false,
      message: 'Position Sudah Terdaftar'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editPositionById = async (req, res) => {
  const body = req.body
  const id = req.params.id || body.id

  try {
    const getDuplicate = await Position.findOne({
      where: {
        name: body.name,
        id: { [Op.ne]: id }
      }
    })

    if (!getDuplicate?.dataValues) {
    const editPosition = await Position?.update(
      {
        name: body.name,
        departmentId: body.departmentId,
        description: body.description,
        status: body.status,
        store: body.store || req.user?.store,
        modifiedBy: body?.modifiedBy
      },
      {
        returning: true,
        where: { id }
      }
    ).then(([_, data]) => {
      return data
    })

      return res.status(200).json({
        success: true,
        message: 'Sukses Ubah Position',
        data: editPosition?.dataValues
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Position Sudah Tersedia'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deletePositionById = async (req, res) => {
  const body = req.body

  try {
    const getId = await Position.destroy({
      where: {
        id: body.id,
        name: body.name
      },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        success: true,
        message: 'Success Hapus Position'
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Hapus Position Gagal'
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}
const buildPositionTemplateWorksheet = (workbook, sheetName, positions, departments) => {
  const worksheet = workbook.addWorksheet(sheetName)

  const HEADERS = [
    { key: 'no', header: 'No.', width: 8 },
    { key: 'name', header: 'Nama Jabatan (Wajib)', width: 30 },
    { key: 'department', header: 'Departemen', width: 30 },
    { key: 'description', header: 'Deskripsi Jabatan', width: 35 },
    { key: 'status', header: 'Status (Aktif/Nonaktif)', width: 25 }
  ]

  worksheet.columns = HEADERS.map((h) => ({
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
  headerRow.alignment = { horizontal: 'center' }
  headerRow.height = 25

  const departmentDropdownList = departments
    .map((d) => `${d.id}.${d.name}`)
    .join(',')

  const maxRows = Math.max(positions.length + 2, 99999, departments.length + 2)
  for (let row = 2; row <= maxRows; row++) {
    const idx = row - 2
    const item = positions[idx]

    worksheet.getCell(`A${row}`).value = idx + 1
    worksheet.getCell(`A${row}`).protection = { locked: true }

    if (item) {
      worksheet.getCell(`B${row}`).value = item.name
      worksheet.getCell(`C${row}`).value =
        item.departmentData
          ? `${item.departmentData.id}.${item.departmentData.name}`
          : ''
      worksheet.getCell(`D${row}`).value = item.description || ''
      worksheet.getCell(`E${row}`).value = item.status ? 'Aktif' : 'Nonaktif'
    }

    worksheet.getCell(`B${row}`).protection = { locked: false }
    worksheet.getCell(`C${row}`).protection = { locked: false }
    worksheet.getCell(`D${row}`).protection = { locked: false }
    worksheet.getCell(`E${row}`).protection = { locked: false }

    worksheet.getCell(`C${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${departmentDropdownList}"`],
      showDropDown: true
    }
    worksheet.getCell(`E${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['"Aktif,Nonaktif"'],
      showDropDown: true
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
}

const buildPositionExportWorksheet = (workbook, sheetName, positions) => {
  const worksheet = workbook.addWorksheet(sheetName)

  const HEADERS = [
    { key: 'no', header: 'No.', width: 8 },
    { key: 'id', header: 'ID', width: 15 },
    { key: 'name', header: 'Nama Jabatan', width: 30 },
    { key: 'department', header: 'Departemen', width: 30 },
    { key: 'description', header: 'Deskripsi Jabatan', width: 35 },
    { key: 'status', header: 'Status (Aktif/Nonaktif)', width: 25 }
  ]

  worksheet.columns = HEADERS.map((h) => ({
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
  headerRow.alignment = { horizontal: 'center' }
  headerRow.height = 25

  positions.forEach((pos, index) => {
    const rowNum = index + 2
    worksheet.getCell(`A${rowNum}`).value = index + 1
    worksheet.getCell(`B${rowNum}`).value = pos.id
    worksheet.getCell(`C${rowNum}`).value = pos.name
    worksheet.getCell(`D${rowNum}`).value =
      pos.departmentData
        ? `${pos.departmentData.id}.${pos.departmentData.name}`
        : ''
    worksheet.getCell(`E${rowNum}`).value = pos.description || ''
    worksheet.getCell(`F${rowNum}`).value = pos.status ? 'Aktif' : 'Nonaktif'
  })

  worksheet.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true
  })
}

// Download position Excel template
exports.downloadTemplate = async (req, res) => {
  try {
    const excelJS = require('exceljs')

    const departments = await db.department.findAll({
      where: { status: true },
      attributes: ['id', 'name']
    })

    const positions = await Position.findAll({
      include: [
        {
          model: db.department,
          as: 'departmentData',
          attributes: ['id', 'name']
        }
      ],
      order: [['id', 'ASC']]
    })

    const workbook = new excelJS.Workbook()
    buildPositionTemplateWorksheet(workbook, 'Jabatan', positions, departments)

    const data = await workbook.xlsx.writeBuffer()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=template-jabatan.xlsx')
    res.send(data)
  } catch (error) {
    console.error('Error downloading template =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Download position data as Excel
exports.downloadData = async (req, res) => {
  try {
    const excelJS = require('exceljs')

    const { status = 'all' } = req.query

    let whereCondition = {}
    if (status === 'true') {
      whereCondition = { status: true }
    } else if (status === 'false') {
      whereCondition = { status: false }
    }

    const positions = await Position.findAll({
      where: whereCondition,
      include: [
        {
          model: db.department,
          as: 'departmentData',
          attributes: ['id', 'name']
        }
      ],
      order: [['id', 'ASC']]
    })

    const workbook = new excelJS.Workbook()
    buildPositionExportWorksheet(workbook, 'Jabatan', positions)

    const data = await workbook.xlsx.writeBuffer()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=jabatan-data.xlsx')
    res.send(data)
  } catch (error) {
    console.error('Error downloading data =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Upload position Excel
exports.uploadExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada file yang diupload'
      })
    }

    const excelJS = require('exceljs')

    const workbook = new excelJS.Workbook()
    await workbook.xlsx.load(req.file.buffer)

    const worksheet = workbook.getWorksheet('Jabatan')
    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: 'Sheet "Jabatan" tidak ditemukan'
      })
    }

    // Validate headers
    const headers = []
    worksheet.getRow(1).eachCell((cell) => {
      headers.push(cell.value ? cell.value.toString().trim() : '')
    })

    const EXPECTED_HEADERS = [
      'No.',
      'Nama Jabatan (Wajib)',
      'Departemen',
      'Deskripsi Jabatan',
      'Status (Aktif/Nonaktif)'
    ]

    const isValid = EXPECTED_HEADERS.every((expected, index) => {
      return headers[index] === expected
    })

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Header template tidak valid. Pastikan menggunakan template yang benar'
      })
    }

    // Get departments for mapping
    const departments = await db.department.findAll({
      attributes: ['id', 'name']
    })
    const departmentMap = {}
    departments.forEach((d) => { departmentMap[d.name.toLowerCase().trim()] = d.id })
    departments.forEach((d) => { departmentMap[`${d.id}.${d.name}`.toLowerCase().trim()] = d.id })
    departments.forEach((d) => { departmentMap[d.id.toString()] = d.id })

    // Process rows
    const positionsToCreate = []
    const errors = []

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 2) {
        const rowData = row.values

        if (!rowData[2]) {
          return
        }

        const name = rowData[2] ? String(rowData[2]).trim() : null
        const departmentInput = rowData[3] ? String(rowData[3]).trim() : null
        const description = rowData[4] ? String(rowData[4]).trim() : null
        const statusInput = rowData[5] ? String(rowData[5]).trim() : null

        if (!name) {
          errors.push(`Baris ${rowNumber}: Nama jabatan wajib diisi`)
          return
        }

        let departmentId = null
        if (departmentInput) {
          const lowerDept = departmentInput.toLowerCase().trim()
          if (departmentMap[lowerDept]) {
            departmentId = departmentMap[lowerDept]
          } else {
            errors.push(`Baris ${rowNumber}: Departemen "${departmentInput}" tidak ditemukan`)
            return
          }
        } else {
          errors.push(`Baris ${rowNumber}: Departemen wajib diisi`)
          return
        }

        let status = null
        if (statusInput) {
          const lowerStatus = statusInput.toLowerCase().trim()
          if (lowerStatus === 'aktif' || lowerStatus === 'active' || lowerStatus === 'true') {
            status = true
          } else if (lowerStatus === 'nonaktif' || lowerStatus === 'non-active' || lowerStatus === 'nonactive' || lowerStatus === 'false') {
            status = false
          } else {
            errors.push(`Baris ${rowNumber}: Status "${statusInput}" tidak valid. Gunakan Aktif/Nonaktif`)
            return
          }
        } else {
          status = true
        }

        positionsToCreate.push({
          name,
          departmentId,
          description: description || null,
          status
        })
      }
    })

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Terdapat kesalahan pada data',
        errors
      })
    }

    // Check for duplicate names in upload
    const uploadNames = positionsToCreate.map((p) => p.name.toLowerCase().trim())
    const duplicateNames = uploadNames.filter((name, index, arr) => arr.indexOf(name) !== index)

    if (duplicateNames.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Jabatan berikut duplikat dalam file upload: ${[...new Set(duplicateNames)].join(', ')}`
      })
    }

    // Process creations
    const createdPositions = []
    for (const posData of positionsToCreate) {
      try {
        const existing = await Position.findOne({ where: { name: posData.name } })
        if (!existing) {
          const pos = await Position.create(posData)
          createdPositions.push(pos)
        }
      } catch (error) {
        console.error('Error creating position =>', error)
      }
    }

    return res.status(200).json({
      success: true,
      message: `Berhasil memproses ${createdPositions.length} jabatan baru`,
      data: { created: createdPositions.length, errors: errors.length }
    })
  } catch (error) {
    console.error('Error processing upload =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}
