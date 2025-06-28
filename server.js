var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var cors = require("cors");
require("dotenv").config();

var app = express();

var corsOptions = {
  origin: [
    // CORS whitelist for local
    "http://localhost:8080",
  ],
  preflightContinue: false,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

var appRouter = require("./app/routes/app.routes");
var authRouter = require("./app/routes/auth.routes");
var usersRouter = require("./app/routes/users.routes");
var aiRouter = require("./app/routes/ai.routes");
var fileSelectionRouter = require("./app/routes/fileSelection.routes");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "bin/src")));

app.use("/app", appRouter);
app.use("/login", authRouter);
app.use("/users", usersRouter);
app.use("/ai", aiRouter);
app.use("/fileSelection", fileSelectionRouter);

module.exports = app;
