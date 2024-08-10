const express = require("express");

const router = express.Router();

import reportSellingController from "../controller/reportSelling";

// Function Show Graph
router.get("/show-graph", reportSellingController.showGraph);

// Function Filter Graph
router.post("/show-graph", reportSellingController.showGraph);

module.exports = router;
