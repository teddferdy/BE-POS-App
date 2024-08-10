import jwt from "jsonwebtoken";
import User from "../db/models/User";

const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET_KEY, {
    expiresIn: process.env.JWT_EXPIRED_IN,
  });
};

exports.getAllUser = async (req, res, next) => {
  // try {
  //   const datas = await db.pool.query(`SELECT * FROM public."User"`);
  //   res.status(200).json({
  //     message: "Get All Data",
  //     data: datas?.rows,
  //   });
  // } catch (error) {
  //   res.status(500).json({
  //     error: "Something went wrong",
  //   });
  // }
};

exports.login = async (req, res, next) => {
  // const { userName, password } = req?.body;
  // try {
  //   const datas = await db.pool.query(
  //     `SELECT * FROM public."User" WHERE "userName" = '${userName}' AND password = '${password}'`
  //   );
  //   if (datas?.rows?.length > 0) {
  //     res.status(200).json({
  //       message: "Success",
  //       data: datas?.rows,
  //     });
  //   } else {
  //     res.status(404).json({
  //       error: "Pengguna Tidak Ditemukan",
  //     });
  //   }
  // } catch (error) {
  //   res.status(500).json({
  //     error: "Server Error",
  //   });
  // }
};

// Register
exports.registerNewUser = async (req, res, next) => {
  const { userName, password, confirmPassword, userType, email } = req.body;

  try {
    if (!["admin", "user"]?.includes(userType)) {
      res.status(400).json({
        message: "Gagal Menyimpan User",
      });
    }

    const createUser = await User.create({
      userName: userName,
      password: password,
      confirmPassword: confirmPassword,
      userType: userType,
      email: email,
      address: "",
      placeDateOfBirth: "",
    });

    const result = createUser.toJSON();
    delete result.password;
    delete result.deletedAt;

    result.token = generateToken({
      id: result.id,
    });

    if (!result) {
      return res.status(400).json({
        message: "Gagal Menyimpan User",
      });
    }

    return res.status(201).json({
      message: "Success Menyimpan User",
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Terjadi Error Server",
    });
  }
};

// Reset Password
exports.resetPassword = async (req, res, next) => {
  // const { userName, password } = req.body;
  // try {
  //   // Check user First
  //   const getUserList = await db.pool.query(
  //     `SELECT * FROM public."User" WHERE "userName" = '${userName}'`
  //   );
  //   if (!getUserList?.rows?.length > 0) {
  //     const datas = await db.pool.query(`
  //       UPDATE public."User"
  //         SET password = '${password}'
  //       WHERE "userName" = '${userName}';
  //     `);
  //     return res.status(200).json({
  //       message: "Success",
  //       data: datas?.rows,
  //     });
  //   } else {
  //     // Error User name has exist
  //     return res.status(500).json({
  //       error: "Gagal Menyimpan, Pengguna tidak tersedia",
  //     });
  //   }
  // } catch (error) {
  //   return res.status(500).json({
  //     error: "Gagal Menyimpan",
  //   });
  // }
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
