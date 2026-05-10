const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signToken } = require("../lib/auth");

const router = express.Router();

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Validate role
    if (role !== "patient" && role !== "staff") {
      return res.status(400).json({ error: "Role must be patient or staff" });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    // Return user without password
    res.status(201).json({
      message: "Registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user with password field
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Sign JWT
    const token = signToken({ id: user._id, role: user.role });

    // Cookie settings differ between local dev and production.
    // In production (Render + Netlify) the cookie must be secure and
    // sameSite: 'none' so it works across different domains.
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
    });

    // Return user without password and include token for API testing
    res.status(200).json({
      message: "Login successful",
      token: token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie("token", {
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  });
  res.status(200).json({ message: "Logged out" });
});

module.exports = router;
