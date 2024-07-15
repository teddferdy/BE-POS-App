const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const cookieParser = require("cookie-parser");
const { credentials } = require("./config");
const cors = require("cors");

require("dotenv").config({ path: path.resolve(__dirname, ".env") });

// Routes
const homeRoutes = require("./routes/home");

// Error Controller

const app = express();
app.use(cors());
app.use(cookieParser(credentials.secretCookie));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Set EJS
// app.set("view engine", "ejs");
// app.set("views", "./views");
// app.use(express.static(path.join(__dirname, "public")));
app.use("/assets", express.static("assets"));

app.use("/home", homeRoutes);

app.listen(process.env.POSTGRES_PORT || 5000, () => {
  console.log("server running port 5000");
});
