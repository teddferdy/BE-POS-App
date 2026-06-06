const db = require('../../db/models')
const Discount = db.discount
const ExcelJS = require('exceljs')
const { createAudit } = require('../../utils/auditLog')

exports.getAllDiscountByLocationAndActive = async (req, res) => {
  const store = req.query.store || req.user?.store
  const { page = 1, size = 10 } = req.query
  const limit = parseInt(size)
  const offset = (parseInt(page) - 1) * limit

  try {
    const { count, rows: subCategory } = await Discount.findAndCountAll({
      where: {
        ...(store ? { store } : {}),
        status: 'active'
      },
      limit: limit,
      offset: offset
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data:
        subCategory?.length > 0
          ? subCategory?.map((items) => {
              return {
                ...items?.dataValues
              }
            })
          : []
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.getAllDiscount = async (req, res) => {
  const store = req.query.store || req.user?.store
  const { page = 1, size = 10, status } = req.query
  const limit = parseInt(size)
  const offset = (parseInt(page) - 1) * limit

  try {
    const whereCondition = {}
    if (store) whereCondition.store = store
    if (status !== undefined && status !== 'all') whereCondition.status = status === 'true' || status === 'active' ? 'active' : 'inactive'

    const { count, rows } = await Discount.findAndCountAll({
      where: whereCondition,
      limit,
      offset
    })

    return res.status(200).json({
      success: true,
      message: 'Success',
      totalItems: count,
      totalPages: Math.ceil(count / limit),
      currentPage: parseInt(page),
      data: rows.map((items) => items.dataValues)
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

// Download Template - Super Admin only
exports.downloadTemplate = async (req, res) => {
  try {
    // Generate template Excel file
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Discount Template');
    
    // Add headers
    worksheet.addRow([
      'Name',
      'Type (Percentage/Nominal)',
      'Value',
      'Start Date (YYYY-MM-DD)',
      'End Date (YYYY-MM-DD, optional)',
      'Minimum Purchase',
      'Description',
      'Is Active (true/false)'
    ]);
    
    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Set column widths
    worksheet.columns = [
      { width: 20 }, // Name
      { width: 20 }, // Type
      { width: 15 }, // Value
      { width: 15 }, // Start Date
      { width: 15 }, // End Date
      { width: 20 }, // Minimum Purchase
      { width: 30 }, // Description
      { width: 15 }  // Is Active
    ];
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=discount-template.xlsx'
    );
    
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Error =>', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    });
  }
};

// Download Excel Data - Super Admin only
exports.downloadData = async (req, res) => {
  try {
    const { store } = req.query;
    const filters = {};
    if (store) {
      filters.store = store;
    }
    
    const discounts = await Discount.findAll({ where: filters });
    
    // Generate Excel file
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Discounts Data');
    
    // Add headers
    worksheet.addRow([
      'ID',
      'Name',
      'Type',
      'Value',
      'Start Date',
      'End Date',
      'Minimum Purchase',
      'Description',
      'Is Active',
      'Created At'
    ]);
    
    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };
    
    // Add data rows
    discounts.forEach(discount => {
      worksheet.addRow([
        discount.id,
        discount.name,
        discount.type,
        discount.value,
        discount.startDate ? discount.startDate.toISOString().split('T')[0] : '',
        discount.endDate ? discount.endDate.toISOString().split('T')[0] : '',
        discount.minimumOrder,
        discount.description || '',
        discount.status === 'active' ? 'true' : 'false',
        discount.createdAt ? discount.createdAt.toISOString() : ''
      ]);
    });
    
    // Style data rows
    worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      if (rowNumber > 1) {
        // Add borders
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
      }
    });
    
    // Set column widths
    worksheet.columns = [
      { width: 10 }, // ID
      { width: 20 }, // Name
      { width: 15 }, // Type
      { width: 15 }, // Value
      { width: 15 }, // Start Date
      { width: 15 }, // End Date
      { width: 20 }, // Minimum Purchase
      { width: 30 }, // Description
      { width: 10 }, // Is Active
      { width: 20 }  // Created At
    ];
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=discounts-data.xlsx'
    );
    
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Error =>', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    });
  }
};

// Upload Excel - Super Admin only
exports.importData = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }
    
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet(1);
    
    const discountsToCreate = [];
    const errors = [];
    
    // Skip header row
    worksheet.eachRow({ includeEmpty: false }, async (row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      
      try {
        const [name, type, valueStr, startDateStr, endDateStr, minPurchaseStr, description, isActiveStr] = row.values;
        
        // Validation
        if (!name || !type || !valueStr) {
          errors.push(`Row ${rowNumber}: Missing required fields`);
          return;
        }
        
        const value = parseFloat(valueStr);
        if (isNaN(value) || value < 0) {
          errors.push(`Row ${rowNumber}: Invalid value`);
          return;
        }
        
        const typeNormalized = type.toLowerCase().trim();
        if (!['percentage', 'nominal'].includes(typeNormalized)) {
          errors.push(`Row ${rowNumber}: Invalid type. Must be 'percentage' or 'nominal'`);
          return;
        }
        
        const startDate = startDateStr ? new Date(startDateStr) : undefined;
        const endDate = endDateStr ? new Date(endDateStr) : undefined;
        const minimumOrder = parseFloat(minPurchaseStr) || 0;
        const isActive = isActiveStr?.toLowerCase() === 'true' || isActiveStr === '1' || !!isActiveStr;
        
        // Check for duplicate name
        const existingDiscount = await Discount.findOne({
          where: { 
            name: name.trim(),
            ...(req.user?.store ? { store: req.user.store } : {})
          }
        });
        
        if (existingDiscount) {
          errors.push(`Row ${rowNumber}: Discount with name '${name}' already exists`);
          return;
        }
        
        discountsToCreate.push({
          name: name.trim(),
          type: typeNormalized === 'percentage' ? 'percent' : 'nominal',
          value: value,
          startDate: startDate,
          endDate: endDate,
          minimumOrder: minimumOrder,
          description: description?.trim() || null,
          status: isActive ? 'active' : 'inactive',
          store: req.user?.store,
          createdBy: req.user?.id
        });
      } catch (error) {
        errors.push(`Row ${rowNumber}: ${error.message}`);
      }
    });
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors occurred',
        errors: errors
      });
    }
    
    // Create all discounts
    const createdDiscounts = await Discount.bulkCreate(discountsToCreate);
    createAudit(req, 'import', 'discount', null, `Imported ${createdDiscounts.length} discounts`)
    
    return res.status(201).json({
      success: true,
      message: `Successfully imported ${createdDiscounts.length} discounts`,
      data: createdDiscounts
    });
  } catch (error) {
    console.error('Error =>', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    });
  }
};

