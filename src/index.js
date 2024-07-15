import express from "express";
import bodyParser from "body-parser";
import path from "path";
import cors from "cors";

// Routes
// import homeRoutes from "./routes/home";

// Error Controller

const app = express();

const whitelist = ["*"];

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use((req, res, next) => {
  const origin = req.get("referer");
  const isWhitelisted = whitelist.find((w) => origin && origin.includes(w));
  if (isWhitelisted) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS, PUT, PATCH, DELETE"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "X-Requested-With,Content-Type,Authorization"
    );
    res.setHeader("Access-Control-Allow-Credentials", true);
  }
  // Pass to next layer of middleware
  if (req.method === "OPTIONS") res.sendStatus(200);
  else next();
});

const setContext = (req, res, next) => {
  if (!req.context) req.context = {};
  next();
};
app.use(setContext);

// Set EJS
// app.set("view engine", "ejs");
// app.set("views", "./views");
// app.use(express.static(path.join(__dirname, "public")));
app.use("/assets", express.static("assets"));

app.use("/home", (req, res, next) => {
  res.status(200).send("HELLo");
});

app.listen(process.env.POSTGRES_PORT || 5000, () => {
  console.log("server running port 5000");
});
