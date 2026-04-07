import { HttpError } from "./httpError.js";

export const requireFields = (payload, fields) => {
  for (const field of fields) {
    if (
      payload[field] === undefined ||
      payload[field] === null ||
      `${payload[field]}`.trim() === ""
    ) {
      throw new HttpError(400, `${field} is required`);
    }
  }
};

export const validateDateRange = (fromDate, toDate) => {
  const from = new Date(fromDate);
  const to = new Date(toDate);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new HttpError(400, "Invalid date range");
  }

  if (from > to) {
    throw new HttpError(400, "fromDate must be before or equal to toDate");
  }
};
