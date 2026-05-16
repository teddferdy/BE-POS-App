const jwt = require('jsonwebtoken')

const authorization = (req, res, next) => {
  const getToken = req?.cookies?.token

  if (!getToken) {
    return res.status(401).json({
      message: 'User Belum Login'
    })
  }

  try {
    const decoded = jwt.verify(getToken, process.env.JWT_SECRET || 'pos-app-secret-key')
    req.user = decoded
    return next()
  } catch (error) {
    return res.status(401).json({
      message: 'Token Tidak Valid'
    })
  }
}

const requireRole = (...roles) => {
  return (req, res, next) => {
    const getToken = req?.cookies?.token

    if (!getToken) {
      return res.status(401).json({
        message: 'User Belum Login'
      })
    }

    try {
      const decoded = jwt.verify(getToken, process.env.JWT_SECRET || 'pos-app-secret-key')
      req.user = decoded

      if (!roles.includes(decoded.roleType)) {
        return res.status(403).json({
          message: 'Akses Ditolak - Anda tidak memiliki izin'
        })
      }

      return next()
    } catch (error) {
      return res.status(401).json({
        message: 'Token Tidak Valid'
      })
    }
  }
}

module.exports = authorization
module.exports.requireRole = requireRole