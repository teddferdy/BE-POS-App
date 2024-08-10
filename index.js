const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

// Routes
const homeRoutes = require("./routes/home");
const authRoutes = require("./routes/auth");

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use("/auth", authRoutes);

app.use("/product", homeRoutes);

app.listen(process.env.POSTGRES_PORT || 5000, () => {
  console.log("server running port 5000");
});
