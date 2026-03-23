import { useEffect, useState } from "react";
import axios from "axios";
import Signup from "./Signup";

function Login({ setIsLoggedIn }) {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showSignup, setShowSignup] = useState(false);
  const [mode, setMode] = useState("login");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("resetToken");

    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setMode("reset");
      setInfoMessage("Reset link opened. Set your new password below.");
    }
  }, []);

  if (showSignup) {
    return (
      <Signup
        setIsLoggedIn={setIsLoggedIn}
        goToLogin={() => setShowSignup(false)}
      />
    );
  }

  const resetMessages = () => {
    setInfoMessage("");
    setErrorMessage("");
  };

  const handleLogin = async () => {
    resetMessages();

    try {

      const res = await axios.post(
        "http://localhost:5000/api/auth/login",
        { email, password }
      );

      localStorage.setItem("token", res.data.token);

      setIsLoggedIn(true);

    } catch (error) {

      console.error(error);
      setErrorMessage(error.response?.data?.message || "Invalid credentials");

    }

  };

  const handleForgotPassword = async () => {
    resetMessages();

    if (!email.trim()) {
      setErrorMessage("Enter your email first.");
      return;
    }

    try {
      const res = await axios.post("http://localhost:5000/api/auth/forgot-password", {
        email
      });

      setInfoMessage(res.data.message || "If an account exists, a reset link has been sent.");
    } catch (error) {
      console.error(error);
      setErrorMessage(error.response?.data?.message || "Failed to start password reset.");
    }
  };

  const handleResetPassword = async () => {
    resetMessages();

    if (!resetToken.trim()) {
      setErrorMessage("Reset token is required.");
      return;
    }

    if (!newPassword || !confirmPassword) {
      setErrorMessage("Enter and confirm your new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      const res = await axios.post("http://localhost:5000/api/auth/reset-password", {
        token: resetToken.trim(),
        newPassword
      });

      setInfoMessage(res.data.message || "Password reset successfully. You can log in now.");
      setMode("login");
      setPassword("");
      setResetToken("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error(error);
      setErrorMessage(error.response?.data?.message || "Failed to reset password.");
    }
  };

  const backToLogin = () => {
    resetMessages();
    setMode("login");
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="auth-wrapper">
      <h1 className="auth-heading">
        <span className="auth-brand-name">Actio AI</span>
        <span className="auth-brand-tagline">Act. Think. Execute.</span>
      </h1>
      <div className="auth-card">

        <h2 className="auth-title">
          {mode === "login" ? "Login" : mode === "forgot" ? "Forgot Password" : "Reset Password"}
        </h2>

        {infoMessage && <div className="auth-feedback auth-feedback-success">{infoMessage}</div>}
        {errorMessage && <div className="auth-feedback auth-feedback-error">{errorMessage}</div>}

        {mode === "login" && (
          <>
            <input
              type="email"
              placeholder="Enter email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button onClick={handleLogin}>
              Login
            </button>

            <button type="button" className="auth-link-btn" onClick={() => {
              resetMessages();
              setMode("forgot");
            }}>
              Forgot password?
            </button>

            <p className="auth-switch">
              Don't have an account?{" "}
              <span onClick={() => setShowSignup(true)}>
                Signup
              </span>
            </p>
          </>
        )}

        {mode === "forgot" && (
          <>
            <input
              type="email"
              placeholder="Enter your registered email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <button onClick={handleForgotPassword}>
              Send Reset Link
            </button>

            <button type="button" className="auth-link-btn" onClick={() => {
              resetMessages();
              setMode("reset");
            }}>
              Already have a reset token?
            </button>

            <button type="button" className="auth-link-btn secondary" onClick={backToLogin}>
              Back to login
            </button>
          </>
        )}

        {mode === "reset" && (
          <>
            <input
              type="text"
              placeholder="Paste reset token"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
            />

            <input
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <button onClick={handleResetPassword}>
              Reset Password
            </button>

            <button type="button" className="auth-link-btn secondary" onClick={backToLogin}>
              Back to login
            </button>
          </>
        )}

      </div>
    </div>
  );
}

export default Login;
