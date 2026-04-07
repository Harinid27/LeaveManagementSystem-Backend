import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import { errorHandler } from "./middleware/errorMiddleware.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true
  })
);
app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/student", studentRoutes);

app.use(errorHandler);

export default app;
