import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { HttpError } from "../utils/httpError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDirectory = path.resolve(__dirname, "../../uploads/leave-proofs");

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "");
    const safeName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const dest = path.resolve(uploadDirectory, safeName);
    if (!dest.startsWith(uploadDirectory)) {
      return cb(new HttpError(400, "Invalid file path"));
    }
    cb(null, safeName);
  }
});

const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg"
];

const fileFilter = (_req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new HttpError(400, "Only PDF, JPG, and PNG files are allowed"));
  }

  cb(null, true);
};

const multerUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

// CSV Upload configuration
const csvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const csvDir = path.resolve(__dirname, "../../uploads/temp-csv");
    if (!fs.existsSync(csvDir)) {
      fs.mkdirSync(csvDir, { recursive: true });
    }
    cb(null, csvDir);
  },
  filename: (_req, file, cb) => {
    cb(null, `import-${Date.now()}-${file.originalname}`);
  }
});

const csvFileFilter = (_req, file, cb) => {
  if (file.mimetype !== "text/csv" && !file.originalname.endsWith(".csv")) {
    return cb(new HttpError(400, "Only CSV files are allowed"));
  }
  cb(null, true);
};

const csvMulter = multer({
  storage: csvStorage,
  fileFilter: csvFileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit for CSV
});

export const uploadLeaveProof = multerUpload.single("proofFile");
export const uploadCSV = csvMulter.single("file");
