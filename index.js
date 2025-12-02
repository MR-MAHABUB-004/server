const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const multer = require("multer");

// ------------------ AUTO NPM INSTALL ------------------
const installedFlag = path.join(__dirname, ".installed");
if (!fs.existsSync(installedFlag)) {
  console.log("🚀 Running npm install...");
  try {
    execSync("npm install", { stdio: "inherit" });
    fs.writeFileSync(installedFlag, "done");
    console.log("✅ npm install completed!");
  } catch (err) {
    console.error("❌ npm install failed:", err);
  }
}

// ------------------ EXPRESS SETUP ------------------
const app = express();
app.use(cors());
app.use(express.static("public"));

// ------------------ UPLOADS FOLDER ------------------
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// ------------------ MULTER STORAGE ------------------
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const unique = Date.now() + "_" + file.originalname;
    cb(null, unique);
  }
});
const upload = multer({ storage });

// ------------------ HOME PAGE ------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ------------------ URL UPLOAD ------------------
app.get("/upload", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.json({ error: "Missing ?url=" });

    const filename = Date.now() + "_" + path.basename(url);
    const filePath = path.join(__dirname, "uploads", filename);

    const writer = fs.createWriteStream(filePath);
    const { data } = await axios({ url, method: "GET", responseType: "stream" });

    data.pipe(writer);

    writer.on("finish", () => {
      return res.json({
        status: "success",
        file: filename,
        stream: `${req.protocol}://${req.get("host")}/stream/${filename}`
      });
    });

    writer.on("error", (err) => {
      return res.json({ error: err.message });
    });
  } catch (err) {
    return res.json({ error: err.message });
  }
});

// ------------------ DRAG & MANUAL FILE UPLOAD ------------------
app.post("/uploadfile", upload.single("file"), (req, res) => {
  if (!req.file) return res.json({ error: "No file received!" });

  return res.json({
    status: "success",
    file: req.file.filename,
    stream: `${req.protocol}://${req.get("host")}/stream/${req.file.filename}`
  });
});

// ------------------ STREAM FILE ------------------
app.get("/stream/:file", (req, res) => {
  const file = req.params.file;
  const filePath = path.join(__dirname, "uploads", file);
  if (!fs.existsSync(filePath)) return res.json({ error: "File not found" });

  res.sendFile(filePath);
});

// ------------------ SERVER START ------------------
const PORT = process.env.PORT || 24732;
app.listen(PORT, () => console.log(`🔥 SERVER RUNNING on PORT ${PORT}`));
