const validateStoreAccess = (req, res, next) => {
  const userRole = req.user?.roleType
  const userStore = req.user?.store
  const requestedStore =
    parseInt(req.query.store) || parseInt(req.body.store) || null

  if (userRole === 'super_admin') {
    // super_admin can access any store — use requested store or fall back to user's default
    req.storeId = requestedStore || userStore || null
    return next()
  }

  // admin / kasir / user — always scoped to their own store
  if (requestedStore && requestedStore !== userStore) {
    return res.status(403).json({
      message: 'Anda hanya dapat mengakses data di toko Anda'
    })
  }

  req.storeId = userStore
  return next()
}

const validateStoreId = (storeId, userStore, userRole) => {
  if (userRole === 'super_admin') {
    return true
  }
  return parseInt(storeId) === userStore
}

module.exports = {
  validateStoreAccess,
  validateStoreId
}
