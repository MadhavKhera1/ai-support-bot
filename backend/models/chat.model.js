const mongoose = require('mongoose');
const chatSchema = new mongoose.Schema({
    userMessage:{
        type: String,
        required: true
    },
    botResponse:{
        type: String,
        required: true
    },
    needsHumanSupport:{
        type: String,
        default: false
    }
}, {timestamps:true});

const Chat = mongoose.model("Chat",chatSchema);

module.exports = Chat;

