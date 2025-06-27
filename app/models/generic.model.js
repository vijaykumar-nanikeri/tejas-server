const mysql = require("./db.model");
const HttpStatus = require("http-status-codes");

exports.processName = (name) =>
  name
    ?.toString()
    .toLowerCase()
    .split(" ")
    .filter((s) => s)
    .join("_");

exports.fetchRecords = (res, query) => {
  mysql.query(query, (error, result) => {
    if (error) {
      console.error("Server-error-generic-model: ", error);
      res.send({
        statusCode: HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR,
        statusMessage: HttpStatus.ReasonPhrases.INTERNAL_SERVER_ERROR,
      });
    } else {
      res.send({
        statusCode: HttpStatus.StatusCodes.OK,
        statusMessage: HttpStatus.ReasonPhrases.OK,
        data: result,
      });
    }
  });
};
