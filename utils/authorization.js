const authorization = (req, res, next) => {
  const getToken = req?.cookies

  if (!getToken) {
    return res.status(401).json({
      message: 'User Belum Login'
    })
  }
  try {
    return next()
  } catch {
    return res.status(500).json({
      message: 'Server Error'
    })
  }
}

module.exports = authorization
