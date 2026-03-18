const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const User = require("../models/user.model");

const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/auth.middleware");

//Sign Up API
router.post("/signup", async(req,res)=>{
    try{
        const {name, email, password} = req.body;

        // check if user already exists
        const existingUser = await User.findOne({ email });

        if(existingUser){
            return res.status(400).json({
                message: "User already registered"
            });
        }

        //hash password
        const hashedPassword = await bcrypt.hash(password,10);

        const user = new User({
            name,
            email,
            password: hashedPassword
        });

        await user.save();

        res.json({
            message: "User Registered Successfully"
        });

    } catch(error){
        console.error(error);
        res.status(500).json({
            message: "Server Error"
        });
    }
});

//Login API
router.post("/login", async(req,res)=>{
    try{
        const { email, password} = req.body;

        //check if user exists
        const user = await User.findOne({email});

        if(!User){
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        //compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        //generate a JWT token
        const token = jwt.sign(
            {id: user._id},
            process.env.JWT_SECRET,
            {expiresIn: "7d"}
        );

        res.json({
            token,
            user:{
                id:user._id,
                name:user.name,
                email:user.email
            }
        });
    } catch(error){
        console.error(error);

        res.status(500).json({
            message: "Server Error"
        });
    }
    
});

//route to get user details
router.get("/me", authMiddleware, async(req,res)=>{
    try{
        const user = await User.findById(req.user.id).select("-password");
        res.json(user);
    } catch(error){
        console.error(error);
        res.status(500).json({
            error: "Server Error"
        });
    }
});

module.exports = router; 

