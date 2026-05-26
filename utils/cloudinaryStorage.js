const cloudinary = require('cloudinary').v2
const fs = require('fs')
const crypto = require('crypto')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

const uploadToCloudinary = async (filePath, folder = 'pos-app') => {
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found')
  }

  const result = await cloudinary.uploader.upload(filePath, {
    folder: folder,
    resource_type: 'auto',
    transformation: [{ quality: 'auto', fetch_format: 'auto' }]
  })

  return result.secure_url
}

const uploadToCloudinaryWithDedup = async (filePath, folder = 'pos-app') => {
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found')
  }

  const fileBuffer = fs.readFileSync(filePath)
  const hash = crypto.createHash('md5').update(fileBuffer).digest('hex')

  const result = await cloudinary.uploader.upload(filePath, {
    public_id: hash,
    folder: folder,
    resource_type: 'auto',
    overwrite: false,
    unique_filename: false,
    invalidate: false,
    transformation: [{ quality: 'auto', fetch_format: 'auto' }]
  })

  return { url: result.secure_url, hash }
}

const deleteFromCloudinary = async (imageUrl) => {
  if (!imageUrl || !imageUrl.includes('cloudinary')) {
    return
  }

  const publicId = imageUrl.split('/').pop().split('.')[0]
  const fullPublicId = `pos-app/${publicId}`

  await cloudinary.uploader.destroy(fullPublicId)
}

module.exports = {
  uploadToCloudinary,
  uploadToCloudinaryWithDedup,
  deleteFromCloudinary
}
