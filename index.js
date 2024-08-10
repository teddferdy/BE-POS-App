import express from "express";
import bodyParser from "body-parser";
import cors from "cors";

// Routes
// import homeRoutes from "./routes/home";
import authRoutes from "./routes/auth";

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use("/auth", authRoutes);

// app.use("/product", homeRoutes);

app.listen(process.env.POSTGRES_PORT || 5000, () => {
  console.log("server running port 5000");
});
