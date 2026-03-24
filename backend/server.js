const express = require('express');
const cors = require('cors');
require('dotenv').config();

const  connectDB = require('./config/db');
const chatRoutes = require("./routes/chat.routes");
const faqRoutes = require('./routes/faq.routes');
const authRoutes = require('./routes/auth.routes');
const documentRoutes = require("./routes/document.routes");


const app = express();

//connect to DB
connectDB();


//middlewares
const allowedOrigins = [
    process.env.FRONTEND_URL,
    "http://localhost:5173"
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
    }
}));
app.use(express.json());

app.use("/api",chatRoutes);
app.use("/api",faqRoutes);
app.use("/api",documentRoutes);
app.use("/api/auth",authRoutes);


//test routes
app.get("/",(req,res)=>{
    res.send("AI Support Bot Backend Running");
});

const PORT = process.env.PORT || 5000; 

app.listen(PORT, ()=>{
    console.log(`Server running on port ${PORT}`);
});
