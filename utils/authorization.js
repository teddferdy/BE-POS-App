const authorization = (req, res, next) => {
  const getToken = req?.headers?.cookie?.split('=')?.[1]
  console.log('get token =>', getToken)

  if (!getToken) {
    return res.status(401).json({
      message: 'User Belum Login'
    })
  }
  try {
    return next()
  } catch {
    return res.status(401).json({
      message: 'User Belum Login'
    })
  }
}

module.exports = authorization
