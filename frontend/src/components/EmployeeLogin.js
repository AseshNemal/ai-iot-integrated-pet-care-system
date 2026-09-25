import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import hrApi from "../utils/hrApi";
import "../styles/EmployeeLogin.css";

function EmployeeLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await hrApi.post("/employee/login", {
        username,
        password
      });
      
      navigate(response.data.user.role?.toLowerCase() === 'admin' ? '/employee' : '/employee-dashboard');
    } catch (error) {
      console.error("Login error:", error);
      setError(error.response?.data?.error || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="employee-login-container">
      <div className="employee-login-card">
        <div className="employee-login-header">
          <h2>Employee Login</h2>
          <p>Access your dashboard</p>
        </div>
        
        {error && <div className="employee-login-error">{error}</div>}
        
        <form onSubmit={handleSubmit} className="employee-login-form">
          <div className="employee-login-field">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Enter your username"
            />
          </div>
          
          <div className="employee-login-field">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>
          
          <button 
            type="submit" 
            className="employee-login-button"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
        
        <div className="employee-login-footer">
          <p>
            <a href="/login">Customer Login</a> | <a href="/">Return Home</a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default EmployeeLogin;
