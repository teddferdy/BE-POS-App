import express from "express";

const router = express.Router();

import homeController from "../controller/home";

// List Home Default
router.get("/list-product", homeController.home);

// // Search
// router.post("/list", homeController.home);

module.exports = router;
