const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

//middlewares
app.use(cors());
app.use(express.json());

//test routes
app.get("/",(req,res)=>{
    res.send("AI Support Bot Backend Running");
});

const PORT = process.env.PORT || 5000; 

app.listen(PORT, ()=>{
    console.log(`Server running on port ${PORT}`);
});
