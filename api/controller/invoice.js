const db = require('../../db/models')
const { uploadToCloudinary, deleteFromCloudinary } = require('../../utils/cloudinaryStorage')
const { createAudit } = require('../../utils/auditLog')

const invoiceController = {
  async getSetting(req, res) {
    try {
      const { store } = req.query

      const setting = await db.invoice_setting.findOne({
        where: { store }
      })

      let data = null
      if (setting) {
        data = setting.toJSON()
        if (data.socialMediaList) {
          try {
            data.socialMediaList = JSON.parse(data.socialMediaList)
          } catch (e) {
            data.socialMediaList = []
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Success get invoice setting',
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

  async updateSetting(req, res) {
    try {
      const { store, footerText, socialMediaList, showLogo, showStoreName, showAddress, showFooter } = req.body
      const imageFile = req.file

      let existing = await db.invoice_setting.findOne({ where: { store } })

      let logoImage = existing?.logoImage || null
      if (imageFile) {
        if (existing?.logoImage) {
          await deleteFromCloudinary(existing.logoImage)
        }
        logoImage = await uploadToCloudinary(imageFile.path, 'pos-app-invoices')
      }

      const payload = {
        logoImage,
        footerText: footerText !== undefined ? footerText : existing?.footerText || null,
        socialMediaList:
          socialMediaList !== undefined
            ? typeof socialMediaList === 'string'
              ? socialMediaList
              : JSON.stringify(socialMediaList)
            : existing?.socialMediaList || null,
        showLogo: showLogo !== undefined ? showLogo : existing?.showLogo ?? true,
        showStoreName: showStoreName !== undefined ? showStoreName : existing?.showStoreName ?? true,
        showAddress: showAddress !== undefined ? showAddress : existing?.showAddress ?? true,
        showFooter: showFooter !== undefined ? showFooter : existing?.showFooter ?? true,
        modifiedBy: req.user?.id
      }

      if (existing) {
        await existing.update(payload)
        await createAudit(req, 'update', 'invoice_setting', existing.id, 'Updated invoice_setting for store: ' + store)
      } else {
        payload.store = store
        payload.createdBy = req.user?.id
        existing = await db.invoice_setting.create(payload)
        await createAudit(req, 'create', 'invoice_setting', existing.id, 'Created invoice_setting for store: ' + store)
      }

      const result = existing.toJSON()
      if (result.socialMediaList) {
        try {
          result.socialMediaList = JSON.parse(result.socialMediaList)
        } catch (e) {
          result.socialMediaList = []
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Success update invoice setting',
        data: result
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
