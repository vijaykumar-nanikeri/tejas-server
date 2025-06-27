var express = require("express");
var router = express.Router();

const axios = require("axios");
const HttpStatus = require("http-status-codes");

const HttpMethod = require("../config/http.config");
const auth = require("../controllers/auth.controller");

const OPENAI_API_URL = process.env.OPENAI_API_URL;
const OPENAI_MODEL = process.env.OPENAI_MODEL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// AI START >>
router.post("/", auth.verifyAuthToken, async (req, res) => {
  if (!OPENAI_API_URL || !OPENAI_MODEL || !OPENAI_API_KEY) {
    res.send({
      statusCode: HttpStatus.StatusCodes.SERVICE_UNAVAILABLE,
      statusMessage: "OpenAI service is not configured",
    });
  }

  const promptMessage = req.body.promptMessage;
  const inputText = req.body.inputText;

  try {
    const response = await axios({
      method: HttpMethod.POST,
      url: OPENAI_API_URL,
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json", // optional, but explicit
      },
      data: {
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: promptMessage,
          },
          {
            role: "user",
            content: inputText,
          },
        ],
      },
    });

    const content = response?.data?.choices?.[0]?.message?.content || "";

    res.send({
      statusCode: HttpStatus.StatusCodes.OK,
      statusMessage: HttpStatus.ReasonPhrases.OK,
      message: content,
    });
  } catch (error) {
    const statusCode =
      error?.response?.status || HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR;
    const statusMessage =
      error?.response?.data?.error?.message ||
      error.message ||
      HttpStatus.getReasonPhrase(statusCode);

    return res.status(statusCode).json({
      error: true,
      statusCode,
      statusMessage,
    });
  }
});
// << END AI

module.exports = router;
