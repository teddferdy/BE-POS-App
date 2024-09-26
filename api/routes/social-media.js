/* eslint-disable no-undef */
const express = require('express')

const router = express.Router()

const SocialMediaController = require('../controller/social-media')

// Authorization
const authorization = require('../../utils/authorization')

// Get Social Media
router.get(
  '/get-social-media',
  authorization,
  SocialMediaController?.getAllSocialMedia
)

// Post Social Media
router.post(
  '/add-social-media',
  authorization,
  SocialMediaController?.addNewSocialMedia
)

// Edit Social Media
router.put(
  '/edit-social-media/:id',
  authorization,
  SocialMediaController?.editSocialMediaById
)

// Delete Social Media
router.delete(
  '/delete-social-media/:id',
  authorization,
  SocialMediaController?.deleteSocialMediaById
)

module.exports = router
