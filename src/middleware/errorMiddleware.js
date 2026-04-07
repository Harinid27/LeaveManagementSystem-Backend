import { HttpError } from "../utils/httpError.js";

export const errorHandler = (error, _req, res, _next) => {
  if (error.name === "MulterError") {
    return res.status(400).json({ message: error.message });
  }

  if (error?.code === 11000) {
    const duplicateField = Object.keys(error.keyPattern || {})[0] || "field";
    return res.status(409).json({
      message: `${duplicateField} already exists`
    });
  }

  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const message = error.message || "Something went wrong";

  if (statusCode === 500) {
    console.error(error);
  }

  res.status(statusCode).json({ message });
};
