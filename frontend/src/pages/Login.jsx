import { useState } from "react";
import axios from "axios";

function Login({ setIsLoggedIn }){
    const [email,setEmail]= useState("");
    const [password,setPassword]= useState("");

    const handleLogin = async()=>{
        try{
            const res = await axios.post(
                "http://localhost:5000/api/auth/login",
                {
                    email,
                    password
                }
            );

            //store token
            localStorage.setItem("token",res.data.token);
            setIsLoggedIn(true);

        } catch(error){
            console.error("Login failed", error);
            alert("Invalid credentials");

        }
    };
    return(
        <div className= "auth-container">

            <h2>Login</h2>

            <input
                type="email"
                placeholder="Enter Email"
                value={email}
                onChange={(e)=> setEmail(e.target.value)}
            />

            <input
                type="password"
                placeholder="Enter Password"
                value={password}
                onChange={(e)=> setPassword(e.target.value)}
            />

            <button onClick={handleLogin}>

                Login

            </button>
        </div>
    );
}

export default Login;
