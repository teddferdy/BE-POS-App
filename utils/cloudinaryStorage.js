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

  const parts = imageUrl.split('/')
  const fileName = parts.pop()
  const publicId = fileName.split('.')[0]

  const uploadIndex = parts.findIndex((p) => p.startsWith('upload'))
  if (uploadIndex === -1 || uploadIndex >= parts.length - 2) return

  const folderPath = parts.slice(uploadIndex + 2).join('/')
  const fullPublicId = folderPath ? `${folderPath}/${publicId}` : publicId

  await cloudinary.uploader.destroy(fullPublicId)
}

module.exports = {
  uploadToCloudinary,
  uploadToCloudinaryWithDedup,
  deleteFromCloudinary
}
