const express = require('express')

const router = express.Router()

const SocialMediaController = require('../controller/social-media')

// Authorization
const authorization = require('../../utils/authorization')
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
  authorization, validateStoreAccess,
  SocialMediaController.addNewSocialMedia
)

// Edit Social Media
router.put(
  '/edit-social-media/:id',
  authorization, validateStoreAccess,
  SocialMediaController.editSocialMediaById
)

// Delete Social Media
router.delete(
  '/delete-social-media/:id',
  authorization, validateStoreAccess,
  SocialMediaController.deleteSocialMediaById
)

module.exports = router
