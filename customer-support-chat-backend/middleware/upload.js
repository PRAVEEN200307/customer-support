const multer = require("multer");
const multerS3 = require("multer-s3");
const s3 = require("../config/s3");
const { randomUUID } = require("crypto");

const upload = multer({
  storage: multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME,
    // acl: "public-read",
    key: (req, file, cb) => {
      cb(null, `uploads/${randomUUID()}-${file.originalname}`);
    },
  }),
});

module.exports = upload; // ✅ THIS is important
