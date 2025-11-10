// This file exports the Express app for Vercel serverless functions
// Test if basic serverless function works first
module.exports = (req, res) => {
  res.status(200).send('Hello DevDay25!');
};

