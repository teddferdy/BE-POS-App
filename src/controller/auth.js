const db = require("../db");

exports.getAllUser = async (req, res, next) => {
  try {
    const datas = await db.pool.query(`SELECT * FROM public."User"`);
    res.status(200).json({
      message: "Get All Data",
      data: datas?.rows,
    });
  } catch (error) {
    res.status(500).json({
      error: "Something went wrong",
    });
  }
};

exports.login = async (req, res, next) => {
  const { userName, password } = req.body;
  try {
    const datas = await db.pool.query(
      `SELECT * FROM public."User" WHERE "userName" = '${userName}' AND password = '${password}'`
    );

    if (datas.rows) {
      res.status(200).json({
        message: "Success",
        data: datas?.rows,
      });
    } else {
      res.status(404).json({
        error: "Pengguna Tidak Ditemukan",
      });
    }
  } catch (error) {
    res.status(500).json({
      error: "Server Error",
    });
  }
};

// Register
exports.registerNewUser = async (req, res, next) => {
  const { userName, password } = req.body;
  try {
    const datas = await db.pool.query(`
      INSERT INTO public."User"(
        "userName", password, role)
        VALUES ('${userName}', '${password}', 'user');
    `);

    if (datas.rows) {
      res.status(200).json({
        message: "Success",
        data: datas?.rows,
      });
    } else {
      res.status(404).json({
        error: "Pengguna Sudah Ada",
      });
    }
  } catch (error) {
    res.status(500).json({
      error: "Gagal Menyimpan",
    });
  }
};

// Reset Password
exports.resetPassword = async (req, res, next) => {
  const { userName, password } = req.body;
  try {
    const datas = await db.pool.query(`
      UPDATE public."User"
        SET password = '${password}'
      WHERE "userName" = '${userName}';
    `);
    if (datas.rows) {
      res.status(200).json({
        message: "Success",
        data: datas?.rows,
      });
    } else {
      res.status(404).json({
        error: "Pengguna Tidak Ditemukan",
      });
    }
  } catch (error) {
    res.status(500).json({
      error: "Gagal Menyimpan",
    });
  }
};

// User Logout
exports.logout = (req, res, next) => {
  // res.clearCookie("userName");
  // res.clearCookie("password");
  // res.clearCookie("role");
  // res.clearCookie("id");
  // res.redirect("/");
  // return res.end();
};
