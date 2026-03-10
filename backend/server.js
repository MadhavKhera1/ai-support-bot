const express = require('express');
const cors = require('cors');
require('dotenv').config();

const  connectDB = require('./config/db');
const chatRoutes = require("./routes/chat.routes");

const app = express();

//connect to DB
connectDB();


//middlewares
app.use(cors());
app.use(express.json());

app.use("/api",chatRoutes);


//test routes
app.get("/",(req,res)=>{
    res.send("AI Support Bot Backend Running");
});

const PORT = process.env.PORT || 5000; 

app.listen(PORT, ()=>{
    console.log(`Server running on port ${PORT}`);
});
