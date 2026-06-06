const db = require('../../db/models')

const receiptController = {
  async getOrderReceipt(req, res) {
    try {
      const { orderId } = req.params
      const store = req.cookies.store || req.user?.store

      const order = await db.order.findOne({
        where: { id: orderId, ...(store ? { store } : {}) },
        include: [
          {
            model: db.order_item,
            as: 'items',
            include: [
              {
                model: db.product,
                as: 'productData',
                attributes: ['id', 'nameProduct']
              }
            ]
          },
          {
            model: db.location,
            as: 'storeData',
            attributes: ['id', 'name', 'address', 'phone']
          },
          {
            model: db.user,
            as: 'userData',
            attributes: ['id', 'name']
          },
          {
            model: db.member,
            as: 'memberData',
            attributes: ['id', 'name', 'phone']
          }
        ]
      })

      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' })
      }

      const receipt = {
        storeName: order.storeData?.name || 'Toko',
        storeAddress: order.storeData?.address || '',
        storePhone: order.storeData?.phone || '',
        orderNumber: order.orderNumber || `INV-${order.id}`,
        cashier: order.userData?.name || '-',
        customer: order.memberData?.name || 'Umum',
        date: order.createdAt ? new Date(order.createdAt).toLocaleString('id-ID') : '',
        items: (order.items || []).map(item => ({
          name: item.productData?.nameProduct || item.productName || '-',
          qty: item.quantity || 0,
          price: item.price || 0,
          total: item.total || (item.quantity * item.price) || 0
        })),
        subtotal: order.subTotal || 0,
        discount: order.discountAmount || 0,
        tax: order.taxAmount || 0,
        total: order.totalPrice || order.finalAmount || 0,
        paymentMethod: order.paymentMethod || order.typePayment || 'Tunai',
        cashAmount: order.cashAmount || order.total || 0,
        changeAmount: order.changeAmount || 0,
        footer: 'Terima kasih atas kunjungan Anda'
      }

      return res.status(200).json({
        success: true,
        message: 'Success get receipt data',
        data: receipt
      })
    } catch (error) {
      console.error('Error =>', error)
      return res.status(500).json({ success: false, message: 'Internal server error' })
    }
  }
}

module.exports = receiptController
