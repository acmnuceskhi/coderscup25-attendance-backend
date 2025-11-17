// password-gen.js
const bcrypt = require('bcrypt');

async function generateHashedPassword(password) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  console.log('Hashed Password:', hashedPassword);
}

generateHashedPassword("helloworld003@");
