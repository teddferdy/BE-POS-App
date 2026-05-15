/* eslint-disable no-undef */
const jwt = require('jsonwebtoken')

const generateToken = (payload) => {
  const secretKey = process.env.JWT_SECRET_KEY || 'default-secret-key-change-in-production'
  const expiresIn = process.env.JWT_EXPIRED_IN || '1d'
  
  return jwt.sign(payload, secretKey, {
    expiresIn: expiresIn
  })
}

module.exports = generateToken
