const express = require("express");

const router = express.Router();

const homeController = require("../controller/home");

// List Home Default
router.get("/list-product", homeController.home);

// // Search
// router.post("/list", homeController.home);

module.exports = router;
