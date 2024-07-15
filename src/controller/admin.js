// Connect DB
import db from "../db";
import moment from "moment";
import fs from "fs/promises";
const date = moment().format("YYYY-MM-DD");

// Render Add Form Product
exports.renderFormAdd = async (req, res, next) => {};

// Function Post Add Form Product
exports.postAddProduct = async (req, res, next) => {};

// Render Edit Form Product
exports.renderFormEdit = async (req, res, next) => {};

// Function Put Edit Form Product
exports.EditProduct = async (req, res, next) => {};

// Delete
exports.deleteProduct = async (req, res, next) => {};

// Render Cart
exports.renderCart = (req, res, next) => {};

// Render Form Add Category
exports.renderAddCategory = async (req, res, next) => {};

exports.postAddCategory = async (req, res, next) => {};

// Delete file image
exports.deleteImage = async (req, res, next) => {};
