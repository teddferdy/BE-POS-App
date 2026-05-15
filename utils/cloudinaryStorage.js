const cloudinary = require('cloudinary').v2
const fs = require('fs')

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
    transformation: [
      { quality: 'auto', fetch_format: 'auto' }
    ]
  })

  return result.secure_url
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
  deleteFromCloudinary
}