import dotenv from "dotenv";
import app from "./app.js";
import { connectDb } from "./config/db.js";

dotenv.config();

const port = process.env.PORT || 5000;

const startServer = async () => {
  await connectDb();
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
};

startServer().catch((error) => {
  console.error("Server startup failed:", error.message);
  process.exit(1);
});
