const jwt = require("jsonwebtoken");
const HttpStatus = require("http-status-codes");

exports.generateAuthToken = (mobileNo) => {
  return jwt.sign(
    {
      mobileNo: mobileNo,
    },
    process.env.AUTH_TOKEN_SECRET,
    {
      expiresIn: process.env.AUTH_TOKEN_TIME_LIMIT,
    }
  );
};

exports.verifyAuthToken = (req, res, next) => {
  if (req?.headers?.authorization?.split(" ")[0] === "Bearer") {
    jwt.verify(
      req.headers.authorization.split(" ")[1],
      process.env.AUTH_TOKEN_SECRET,
      (error) => {
        if (error) {
          res.status(HttpStatus.StatusCodes.FORBIDDEN).send({
            statusCode: HttpStatus.StatusCodes.FORBIDDEN,
            statusMessage: HttpStatus.ReasonPhrases.FORBIDDEN,
          });
        } else {
          next();
        }
      }
    );
  } else {
    res.status(HttpStatus.StatusCodes.BAD_GATEWAY).send({
      statusCode: HttpStatus.StatusCodes.BAD_GATEWAY,
      statusMessage: HttpStatus.ReasonPhrases.BAD_GATEWAY,
    });
  }
};
