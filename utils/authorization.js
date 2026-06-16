const jwt = require('jsonwebtoken')
const userContext = require('./userContext')

const setUserContext = (userId) => {
  const store = userContext.getStore()
  if (store) {
    store.userId = userId
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
    setUserContext(decoded.id)
    return next()
  } catch (error) {
    return res.status(401).json({
      message: 'Token Tidak Valid'
    })
  }
}

const requireRole = (...roles) => {
  return (req, res, next) => {
    const token = getToken(req)

    if (!token) {
      return res.status(401).json({
        message: 'User Belum Login'
      })
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET_KEY || 'secret-key-user'
      )
      req.user = decoded
      setUserContext(decoded.id)

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
module.exports.setUserContext = setUserContext
