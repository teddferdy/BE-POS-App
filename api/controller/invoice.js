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

      return res.status(200).json({
        success: true,
        message: 'Success get invoice setting',
        data: setting || null
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
      const { store, showStoreName, showAddress, showMemberInfo, removeLogo } = req.body

      let existing = await db.invoice_setting.findOne({ where: { store } })

      let logoUrl = existing?.logo || null

      if (removeLogo === 'true' || removeLogo === true) {
        if (existing?.logo) {
          await deleteFromCloudinary(existing.logo).catch(() => {})
        }
        logoUrl = null
      } else if (req.file) {
        if (existing?.logo) {
          await deleteFromCloudinary(existing.logo).catch(() => {})
        }
        try {
          logoUrl = await uploadToCloudinary(req.file.path, 'pos-app-invoice')
        } catch (cloudErr) {
          console.error('Cloudinary upload failed:', cloudErr)
        }
      }

      const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1'

      const payload = {
        showStoreName: showStoreName !== undefined ? toBool(showStoreName) : existing?.showStoreName ?? true,
        showAddress: showAddress !== undefined ? toBool(showAddress) : existing?.showAddress ?? true,
        showMemberInfo: showMemberInfo !== undefined ? toBool(showMemberInfo) : existing?.showMemberInfo ?? true,
        logo: logoUrl,
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

      return res.status(200).json({
        success: true,
        message: 'Success update invoice setting',
        data: existing
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
