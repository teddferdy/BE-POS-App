const jwt = require('jsonwebtoken')
const userContext = require('./userContext')

const setUserContext = (decoded) => {
  const store = userContext.getStore()
  if (store) {
    store.userId = decoded.id
    store.userName = decoded.userName
    store.fullName = decoded.fullName
  }
}

const getToken = (req) => {
  let token = req?.cookies?.token
  if (!token) {
    const authHeader = req?.headers?.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }
  }
  return token
}

const authorization = (req, res, next) => {
  const getTokenValue = getToken(req)

  if (!getTokenValue) {
    return res.status(401).json({
      message: 'User Belum Login'
    })
  }

  try {
    const decoded = jwt.verify(
      getTokenValue,
      process.env.JWT_SECRET_KEY || 'secret-key-user'
    )
    req.user = decoded
    setUserContext(decoded)
    return next()
  } catch (error) {
    return res.status(401).json({
      message: 'Token Tidak Valid'
    })
  }
}

const requireRole = (...roles) => {
  // ponytail: authorization middleware already decodes JWT; requireRole reuses req.user
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: 'User Belum Login'
      })
    }

    if (!roles.includes(req.user.roleType)) {
      return res.status(403).json({
        message: 'Akses Ditolak - Anda tidak memiliki izin'
      })
    }

    return next()
  }
}

module.exports = authorization
module.exports.requireRole = requireRole
module.exports.setUserContext = setUserContext
