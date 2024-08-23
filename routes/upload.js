import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import unzipper from "unzipper";
import dotenv from "dotenv";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { handleFileEntry } from "../utils/fileHandler.js";
import { runWorker } from "../utils/runWorker.js";

dotenv.config();

const router = express.Router();
const UPLOAD_DIR = process.env.UPLOAD_DIR;
const MAX_WORKERS = os.cpus().length;
const MAX_RETRIES = 3;
const TIMEOUT = 30000;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  const filetypes = /zip/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    cb(null, true);
  } else {
    cb(new Error("Only .zip files are allowed!"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 },
}).single("archive");

const clearUploads = () => {
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.rm(
        path.join(UPLOAD_DIR, file),
        { recursive: true, force: true },
        (err) => {
          if (err) throw err;
        }
      );
    }
  });
};

const processArchive = async (tempDir, htmlFiles) => {
  const chunkSize = Math.ceil(htmlFiles.length / MAX_WORKERS);
  const chunks = [];
  for (let i = 0; i < htmlFiles.length; i += chunkSize) {
    chunks.push(htmlFiles.slice(i, i + chunkSize));
  }

  const workerPromises = chunks.map((chunk) =>
    runWorker({
      tempDir,
      entryFiles: chunk,
      action: "renderPages",
    })
  );

  const results = await Promise.all(workerPromises);
  return results.flat();
};

router.post("/", (req, res) => {
  console.log("Starting file upload...");
  upload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error("Multer error:", err.message);
      res.status(500).send("Error uploading file: " + err.message);
    } else if (err) {
      console.error("Validation error:", err.message);
      res.status(400).send("Error validating file: " + err.message);
    } else {
      if (req.file && req.file.originalname) {
        console.log("File uploaded:", req.file.originalname);
        const filePath = path.join(UPLOAD_DIR, req.file.originalname);
        const tempDir = path.join(UPLOAD_DIR, uuidv4());

        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        fs.createReadStream(filePath)
          .pipe(unzipper.Parse())
          .on("entry", async function (entry) {
            console.log("Processing entry:", entry.path);
            await handleFileEntry(entry, tempDir);
          })
          .on("close", async () => {
            console.log("Unzipping completed.");
            try {
              const htmlFiles = await runWorker({
                tempDir,
                action: "findHtmlFiles",
              });

              console.log("HTML files found:", htmlFiles);

              let attempts = 0;
              let success = false;
              let results;
              let startTime;

              while (attempts < MAX_RETRIES && !success) {
                attempts++;
                startTime = Date.now();
                console.log(`Attempt ${attempts} of ${MAX_RETRIES}`);

                try {
                  const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(
                      () => reject(new Error("Rendering timeout")),
                      TIMEOUT
                    )
                  );
                  results = await Promise.race([
                    processArchive(tempDir, htmlFiles),
                    timeoutPromise,
                  ]);
                  success = true;
                  const elapsedTime = (Date.now() - startTime) / 1000;
                  console.log(
                    `Rendering completed in ${elapsedTime.toFixed(
                      2
                    )} seconds on attempt ${attempts}`
                  );
                } catch (error) {
                  const elapsedTime = (Date.now() - startTime) / 1000;
                  console.error(
                    `Attempt ${attempts} failed after ${elapsedTime.toFixed(
                      2
                    )} seconds:`,
                    error.message
                  );
                  if (attempts === MAX_RETRIES) {
                    throw error;
                  }
                }
              }

              res.json({
                screenshots: results,
                attempts,
                elapsedTime: (Date.now() - startTime) / 1000,
              });
            } catch (error) {
              console.error("Processing failed:", error.message);
              res.status(500).send("Processing failed");
            } finally {
              clearUploads();
            }
          });
      } else {
        console.error("No file received.");
        res.status(400).send("File upload failed: No file received");
      }
    }
  });
});

export default router;
