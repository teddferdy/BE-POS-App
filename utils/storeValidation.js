const validateStoreAccess = (req, res, next) => {
  const userRole = req.user?.roleType
  const userStore = req.user?.store
  const requestedStore = req.query.store || req.body.store

  // Super admin can access all stores
  if (userRole === 'super_admin') {
    return next()
  }

  // Admin and User can only access their own store
  if (userRole === 'admin' || userRole === 'user') {
    if (requestedStore && parseInt(requestedStore) !== userStore) {
      return res.status(403).json({
        message: 'Anda hanya dapat mengakses data di toko Anda'
      })
    }
  }

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