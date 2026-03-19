const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const Conversation = require("../models/conversation.model");
const Message = require("../models/message.model");

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

//route to update profile
router.put("/update-profile", authMiddleware, async(req,res)=>{
    try{
        const { name, email } = req.body;
        const userId = req.user.id;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                message: "Name is required"
            });
        }

        if (!email || email.trim().length === 0) {
            return res.status(400).json({
                message: "Email is required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Prevent duplicate email (except current user)
        const existingUser = await User.findOne({
            email: normalizedEmail,
            _id: { $ne: userId }
        });
        if (existingUser) {
            return res.status(400).json({
                message: "Email is already in use"
            });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { name: name.trim(), email: normalizedEmail },
            { new: true, runValidators: true }
        ).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            message: "Profile updated successfully",
            user
        });

    } catch(error){
        console.error("Failed to update profile:", error);
        res.status(500).json({
            message: "Server Error",
            error: error.message
        });
    }
});

//route to change password
router.put("/change-password", authMiddleware, async(req,res)=>{
    try{
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                message: "Current password and new password are required"
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                message: "New password must be at least 6 characters long"
            });
        }

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                message: "Current password is incorrect"
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await User.findByIdAndUpdate(userId, {
            password: hashedPassword
        });

        res.json({
            message: "Password changed successfully"
        });

    } catch(error){
        console.error("Failed to change password:", error);
        res.status(500).json({
            message: "Server Error",
            error: error.message
        });
    }
});

//route to delete user with cascade deletion
router.delete("/delete", authMiddleware, async(req,res)=>{
    try{
        const userId = req.user.id;

        // Step 1: Find all conversations of this user
        const conversations = await Conversation.find({ userId });
        let deletedMessagesCount = 0;
        
        if (conversations.length > 0) {
            // Step 2: Get all conversation IDs
            const conversationIds = conversations.map(conv => conv._id);

            // Step 3: Delete all messages linked to those conversations
            const messageDeleteResult = await Message.deleteMany({
                conversationId: { $in: conversationIds }
            });

            deletedMessagesCount = messageDeleteResult.deletedCount;
            console.log(`Deleted ${deletedMessagesCount} messages`);

            // Step 4: Delete all conversations
            const conversationDeleteResult = await Conversation.deleteMany({
                userId: userId
            });

            console.log(`Deleted ${conversationDeleteResult.deletedCount} conversations`);
        } else {
            console.log("No conversations found for this user");
        }

        // Step 5: Finally delete the user
        const userDeleteResult = await User.findByIdAndDelete(userId);

        if (!userDeleteResult) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json({
            message: "User and all related data deleted successfully",
            deletedConversations: conversations.length,
            deletedMessages: deletedMessagesCount
        });

    } catch(error){
        console.error("Error during cascade deletion:", error);
        res.status(500).json({
            message: "Server Error",
            error: error.message
        });
    }
});

module.exports = router; 

