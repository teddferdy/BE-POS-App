const db = require('../../db/models')
const { createAudit } = require('../../utils/auditLog')

module.exports = {
  async getAllBySupplier(req, res) {
    try {
      const { supplierId } = req.params
      const supplier = await db.supplier.findByPk(supplierId)
      if (!supplier) {
        return res.status(404).json({ success: false, message: 'Supplier not found' })
      }

      const accounts = await db.supplier_bank_account.findAll({
        where: { supplier: supplierId },
        order: [['isDefault', 'DESC']]
      })

      return res.status(200).json({ success: true, message: 'Success get bank accounts', data: accounts })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params
      const account = await db.supplier_bank_account.findByPk(id)
      if (!account) {
        return res.status(404).json({ success: false, message: 'Bank account not found' })
      }

      return res.status(200).json({ success: true, message: 'Success get bank account', data: account })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async create(req, res) {
    try {
      const { supplierId } = req.params
      const { bankName, accountNumber, accountName, isDefault, status } = req.body

      const supplier = await db.supplier.findByPk(supplierId)
      if (!supplier) {
        return res.status(404).json({ success: false, message: 'Supplier not found' })
      }

      const trimmedBank = String(bankName || '').trim()
      const trimmedAccountNumber = String(accountNumber || '').trim()
      const trimmedAccountName = String(accountName || '').trim()

      if (!trimmedBank || !trimmedAccountNumber || !trimmedAccountName) {
        return res.status(400).json({ success: false, message: 'Bank name, account number, and account name are required' })
      }

      if (isDefault) {
        await db.supplier_bank_account.update(
          { isDefault: false },
          { where: { supplier: supplierId } }
        )
      }

      const account = await db.supplier_bank_account.create({
        supplier: supplierId,
        bankName: trimmedBank,
        accountNumber: trimmedAccountNumber,
        accountName: trimmedAccountName,
        isDefault: !!isDefault,
        status: status || 'active'
      })

      createAudit(req, 'create', 'supplier_bank_account', account.id, `Created bank account for supplier: ${supplierId}`)

      return res.status(201).json({ success: true, message: 'Success create bank account', data: account })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async update(req, res) {
    try {
      const { id } = req.params
      const { bankName, accountNumber, accountName, isDefault, status } = req.body

      const account = await db.supplier_bank_account.findByPk(id)
      if (!account) {
        return res.status(404).json({ success: false, message: 'Bank account not found' })
      }

      if (isDefault) {
        await db.supplier_bank_account.update(
          { isDefault: false },
          { where: { supplier: account.supplier, id: { [require('sequelize').Op.ne]: id } } }
        )
      }

      const trimmedBank = bankName?.trim()
      const trimmedAccountNumber = accountNumber?.trim()
      const trimmedAccountName = accountName?.trim()

      await account.update({
        bankName: trimmedBank ?? account.bankName,
        accountNumber: trimmedAccountNumber ?? account.accountNumber,
        accountName: trimmedAccountName ?? account.accountName,
        isDefault: isDefault !== undefined ? !!isDefault : account.isDefault,
        status: status !== undefined ? status : account.status
      })

      createAudit(req, 'update', 'supplier_bank_account', id, `Updated bank account: ${id}`)

      return res.status(200).json({ success: true, message: 'Success update bank account', data: account })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  },

  async delete(req, res) {
    try {
      const { id } = req.params
      const account = await db.supplier_bank_account.findByPk(id)
      if (!account) {
        return res.status(404).json({ success: false, message: 'Bank account not found' })
      }

      await account.destroy()
      createAudit(req, 'delete', 'supplier_bank_account', id, `Deleted bank account: ${id}`)

      return res.status(200).json({ success: true, message: 'Success delete bank account' })
    } catch (error) {
      console.log(error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
}
