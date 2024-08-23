import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import uploadRouter from "./routes/upload.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public"));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.sendFile(path.join("public", "index.html"));
});

app.use("/upload", uploadRouter);