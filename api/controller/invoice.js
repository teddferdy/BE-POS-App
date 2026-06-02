const db = require('../../db/models')
const { Op } = require('sequelize')
const { uploadToCloudinary, deleteFromCloudinary } = require('../../utils/cloudinaryStorage')
const { downloadInvoiceLogoTemplate, parseInvoiceLogoTemplate } = require('../../utils/excelTemplate')

const invoiceController = {
  async getLogo(req, res) {
    try {
      const { store } = req.query

      const logos = await db.invoice_logo.findAll({
        where: { store }
      })

      return res.status(200).json({
        success: true,
        message: 'Success get invoice logos',
        data: logos
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getLogoActive(req, res) {
    try {
      const { store } = req.query

      const logo = await db.invoice_logo.findOne({
        where: { store, isActive: true }
      })

      return res.status(200).json({
        success: true,
        message: 'Success get active logo',
        data: logo
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async createLogo(req, res) {
    try {
      const { store, status } = req.body
      const imageFile = req.file

      let imageUrl = null
      if (imageFile) {
        imageUrl = await uploadToCloudinary(imageFile.path, 'pos-app-invoices')
      }

      const logo = await db.invoice_logo.create({
        store,
        image: imageUrl,
        status: status !== undefined ? status : true,
        isActive: false,
        createdBy: req.user?.id
      })

      return res.status(201).json({
        success: true,
        message: 'Success create logo',
        data: logo
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async updateLogo(req, res) {
    try {
      const { id, image, store, status } = req.body
      const imageFile = req.file

      const logo = await db.invoice_logo.findOne({
        where: { id, store }
      })

      if (!logo) {
        return res.status(404).json({
          success: false,
          message: 'Logo not found'
        })
      }

      let imageUrl = logo.image
      if (imageFile) {
        imageUrl = await uploadToCloudinary(imageFile.path, 'pos-app-invoices')
      }

      await logo.update({
        image: imageUrl,
        status: status !== undefined ? status : logo.status,
        modifiedBy: req.user?.id
      })

      return res.status(200).json({
        success: true,
        message: 'Success update logo',
        data: logo
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async deleteLogo(req, res) {
    try {
      const { id } = req.params
      const { store } = req.query

      const logo = await db.invoice_logo.findOne({
        where: { id, store }
      })

      if (!logo) {
        return res.status(404).json({
          success: false,
          message: 'Logo not found'
        })
      }

      if (logo.image) {
        await deleteFromCloudinary(logo.image)
      }

      await logo.destroy()

      return res.status(200).json({
        success: true,
        message: 'Success delete logo'
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async activateLogo(req, res) {
    try {
      const { id } = req.params
      const { store } = req.body

      const logo = await db.invoice_logo.findOne({
        where: { id, store }
      })

      if (!logo) {
        return res.status(404).json({
          success: false,
          message: 'Logo not found'
        })
      }

      await db.invoice_logo.update(
        { isActive: false },
        { where: { store } }
      )

      await logo.update({ isActive: true })

      return res.status(200).json({
        success: true,
        message: 'Success activate logo',
        data: logo
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async downloadLogoTemplate(req, res) {
    try {
      const existingLogos = await db.invoice_logo.findAll({
        attributes: ['id', 'store', 'image', 'isActive', 'status', 'createdBy']
      })

      const buffer = await downloadInvoiceLogoTemplate(existingLogos)

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename=template_invoice_logo.xlsx')

      res.send(buffer)
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Failed to download template'
      })
    }
  },

  async importLogo(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'File Excel required'
        })
      }

      const logos = await parseInvoiceLogoTemplate(req.file.buffer)

      if (!logos.length) {
        return res.status(400).json({
          success: false,
          message: 'No logo data found in file'
        })
      }

      const results = { created: 0, updated: 0, errors: [] }

      for (const logo of logos) {
        try {
          if (!logo.store) {
            results.errors.push({ no: logo.no, message: 'Store ID empty' })
            continue
          }

          const isActiveValue = logo.isActive?.toLowerCase() === 'ya'
          const statusValue = logo.status?.toLowerCase() === 'aktif'

          const existing = await db.invoice_logo.findOne({ where: { store: logo.store } })

          if (existing) {
            await existing.update({
              isActive: isActiveValue,
              status: statusValue,
              modifiedBy: logo.createdBy || null
            })
            results.updated++
          } else {
            await db.invoice_logo.create({
              store: logo.store,
              isActive: isActiveValue,
              status: statusValue,
              createdBy: logo.createdBy || null
            })
            results.created++
          }
        } catch (err) {
          results.errors.push({ no: logo.no, message: err.message })
        }
      }

      return res.status(200).json({
        success: true,
        message: `Import complete: ${results.created} created, ${results.updated} updated`,
        data: results
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Failed to import logos'
      })
    }
  },

  async getSocialMedia(req, res) {
    try {
      const { store } = req.query

      const socialMedia = await db.invoice_social_media.findAll({
        where: { store },
        order: [['createdAt', 'DESC']]
      })

      const data = socialMedia.map(item => ({
        ...item.toJSON(),
        socialMediaList: item.socialMediaList ? JSON.parse(item.socialMediaList) : []
      }))

      return res.status(200).json({
        success: true,
        message: 'Success get social media',
        data
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getSocialMediaActive(req, res) {
    try {
      const { store } = req.query

      const socialMedia = await db.invoice_social_media.findOne({
        where: { store, isActive: true }
      })

      if (socialMedia) {
        socialMedia.socialMediaList = socialMedia.socialMediaList ? JSON.parse(socialMedia.socialMediaList) : []
      }

      return res.status(200).json({
        success: true,
        message: 'Success get active social media',
        data: socialMedia
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async createSocialMedia(req, res) {
    try {
      const { store, name, socialMediaList, status } = req.body

      const socialMedia = await db.invoice_social_media.create({
        store,
        name,
        socialMediaList: Array.isArray(socialMediaList) ? JSON.stringify(socialMediaList) : socialMediaList,
        status: status !== undefined ? status : true,
        isActive: false,
        createdBy: req.user?.id
      })

      return res.status(201).json({
        success: true,
        message: 'Success create social media',
        data: socialMedia
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async updateSocialMedia(req, res) {
    try {
      const { id } = req.params
      const { store, name, socialMediaList, status } = req.body

      const socialMedia = await db.invoice_social_media.findOne({
        where: { id, store }
      })

      if (!socialMedia) {
        return res.status(404).json({
          success: false,
          message: 'Social media not found'
        })
      }

      await socialMedia.update({
        name: name || socialMedia.name,
        socialMediaList: socialMediaList ? (Array.isArray(socialMediaList) ? JSON.stringify(socialMediaList) : socialMediaList) : socialMedia.socialMediaList,
        status: status !== undefined ? status : socialMedia.status,
        modifiedBy: req.user?.id
      })

      return res.status(200).json({
        success: true,
        message: 'Success update social media',
        data: socialMedia
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async deleteSocialMedia(req, res) {
    try {
      const { id } = req.params
      const { store } = req.query

      const socialMedia = await db.invoice_social_media.findOne({
        where: { id, store }
      })

      if (!socialMedia) {
        return res.status(404).json({
          success: false,
          message: 'Social media not found'
        })
      }

      await socialMedia.destroy()

      return res.status(200).json({
        success: true,
        message: 'Success delete social media'
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async activateSocialMedia(req, res) {
    try {
      const { id } = req.params
      const { store } = req.body

      const socialMedia = await db.invoice_social_media.findOne({
        where: { id, store }
      })

      if (!socialMedia) {
        return res.status(404).json({
          success: false,
          message: 'Social media not found'
        })
      }

      await db.invoice_social_media.update(
        { isActive: false },
        { where: { store } }
      )

      await socialMedia.update({ isActive: true })

      return res.status(200).json({
        success: true,
        message: 'Success activate social media',
        data: socialMedia
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getFooter(req, res) {
    try {
      const { store } = req.query

      const footers = await db.invoice_footer.findAll({
        where: { store },
        order: [['createdAt', 'DESC']]
      })

      const data = footers.map(item => ({
        ...item.toJSON(),
        footerList: item.footerList ? JSON.parse(item.footerList) : []
      }))

      return res.status(200).json({
        success: true,
        message: 'Success get invoice footers',
        data
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async getFooterActive(req, res) {
    try {
      const { store } = req.query

      const footer = await db.invoice_footer.findOne({
        where: { store, isActive: true }
      })

      if (footer && footer.footerList) {
        footer.footerList = JSON.parse(footer.footerList)
      }

      return res.status(200).json({
        success: true,
        message: 'Success get active footer',
        data: footer
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async createFooter(req, res) {
    try {
      const { store, name, footerList, status } = req.body

      const footer = await db.invoice_footer.create({
        store,
        name,
        footerList: Array.isArray(footerList) ? JSON.stringify(footerList) : footerList,
        status: status !== undefined ? status : true,
        isActive: false,
        createdBy: req.user?.id
      })

      return res.status(201).json({
        success: true,
        message: 'Success create footer',
        data: footer
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async updateFooter(req, res) {
    try {
      const { id } = req.params
      const { store, name, footerList, status } = req.body

      const footer = await db.invoice_footer.findOne({
        where: { id, store }
      })

      if (!footer) {
        return res.status(404).json({
          success: false,
          message: 'Footer not found'
        })
      }

      await footer.update({
        name: name || footer.name,
        footerList: footerList ? (Array.isArray(footerList) ? JSON.stringify(footerList) : footerList) : footer.footerList,
        status: status !== undefined ? status : footer.status,
        modifiedBy: req.user?.id
      })

      return res.status(200).json({
        success: true,
        message: 'Success update footer',
        data: footer
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async deleteFooter(req, res) {
    try {
      const { id } = req.params
      const { store } = req.query

      const footer = await db.invoice_footer.findOne({
        where: { id, store }
      })

      if (!footer) {
        return res.status(404).json({
          success: false,
          message: 'Footer not found'
        })
      }

      await footer.destroy()

      return res.status(200).json({
        success: true,
        message: 'Success delete footer'
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async activateFooter(req, res) {
    try {
      const { id } = req.params
      const { store } = req.body

      const footer = await db.invoice_footer.findOne({
        where: { id, store }
      })

      if (!footer) {
        return res.status(404).json({
          success: false,
          message: 'Footer not found'
        })
      }

      await db.invoice_footer.update(
        { isActive: false },
        { where: { store } }
      )

      await footer.update({ isActive: true })

      return res.status(200).json({
        success: true,
        message: 'Success activate footer',
        data: footer
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  },

  async downloadFooterTemplate(req, res) {
    try {
      const footers = await db.invoice_footer.findAll({
        attributes: ['id', 'store', 'name', 'footerList', 'isActive', 'status']
      })

      const workbook = new (require('exceljs').Workbook)()
      const ws = workbook.addWorksheet('Footer')
      ws.columns = [
        { header: 'No', key: 'no', width: 5 },
        { header: 'Store ID', key: 'store', width: 15 },
        { header: 'Nama Footer', key: 'name', width: 20 },
        { header: 'Is Active', key: 'isActive', width: 15 },
        { header: 'Status', key: 'status', width: 15 }
      ]
      footers.forEach((f, i) => {
        ws.addRow({ no: i + 1, store: f.store, name: f.name, isActive: f.isActive ? 'Ya' : 'Tidak', status: f.status ? 'Aktif' : 'Nonaktif' })
      })

      const buffer = await workbook.xlsx.writeBuffer()
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', 'attachment; filename=template_invoice_footer.xlsx')
      res.send(buffer)
    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: 'Failed to download footer template' })
    }
  },

  async importFooter(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'File Excel required' })
      }

      const ExcelJS = require('exceljs')
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(req.file.buffer)
      const ws = wb.worksheets[0]

      const results = { created: 0, updated: 0, errors: [] }

      ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const store = row.getCell(2).value
        const name = row.getCell(3).value
        const isActive = String(row.getCell(4).value || '').toLowerCase() === 'ya'
        const status = String(row.getCell(5).value || '').toLowerCase() === 'aktif'

        if (!store) {
          results.errors.push({ row: rowNumber, message: 'Store ID empty' })
          return
        }
      })

      return res.status(200).json({
        success: true,
        message: `Import complete: ${results.created} created, ${results.updated} updated`,
        data: results
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: 'Failed to import footers' })
    }
  },

  async getAll(req, res) {
    try {
      const { store } = req.query

      const [logos, socialMedia, footers] = await Promise.all([
        db.invoice_logo.findAll({ where: { store } }),
        db.invoice_social_media.findAll({ where: { store } }),
        db.invoice_footer.findAll({ where: { store } })
      ])

      return res.status(200).json({
        success: true,
        message: 'Success get all invoice settings',
        data: {
          logo: logos.find(l => l.isActive) || null,
          socialMedia: socialMedia.find(s => s.isActive) || null,
          footer: footers.find(f => f.isActive) || null
        }
      })
    } catch (error) {
      console.log(error)
      return res.status(500).json({
        success: false,
        message: 'Internal server error'
      })
    }
  }
}

module.exports = invoiceController