exports.postNewDiscount = async (req, res) => {
  const { name, type, value, minimumOrder, maximumDiscount, startDate, endDate, status, createdBy } = req.body
  const store = req.body.store || req.user?.store
  try {
    const discountType = type === 'percentage' ? 'percent' : type

    const findOneDiscount = await Discount?.findOne({
      where: {
        name: name,
        ...(store ? { store } : {})
      }
    })

    if (!findOneDiscount) {
      const postData = await Discount.create({
        name,
        type: discountType || 'percent',
        value: parseInt(value),
        minimumOrder: minimumOrder || 0,
        maximumDiscount: maximumDiscount || 0,
        startDate,
        endDate,
        store,
        status: status !== undefined ? (status === true ? 'active' : status === false ? 'inactive' : status) : 'active',
        createdBy
      })
      createAudit(req, 'create', 'discount', postData.id, `Created discount: ${postData.name}`)
      return res.status(200).json({
        success: true,
        message: 'Success',
        data: postData
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Discount Sudah Terdaftar'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.editDiscountById = async (req, res) => {
  const body = req.body
  const store = body.store || req.user?.store
  try {
    const getDuplicate = await Discount.findOne({
      where: {
        name: body.name,
        ...(store ? { store } : {})
      }
    })

    const bodyStatus = body.status !== undefined ? (body.status === true ? 'active' : body.status === false ? 'inactive' : body.status) : 'active'

    if (
      !getDuplicate?.dataValues ||
      getDuplicate?.dataValues?.status !== bodyStatus
    ) {
      const editDiscount = await Discount?.update(
        {
          name: body.name,
          type: body.type,
          value: parseInt(body.value),
          minimumOrder: body.minimumOrder,
          maximumDiscount: body.maximumDiscount,
          startDate: body.startDate,
          endDate: body.endDate,
          status: body.status !== undefined ? (body.status === true ? 'active' : body.status === false ? 'inactive' : body.status) : 'active',
          createdBy: body.createdBy,
          modifiedBy: body?.modifiedBy
        },
        {
          returning: true,
          where: {
            id: body.id,
            ...(store ? { store } : {})
          }
        }
      ).then(([_, data]) => {
        return data
      })
      createAudit(req, 'update', 'discount', body.id, `Updated discount: ${body.name}`)
      return res.status(200).json({
        success: true,
        message: 'Sukses Ubah Discount',
        data: editDiscount?.dataValues
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Discount Sudah Tersedia'
    })
  } catch (error) {
    console.error('Error =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}

exports.deleteDiscountById = async (req, res) => {
  const body = req.body

  try {
    const store = body.store || req.user?.store
    const getId = await Discount.destroy({
      where: {
        id: body.id,
        ...(store ? { store } : {})
      },
      force: true
    })

    if (getId) {
      createAudit(req, 'delete', 'discount', body.id, `Deleted discount: ${body.id}`)
      return res.status(200).json({
        success: true,
        message: 'Success Hapus Discount'
      })
    }
    return res.status(403).json({
      success: false,
      message: 'Hapus Discount Gagal'
    })
  } catch (error) {
    console.error('ERROR =>', error)
    return res.status(500).json({
      success: false,
      message: 'Terjadi Kesalahan Internal Server'
    })
  }
}