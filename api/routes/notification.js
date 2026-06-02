const express = require("express");
const router = express.Router();
const notificationController = require("../controller/notification");
const authorization = require("../../utils/authorization");
const { requireRole } = require("../../utils/authorization");
const { validateStoreAccess } = require("../../utils/storeValidation");

router.get(
  "/",
  authorization,
  validateStoreAccess,
  notificationController.getAllNotifications
);
router.get(
  "/unread",
  authorization,
  validateStoreAccess,
  notificationController.getUnreadCount
);
router.put(
  "/:id/read",
  authorization,
  validateStoreAccess,
  notificationController.markAsRead
);
router.put(
  "/read-all",
  authorization,
  validateStoreAccess,
  notificationController.markAllAsRead
);

module.exports = router;
