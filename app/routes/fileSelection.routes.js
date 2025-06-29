const express = require("express");
const router = express.Router();
const HttpStatus = require("http-status-codes");
const multer = require("multer");
const axios = require("axios");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const path = require("path");
const fs = require("fs");

const HttpMethod = require("../config/http.config");
const auth = require("../controllers/auth.controller");

// Multer setup – stores files in memory
const upload = multer({ storage: multer.memoryStorage() });

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer setup for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const fileUpload = multer({ storage: storage });

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
  fileUpload.any(),
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

      // Process uploaded files
      const uploadedFiles = files.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
      }));

      // Log the upload details
      console.log("Evidence upload details:", {
        totalFiles: files.length,
        claimsMetadata: claimsMetadata,
        uploadedFiles: uploadedFiles.map((f) => f.originalName),
      });

      return res.status(HttpStatus.StatusCodes.OK).send({
        statusCode: HttpStatus.StatusCodes.OK,
        statusMessage: HttpStatus.ReasonPhrases.OK,
        message: `Successfully uploaded ${files.length} evidence files`,
        uploadedFiles: uploadedFiles.map((f) => f.filename),
        totalFiles: files.length,
        claimsProcessed: claimsMetadata.length,
      });
    } catch (error) {
      console.error("Error uploading evidence files:", error);

      return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR).send({
        statusCode: HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR,
        statusMessage: HttpStatus.ReasonPhrases.INTERNAL_SERVER_ERROR,
        message: "Failed to upload evidence files",
        error: error.message,
      });
    }
  }
);

// Single claim evidence upload endpoint
router.post(
  "/uploadSingleClaim",
  auth.verifyAuthToken,
  fileUpload.any(),
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

      // Process uploaded files
      const uploadedFiles = files.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
      }));

      console.log(`Single claim upload - Claim ${claimIndex}:`, {
        files: uploadedFiles.map((f) => f.originalName),
      });

      return res.status(HttpStatus.StatusCodes.OK).send({
        statusCode: HttpStatus.StatusCodes.OK,
        statusMessage: HttpStatus.ReasonPhrases.OK,
        message: `Successfully uploaded ${files.length} files for claim ${claimIndex}`,
        uploadedFiles: uploadedFiles.map((f) => f.filename),
        claimIndex: claimIndex,
      });
    } catch (error) {
      console.error("Error uploading single claim files:", error);

      return res.status(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR).send({
        statusCode: HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR,
        statusMessage: HttpStatus.ReasonPhrases.INTERNAL_SERVER_ERROR,
        message: "Failed to upload claim files",
        error: error.message,
      });
    }
  }
);

module.exports = router;
