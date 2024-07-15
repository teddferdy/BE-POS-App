const express = require("express");

const router = express.Router();

// List Home Default
router.get("/list-product", (req, res, next) => {
  res.send("HELLo");
});

// // Search
// router.post("/list", homeController.home);

module.exports = router;
