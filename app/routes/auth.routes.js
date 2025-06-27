var express = require("express");
var router = express.Router();
const bcrypt = require("bcrypt");
const HttpStatus = require("http-status-codes");

const mysql = require("../models/db.model");
const auth = require("../controllers/auth.controller");
const generic = require("../models/generic.model");

const verifyPassword = (req, res, next) => {
  const mobileNo = req.body.mobileNo;

  const query = `
    SELECT id AS userId, password, reset_default_password AS resetDefaultPassword
    FROM tejas_users
    WHERE deactivate = 0 AND mobile_no = ${mobileNo}`;

  mysql.query(query, (error, result) => {
    if (error) {
      console.error("Server-error-verifyPassword: ", error);
      res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR).send({
        statusCode: HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR,
        statusMessage: HttpStatus.ReasonPhrases.INTERNAL_SERVER_ERROR,
      });
    } else {
      if (!result.length) {
        res.status(HttpStatus.StatusCodes.UNAUTHORIZED).send({
          statusCode: HttpStatus.StatusCodes.UNAUTHORIZED,
          statusMessage: HttpStatus.ReasonPhrases.UNAUTHORIZED,
        });
      } else {
        const userId = result[0].userId;

        const password = req.body.password;
        const registeredPassword = result[0].password;
        const isValidPassword = bcrypt.compareSync(
          password,
          registeredPassword
        );

        if (isValidPassword) {
          if (!result[0].resetDefaultPassword) {
            req.userId = userId;
            next();
          } else {
            const q = `
              SELECT
                etu.id AS userId,
                etud.display_name AS name
              FROM
                tejas_users etu,
                tejas_user_details etud
              WHERE etu.id = ${userId} AND etu.id = etud.user_id`;

            mysql.query(q, (err, rs) => {
              if (err) {
                console.error(
                  "Server-error-verifyPassword-isValidPassword: ",
                  err
                );
                res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR).send({
                  statusCode: HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR,
                  statusMessage: HttpStatus.ReasonPhrases.INTERNAL_SERVER_ERROR,
                });
              } else {
                res.send({
                  statusCode: HttpStatus.StatusCodes.RESET_CONTENT,
                  statusMessage: HttpStatus.ReasonPhrases.RESET_CONTENT,
                  data: rs,
                });
              }
            });
          }
        } else {
          res.status(HttpStatus.StatusCodes.UNAUTHORIZED).send({
            statusCode: HttpStatus.StatusCodes.UNAUTHORIZED,
            statusMessage: HttpStatus.ReasonPhrases.UNAUTHORIZED,
          });
        }
      }
    }
  });
};

router.post("/", verifyPassword, (req, res) => {
  const mobileNo = req.body.mobileNo;

  const query = `
    SELECT
      etu.id,
      etu.mobile_no AS mobileNo,
      etud.display_name AS name,
      etuc.id AS userCategoryId,
      etuc.display_name AS userCategory
    FROM
      tejas_users etu,
      tejas_user_categories etuc,
      tejas_user_details etud
    WHERE
      etu.id = ${req.userId} AND etu.deactivate = 0 AND etu.block = 0
      AND etu.user_category_id = etuc.id
      AND etu.id = etud.user_id`;

  mysql.query(query, (error, result) => {
    if (error) {
      console.error("Server-error-verifyPassword: ", error);
      res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR).send({
        statusCode: HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR,
        statusMessage: HttpStatus.ReasonPhrases.INTERNAL_SERVER_ERROR,
      });
    } else {
      const authToken = auth.generateAuthToken(mobileNo);

      mysql.query(`
        UPDATE tejas_users
        SET
          last_logged_on = CURRENT_TIMESTAMP,
          visiting_count = IF(visiting_count > 0, visiting_count + 1, 1)
        WHERE id = ${req.userId}`);

      res.send({
        statusCode: HttpStatus.StatusCodes.OK,
        statusMessage: HttpStatus.ReasonPhrases.OK,
        authToken: authToken,
        data: result,
      });
    }
  });
});

module.exports = router;
