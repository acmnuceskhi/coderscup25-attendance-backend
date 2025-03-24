if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const jwt = require('jsonwebtoken');

const VerifyJWT = (req, res, next) => {
    const token = req.cookies.token; 
    if (!token) {
        return res.status(403).json({ msg: "Unauthorized: No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_ADMIN_KEY);
        req.admin = decoded; 
        console.log("Token verified successfully");
        next();
    } catch (error) {
        return res.status(401).json({ msg: "Unauthorized: Invalid token" });
    }
};

module.exports = VerifyJWT;
