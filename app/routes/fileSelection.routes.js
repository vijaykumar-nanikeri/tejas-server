const express = require("express");
const router = express.Router();
const HttpStatus = require("http-status-codes");
const multer = require("multer");
const axios = require("axios");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");

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

    return res.status(HttpStatus.StatusCodes.OK).send({
      statusCode: HttpStatus.StatusCodes.OK,
      statusMessage: HttpStatus.ReasonPhrases.OK,
      message: combinedContent,
    });
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

      return res.status(HttpStatus.StatusCodes.OK).send({
        statusCode: HttpStatus.StatusCodes.OK,
        statusMessage: HttpStatus.ReasonPhrases.OK,
        message: combinedContent,
      });
    } catch (error) {
      console.error("Error processing DOCX:", error);

      return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR).send({
        statusMessage: HttpStatus.ReasonPhrases.INTERNAL_SERVER_ERROR,
        message: "Failed to process DOCX file",
      });
    }
  }
);

router.post(
  "/pdf",
  auth.verifyAuthToken,
  upload.array("files", 10),
  async (req, res) => {
    const { files } = req;
    docx;

    if (!files || files.length === 0) {
      return res.status(HttpStatus.StatusCodes.BAD_REQUEST).send({
        statusMessage: HttpStatus.ReasonPhrases.BAD_REQUEST,
        message: "No files uploaded",
      });
    }

    try {
      let combinedContent = "";

      for (const file of files) {
        const data = await pdfParse(file.buffer);
        combinedContent += data.text + "\n";
      }

      return res.status(HttpStatus.StatusCodes.OK).send({
        statusCode: HttpStatus.StatusCodes.OK,
        statusMessage: HttpStatus.ReasonPhrases.OK,
        message: combinedContent,
      });
    } catch (error) {
      console.error("Error processing PDF:", error);

      return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR).send({
        statusMessage: HttpStatus.ReasonPhrases.INTERNAL_SERVER_ERROR,
        message: "Failed to process PDF file",
      });
    }
  }
);

// Evidence upload endpoint
router.post(
  "/uploadEvidence",
  auth.verifyAuthToken,
  upload.any(),
  async (req, res) => {
    try {
      const { files } = req;
      const claimsMetadata = req.body.claimsMetadata
        ? JSON.parse(req.body.claimsMetadata)
        : [];

      if (!files || files.length === 0) {
        return res.status(HttpStatus.StatusCodes.BAD_REQUEST).send({
          statusCode: HttpStatus.StatusCodes.BAD_REQUEST,
          statusMessage: HttpStatus.ReasonPhrases.BAD_REQUEST,
          message: "No files uploaded",
        });
      }

      // Process uploaded files and extract content
      const fileContents = [];

      for (const file of files) {
        let content = "";

        try {
          // Extract content based on file type
          if (file.mimetype === "application/pdf") {
            const data = await pdfParse(file.buffer);
            content = data.text;
          } else if (
            file.mimetype ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            file.mimetype === "application/msword"
          ) {
            const result = await mammoth.extractRawText({
              buffer: file.buffer,
            });
            content = result.value;
          } else if (
            file.mimetype.startsWith("text/") ||
            file.mimetype === "application/octet-stream"
          ) {
            content = file.buffer.toString("utf-8");
          } else if (file.mimetype.startsWith("image/")) {
            content = `[Image file: ${file.originalname}] - Size: ${file.size} bytes`;
          } else {
            content = `[Unsupported file type: ${file.mimetype}] - Size: ${file.size} bytes`;
          }

          fileContents.push({
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            content: content,
          });
        } catch (parseError) {
          console.error(`Error parsing file ${file.originalname}:`, parseError);
          fileContents.push({
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            content: `[Error parsing file: ${parseError.message}]`,
          });
        }
      }

      let combinedContent = "";

      fileContents.forEach((file, index) => {
        combinedContent += file.content + "\n";
      });

      return res.status(HttpStatus.StatusCodes.OK).send({
        statusCode: HttpStatus.StatusCodes.OK,
        statusMessage: HttpStatus.ReasonPhrases.OK,
        message: combinedContent,
      });
    } catch (error) {
      console.error("Error processing evidence files:", error);

      return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR).send({
        statusCode: HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR,
        statusMessage: HttpStatus.ReasonPhrases.INTERNAL_SERVER_ERROR,
        message: "Failed to process evidence files",
        error: error.message,
      });
    }
  }
);

// Single claim evidence upload endpoint
router.post(
  "/uploadSingleClaim",
  auth.verifyAuthToken,
  upload.any(),
  async (req, res) => {
    try {
      const { files } = req;
      const claimIndex = req.body.claimIndex;

      if (!files || files.length === 0) {
        return res.status(HttpStatus.StatusCodes.BAD_REQUEST).send({
          statusCode: HttpStatus.StatusCodes.BAD_REQUEST,
          statusMessage: HttpStatus.ReasonPhrases.BAD_REQUEST,
          message: "No files uploaded",
        });
      }

      // Process uploaded files and extract content
      const fileContents = [];

      for (const file of files) {
        let content = "";

        try {
          // Extract content based on file type
          if (file.mimetype === "application/pdf") {
            const data = await pdfParse(file.buffer);
            content = data.text;
          } else if (
            file.mimetype ===
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            file.mimetype === "application/msword"
          ) {
            const result = await mammoth.extractRawText({
              buffer: file.buffer,
            });
            content = result.value;
          } else if (
            file.mimetype.startsWith("text/") ||
            file.mimetype === "application/octet-stream"
          ) {
            content = file.buffer.toString("utf-8");
          } else if (file.mimetype.startsWith("image/")) {
            content = `[Image file: ${file.originalname}] - Size: ${file.size} bytes`;
          } else {
            content = `[Unsupported file type: ${file.mimetype}] - Size: ${file.size} bytes`;
          }

          fileContents.push({
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            content: content,
          });
        } catch (parseError) {
          console.error(`Error parsing file ${file.originalname}:`, parseError);
          fileContents.push({
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            content: `[Error parsing file: ${parseError.message}]`,
          });
        }
      }

      // Log all file contents for single claim
      console.log(`=== SINGLE CLAIM UPLOAD - CLAIM ${claimIndex} ===`);
      console.log("Total files uploaded:", files.length);
      console.log("\n--- FILE CONTENTS ---");

      fileContents.forEach((file, index) => {
        console.log(`\n[${index + 1}] File: ${file.originalName}`);
        console.log(`Type: ${file.mimetype}`);
        console.log(`Size: ${file.size} bytes`);
        console.log("Content:");
        console.log("---START OF CONTENT---");
        console.log(file.content);
        console.log("---END OF CONTENT---");
        console.log(""); // Empty line for separation
      });

      console.log(`=== END OF CLAIM ${claimIndex} UPLOAD ===\n`);

      return res.status(HttpStatus.StatusCodes.OK).send({
        statusCode: HttpStatus.StatusCodes.OK,
        statusMessage: HttpStatus.ReasonPhrases.OK,
        message: `Successfully processed ${files.length} files for claim ${claimIndex}`,
        claimIndex: claimIndex,
        totalFiles: files.length,
        fileDetails: fileContents.map((f) => ({
          name: f.originalName,
          type: f.mimetype,
          size: f.size,
        })),
      });
    } catch (error) {
      console.error("Error processing single claim files:", error);

      return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR).send({
        statusCode: HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR,
        statusMessage: HttpStatus.ReasonPhrases.INTERNAL_SERVER_ERROR,
        message: "Failed to process claim files",
        error: error.message,
      });
    }
  }
);

module.exports = router;
