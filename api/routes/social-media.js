const express = require('express')

const router = express.Router()

const SocialMediaController = require('../controller/social-media')

// Authorization
const authorization = require('../../utils/authorization')
const { requireRole } = require('../../utils/authorization')
const { validateStoreAccess } = require('../../utils/storeValidation')

// Get Social Media
router.get(
  '/get-social-media',
  authorization, validateStoreAccess,
  SocialMediaController.getAllSocialMedia
)

// Post Social Media
router.post(
  '/add-social-media',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  SocialMediaController.addNewSocialMedia
)

// Edit Social Media
router.put(
  '/edit-social-media/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  SocialMediaController.editSocialMediaById
)

// Delete Social Media
router.delete(
  '/delete-social-media/:id',
  authorization, validateStoreAccess, requireRole('super_admin', 'admin'),
  SocialMediaController.deleteSocialMediaById
)

module.exports = router
