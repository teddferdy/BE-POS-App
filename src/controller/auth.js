const db = require("../db");

exports.getAllUser = async (req, res, next) => {
  try {
    const datas = await db.pool.query(`SELECT * FROM public."User"`);
    console.log("datas =>", datas);
    res.status(200).json({
      message: "Get All Data",
      data: datas?.rows,
    });
  } catch (error) {
    console.log("BROO =>", error.stack);
    res.status(500).json({
      error: "Something went wrong",
    });
  }
};

exports.renderFormLogin = (req, res, next) => {};

exports.login = (req, res, next) => {};

// Register
exports.registerNewUser = async (req, res, next) => {};

// Reset Password
exports.resetPassword = async (req, res, next) => {};

// User Logout
exports.logout = (req, res, next) => {
  // res.clearCookie("userName");
  // res.clearCookie("password");
  // res.clearCookie("role");
  // res.clearCookie("id");
  // res.redirect("/");
  // return res.end();
};
