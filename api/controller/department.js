const db = require('../../db/models')
const { Op } = db.Sequelize
const Department = db.department

exports.getAllDepartment = async (req, res) => {
  try {
    const getAllDepartment = await Department.findAll({
      where: { status: true }
    }).then((res) =>
      res.map((items) => {
        const getData = { ...items.dataValues }
        return getData
      })
    )

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: getAllDepartment?.length > 0 ? getAllDepartment : []
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getAllDepartmentInTable = async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'all' } = req.query
    const offset = (page - 1) * limit

    let whereCondition = {}
    if (status === 'true') {
      whereCondition = { status: true }
    } else if (status === 'false') {
      whereCondition = { status: false }
    }

    const { rows: getAllDepartment, count: totalItems } =
      await Department.findAndCountAll({
        where: whereCondition,
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

    const totalDepartemen = await Department.count({ where: statsWhere })

    const totalDepartemenAktif = await Department.count({
      where: { status: true, ...statsWhere }
    })

    const totalDepartemenNonActive = await Department.count({
      where: { status: false, ...statsWhere }
    })

    const totalTanpaDeskripsi = await Department.count({
      where: {
        [Op.or]: [{ description: null }, { description: '' }],
        ...statsWhere
      }
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      data: getAllDepartment?.length > 0 ? getAllDepartment : [],
      pagination: {
        totalItems,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      },
      stats: {
        totalDepartemen,
        totalDepartemenAktif,
        totalDepartemenNonActive,
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

exports.addNewDepartment = async (req, res) => {
  const body = req.body

  try {
    const findOneDepartment = await Department?.findOne({
      where: { name: body?.name }
    })

    if (!findOneDepartment?.getDataValue) {
      const creadtedDepartment = await Department.create({
        name: body.name,
        description: body.description,
        status: body.status !== undefined ? body.status : body.isActive,
        createdBy: body.createdBy
      })

      if (creadtedDepartment.getDataValue) {
        return res.status(200).json({
          success: true,
          message: 'Department Berhasil Di Buat'
        })
      }
    }
    return res.status(403).json({
      success: false,
      message: 'Department Sudah Terdaftar'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editDepartmentById = async (req, res) => {
  const body = req.body
  const id = req.params.id || body.id

  try {
    const getDuplicate = await Department.findOne({
      where: {
        name: body.name,
        id: { [db.Sequelize.Op.ne]: id }
      }
    })

    if (!getDuplicate?.dataValues) {
      const department = await Department.findByPk(id)
      if (!department) {
        return res.status(404).json({
          success: false,
          message: 'Department Tidak Ditemukan'
        })
      }

      const editDepartment = await Department?.update(
        {
          name: body.name,
          description: body.description,
          status: body.status !== undefined ? body.status : body.isActive,
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
        message: 'Sukses Ubah Department',
        data: editDepartment?.dataValues
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Department Sudah Tersedia'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteDepartmentById = async (req, res) => {
  const id = req.params.id

  try {
    const getId = await Department.destroy({
      where: { id },
      force: true
    })

    if (getId) {
      return res.status(200).json({
        success: true,
        message: 'Success Hapus Department'
      })
    }
    return res.status(404).json({
      success: false,
      message: 'Department Tidak Ditemukan'
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

const buildDepartmentTemplateWorksheet = (workbook, sheetName, data) => {
  const worksheet = workbook.addWorksheet(sheetName)

  const HEADERS = [
    { key: 'no', header: 'No.', width: 8 },
    { key: 'name', header: 'Nama Departemen (Wajib)', width: 25 },
    { key: 'description', header: 'Deskripsi', width: 30 },
    { key: 'status', header: 'Status (Aktif/Nonaktif)', width: 25 }
  ]

  worksheet.columns = HEADERS.map(h => ({
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

  const maxRows = data.length + 1
  for (let row = 2; row <= maxRows; row++) {
    const idx = row - 2
    const item = data[idx]

    worksheet.getCell(`A${row}`).value = idx + 1
    worksheet.getCell(`A${row}`).protection = { locked: true }

    if (item) {
      worksheet.getCell(`B${row}`).value = item.name
      worksheet.getCell(`C${row}`).value = item.description || ''
      worksheet.getCell(`D${row}`).value = item.status ? 'Aktif' : 'Nonaktif'
    }

    worksheet.getCell(`B${row}`).protection = { locked: false }
    worksheet.getCell(`C${row}`).protection = { locked: false }
    worksheet.getCell(`D${row}`).protection = { locked: false }

    worksheet.getCell(`D${row}`).dataValidation = {
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

  return worksheet
}

const buildDepartmentExportWorksheet = (workbook, sheetName, data) => {
  const worksheet = workbook.addWorksheet(sheetName)

  const HEADERS = [
    { key: 'no', header: 'No.', width: 8 },
    { key: 'id', header: 'ID', width: 15 },
    { key: 'name', header: 'Nama Departemen', width: 25 },
    { key: 'description', header: 'Deskripsi', width: 30 },
    { key: 'status', header: 'Status', width: 20 }
  ]

  worksheet.columns = HEADERS.map(h => ({
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

  data.forEach((item, index) => {
    const rowNum = index + 2
    worksheet.getCell(`A${rowNum}`).value = index + 1
    worksheet.getCell(`B${rowNum}`).value = item.id
    worksheet.getCell(`C${rowNum}`).value = item.name
    worksheet.getCell(`D${rowNum}`).value = item.description || ''
    worksheet.getCell(`E${rowNum}`).value = item.status ? 'Aktif' : 'Nonaktif'
  })

  worksheet.protect('', {
    selectLockedCells: true,
    selectUnlockedCells: true
  })

  return worksheet
}

// Excel Template Download
exports.downloadTemplate = async (req, res) => {
  try {
    const excelJS = require('exceljs')

    const departments = await Department.findAll({
      attributes: ['name', 'description', 'status'],
      order: [['id', 'ASC']]
    })

    const workbook = new excelJS.Workbook()
    buildDepartmentTemplateWorksheet(workbook, 'Departemen', departments)

    const data = await workbook.xlsx.writeBuffer()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=template-departemen.xlsx')
    res.send(data)
  } catch (error) {
    console.error('Error downloading template =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Excel Data Download
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

    const departments = await Department.findAll({
      where: whereCondition,
      attributes: ['id', 'name', 'description', 'status'],
      order: [['id', 'ASC']]
    })

    const workbook = new excelJS.Workbook()
    buildDepartmentExportWorksheet(workbook, 'Departemen', departments)

    const data = await workbook.xlsx.writeBuffer()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename=departemen-data.xlsx')
    res.send(data)
  } catch (error) {
    console.error('Error downloading data =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Excel Upload
const excelJS = require('exceljs')

exports.uploadExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Tidak ada file yang diupload'
      })
    }

    const workbook = new excelJS.Workbook()
    await workbook.xlsx.load(req.file.buffer)
    
    const worksheet = workbook.getWorksheet('Departemen')
    if (!worksheet) {
      return res.status(400).json({
        success: false,
        message: 'Sheet "Departemen" tidak ditemukan'
      })
    }

    // Validate headers
    const headers = []
    worksheet.getRow(1).eachCell((cell) => {
      headers.push(cell.value ? cell.value.toString().trim() : '')
    })

    const EXPECTED_HEADERS = [
      'No.',
      'Nama Departemen (Wajib)',
      'Deskripsi',
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

    // Process data rows
    const departmentsToCreate = []
    const errors = []

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 2) {
        const rowData = row.values

        if (!rowData[2]) {
          return
        }

        const name = rowData[2] ? String(rowData[2]).trim() : null
        const description = rowData[3] ? String(rowData[3]).trim() : null
        const statusInput = rowData[4] ? String(rowData[4]).trim() : null

        if (!name) {
          errors.push(`Baris ${rowNumber}: Nama departemen wajib diisi`)
          return
        }

        let status = true
        if (statusInput) {
          const lower = statusInput.toLowerCase().trim()
          if (lower === 'nonaktif' || lower === 'non-active' || lower === 'nonactive' || lower === 'false') {
            status = false
          }
        }

        departmentsToCreate.push({ name, description: description || null, status })
      }
    })

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Terdapat kesalahan pada data',
        errors
      })
    }

    // Check for duplicates in the upload data
    const uploadNames = departmentsToCreate.map(dept => dept.name.toLowerCase().trim())
    const duplicateNames = uploadNames.filter((n, i, a) => a.indexOf(n) !== i)

    if (duplicateNames.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Departemen berikut duplikat dalam file upload: ${[...new Set(duplicateNames)].join(', ')}`
      })
    }

    // Process creations
    const createdDepartments = []
    for (const deptData of departmentsToCreate) {
      try {
        const existing = await Department.findOne({ where: { name: deptData.name } })
        if (!existing) {
          const dept = await Department.create(deptData)
          createdDepartments.push(dept)
        }
      } catch (error) {
        console.error('Error creating department =>', error)
      }
    }

    return res.status(200).json({
      success: true,
      message: `Berhasil memproses ${createdDepartments.length} departemen baru`,
      data: { created: createdDepartments.length, errors: errors.length }
    })

  } catch (error) {
    console.error('Error processing upload =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}
