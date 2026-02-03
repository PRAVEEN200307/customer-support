const { S3Client } = require("@aws-sdk/client-s3");

const s3Config = {
  region: process.env.AWS_REGION,
};

// Only add credentials if explicitly provided in environment
// Otherwise, the SDK will use the default credential provider chain (e.g., EC2 IAM Role)
// if (process.env.AWS_ACCESS_KEY && process.env.AWS_SECRET_KEY) {
//   s3Config.credentials = {
//     accessKeyId: process.env.AWS_ACCESS_KEY,
//     secretAccessKey: process.env.AWS_SECRET_KEY,
//   };
// }

const s3 = new S3Client(s3Config);

module.exports = s3;
