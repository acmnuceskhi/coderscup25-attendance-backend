const CryptoJS = require("crypto-js");

const secretKey = "helloworldwhattt"; 
const coords = { latitude: 24.85685, longitude: 67.26442 };

const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(coords), secretKey).toString();
console.log("Encrypted coordinates:", ciphertext);
