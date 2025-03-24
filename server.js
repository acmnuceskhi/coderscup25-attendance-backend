require('dotenv').config()
const express = require('express')
const cookieParser = require('cookie-parser');
const cors= require('cors')
const mongoose= require('mongoose')

const VerifyJWT = require('./middleware/AuthJWT');
const authRoutes= require('./routes/authRoutes');
const adminRoutes= require('./routes/adminRoutes');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({
    origin: "http://localhost:5173", // Frontend URL
    credentials: true, // Allow credentials (cookies, authorization headers)
}));

app.get('/', (req, res) => {
  res.send('Hello World!');
})

app.use('/api/auth', authRoutes);
app.use('/api/admin', VerifyJWT,adminRoutes);
// app.use('/api/results', resultsRoutes);

mongoose.connect(process.env.MONGO_URI)
.then(()=>{
    app.listen(process.env.PORT, ()=>{
        console.log('Connected and listening to requests on', process.env.PORT)
    })
})
.catch((error)=>{
    console.log(error)
})