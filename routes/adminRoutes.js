const { default: mongoose, MongooseError } = require('mongoose')
const {Admin}= require('../models/Models')
const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

router.post('/attendanceMark', (req, res)=>{

});

router.get('/', (req, res)=>{
    res.json({'msg': 'Admin routes'})
});

router.post('/register', async (req, res) =>{
    const {username, password}= req.body

    if(!username || !password)
        return res.status(404).json({error:'User name or password missing', emptyFields})

    const salt = await bcrypt.genSalt();
    const bcryptPassword = await bcrypt.hash(password, salt);

    console.log(username, bcryptPassword)

    try{
        const admin= await Admin.create({UserName: username, Password: bcryptPassword });
        res.status(200).json(admin)
    }
    catch(e){
        res.status(400).json({error: e.message})
    }
});

module.exports = router;


// Attendance (PR portal):
// /attendanceUpdate
// /updatetime

// Results:
// /WinnerUpdate
// /WinneeSet