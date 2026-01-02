const fs = require("fs");
const path = require("path");
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const multer = require("multer");

/* ================== BASIC SETUP ================== */
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 24732;

/* ================== STORAGE ================== */
const UPLOAD_DIR = path.join(__dirname, "uploads");
const MAP_FILE = path.join(__dirname, "map.json");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(MAP_FILE)) fs.writeFileSync(MAP_FILE, "{}");

/* ================== UTILS ================== */
function loadMap() {
  return JSON.parse(fs.readFileSync(MAP_FILE));
}

function saveMap(map) {
  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));
}

function generateShortId() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function generateUniqueShortId(map) {
  let id;
  do {
    id = generateShortId();
  } while (map[id]);
  return id;
}

/* ================== MULTER ================== */
const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  }
});
const upload = multer({ storage });

/* ================== HOME ================== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ================== URL UPLOAD ================== */
app.get("/upload", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.json({ error: "Missing ?url=" });

    const filename = Date.now() + "_" + path.basename(url);
    const filePath = path.join(UPLOAD_DIR, filename);

    const response = await axios({
      url,
      method: "GET",
      responseType: "stream"
    });

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    writer.on("finish", () => {
      const map = loadMap();
      const shortId = generateUniqueShortId(map);

      map[shortId] = filename;
      saveMap(map);

      res.json({
        status: "success",
        short: shortId,
        stream: `${req.protocol}://${req.get("host")}/mahabub/${shortId}.mp4`
      });
    });

    writer.on("error", err => {
      res.json({ error: err.message });
    });

  } catch (err) {
    res.json({ error: err.message });
  }
});

/* ================== FILE UPLOAD ================== */
app.post("/uploadfile", upload.single("file"), (req, res) => {
  if (!req.file) return res.json({ error: "No file uploaded" });

  const map = loadMap();
  const shortId = generateUniqueShortId(map);

  map[shortId] = req.file.filename;
  saveMap(map);

  res.json({
    status: "success",
    short: shortId,
    stream: `${req.protocol}://${req.get("host")}/mahabub/${shortId}.mp4`
  });
});

/* ================== SHORT STREAM ================== */
app.get("/mahabub/:file", (req, res) => {
  const shortId = req.params.file.split(".")[0];
  const map = loadMap();
  const realFile = map[shortId];

  if (!realFile)
    return res.status(404).json({ error: "Invalid or expired link" });

  const filePath = path.join(UPLOAD_DIR, realFile);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "File not found" });

  res.sendFile(filePath);
});

/* ================== START ================== */
app.listen(PORT, () => {
  console.log(`🔥 Server running → http://localhost:${PORT}`);
});
