const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const express = require('express');
const cookieParser = require('cookie-parser');
const { Admin } = require('../models/Models');

const router = express.Router();
router.use(cookieParser());

router.post("/register", async (req, res) => {
    const { username, password } = req.body;
  
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new Admin({ UserName: username, Password: hashedPassword });
  
    await admin.save();
    res.json({ msg: "Admin created successfully!" });
  });

  
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log("username: ", username);
        console.log("password: ", password);
        const admin = await Admin.findOne({ UserName: username });

        if (!admin) {
            return res.status(401).json({ msg: "Incorrect user name" });
        }

        const validPassword = await bcrypt.compare(password, admin.Password);
        if (!validPassword) {
            return res.status(401).json({ msg: "Incorrect password" });
        }

        const accessToken = jwt.sign(
            { userID: admin._id, adminUserName: admin.UserName },
            process.env.JWT_ADMIN_KEY,
            { expiresIn: "1h" }
        );
        console.log(accessToken);
        res.cookie('token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // Always true in production
            sameSite: process.env.NODE_ENV === "production" ? "None" : "Strict",
            maxAge: 60 * 60 * 1000, // 1 hour
        });
        console.log(`${admin.UserName} login succesfully`);
        res.json({ msg: "Login successful" });

    } catch (error) {
        console.error(error.message);
        res.status(500).json({ msg: "Server error" });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: "None",
    });
    console.log('Log out succesful');
    res.json({ msg: "Logged out successfully" });
});

router.get('/status', async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ msg: "Unauthorized" });
        }
        const decoded = jwt.verify(token, process.env.JWT_ADMIN_KEY);
        res.json({ admin: decoded });
    } catch (error) {
        res.status(401).json({ msg: "Invalid token" });
    }
});

module.exports = router;



