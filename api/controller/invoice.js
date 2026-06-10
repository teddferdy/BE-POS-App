const db = require('../../db/models')
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
      const { store, showStoreName, showAddress, showMemberInfo } = req.body

      let existing = await db.invoice_setting.findOne({ where: { store } })

      const payload = {
        showStoreName: showStoreName !== undefined ? showStoreName : existing?.showStoreName ?? true,
        showAddress: showAddress !== undefined ? showAddress : existing?.showAddress ?? true,
        showMemberInfo: showMemberInfo !== undefined ? showMemberInfo : existing?.showMemberInfo ?? true,
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
