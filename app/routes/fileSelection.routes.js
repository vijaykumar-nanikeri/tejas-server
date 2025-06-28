const express = require("express");
const router = express.Router();
const HttpStatus = require("http-status-codes");
const multer = require("multer");
const axios = require("axios");
const mammoth = require("mammoth");

const HttpMethod = require("../config/http.config");
const auth = require("../controllers/auth.controller");

// Multer setup – stores files in memory
const upload = multer({ storage: multer.memoryStorage() });

// Environment configs
const { OPENAI_API_URL, OPENAI_MODEL, OPENAI_API_KEY } = process.env;

// Call OpenAI API
const openApi = async (res, content) => {
  if (!OPENAI_API_URL || !OPENAI_MODEL || !OPENAI_API_KEY) {
    return res.status(HttpStatus.StatusCodes.SERVICE_UNAVAILABLE).send({
      statusCode: HttpStatus.StatusCodes.SERVICE_UNAVAILABLE,
      statusMessage: "OpenAI service is not configured",
    });
  }

  const promptMessage =
    "Give me formatted text from the content. convert text to upper case";

  try {
    const response = await axios({
      method: HttpMethod.POST,
      url: OPENAI_API_URL,
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      data: {
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: promptMessage },
          { role: "user", content },
        ],
      },
    });

    const result = response?.data?.choices?.[0]?.message?.content || "";

    return res.status(HttpStatus.StatusCodes.OK).send({
      statusCode: HttpStatus.StatusCodes.OK,
      statusMessage: HttpStatus.ReasonPhrases.OK,
      message: result,
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
};

// Upload endpoint
router.post(
  "/plainText",
  auth.verifyAuthToken,
  upload.array("files", 10),
  (req, res) => {
    const { files } = req;

    if (!files || files.length === 0) {
      return res.status(HttpStatus.StatusCodes.BAD_REQUEST).send({
        statusMessage: HttpStatus.ReasonPhrases.BAD_REQUEST,
        message: "No files uploaded",
      });
    }

    // Combine uploaded file content (assumes plain text files)
    let combinedContent = "";
    files.forEach((file) => {
      combinedContent += file.buffer.toString("utf-8") + "\n";
    });

    openApi(res, combinedContent);
  }
);

router.post(
  "/docx",
  auth.verifyAuthToken,
  upload.array("files", 10),
  async (req, res) => {
    const { files } = req;

    if (!files || files.length === 0) {
      return res.status(HttpStatus.StatusCodes.BAD_REQUEST).send({
        statusMessage: HttpStatus.ReasonPhrases.BAD_REQUEST,
        message: "No files uploaded",
      });
    }

    try {
      let combinedContent = "";

      for (const file of files) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        combinedContent += result.value + "\n";
      }

      openApi(res, combinedContent);
    } catch (error) {
      console.error("Error processing DOCX:", error);

      return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR).send({
        statusMessage: HttpStatus.ReasonPhrases.INTERNAL_SERVER_ERROR,
        message: "Failed to process DOCX file",
      });
    }
  }
);

module.exports = router;
