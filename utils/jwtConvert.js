/* eslint-disable no-undef */
const jwt = require('jsonwebtoken')

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRED_IN
  })
}

module.exports = generateToken
