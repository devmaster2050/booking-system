const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const db = require("../db/database");
const nodemailer = require("nodemailer");

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Register User
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { firstname, lastname, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 12);
    const verificationToken = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    const query = `
            INSERT INTO users (firstname, lastname, email, password, verification_token) 
            VALUES (?, ?, ?, ?, ?)
        `;
    db.run(
      query,
      [firstname, lastname, email, hashedPassword, verificationToken],
      function (err) {
        if (err) {
          console.error(err.message);
          return res.status(500).json({ error: "Registration failed." });
        }

        // Send verification email
        const verificationUrl = `${process.env.CLIENT_URL}/api/users/verify/${verificationToken}`;
        // const verificationUrl = `http://localhost:3000/api/users/verify/${verificationToken}`;
        transporter.sendMail({
          from: process.env.EMAIL,
          to: email,
          subject: "Verify Your Account",
          html: `<p>Please verify your email by clicking <a href="${verificationUrl}">here</a>.</p>`,
        });
        console.log("After transporter");

        res.status(201).json({
          message: "Registration successful. Please verify your email.",
        });
      }
    );
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Server error." });
  }
};

// Email Verification
exports.verifyEmail = (req, res) => {
  const { token } = req.params;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const query = `
            UPDATE users SET is_verified = 1, verification_token = NULL WHERE email = ?
        `;

    db.run(query, [decoded.email], function (err) {
      if (err) {
        console.error(err.message);
        return res.status(500).json({ error: "Verification failed." });
      }
      if (this.changes === 0) {
        return res.status(400).json({ error: "Invalid or expired token." });
      }
      res.status(200).json({ message: "Email verified successfully." });
    });
  } catch (error) {
    console.error(error.message);
    res.status(400).json({ error: "Invalid or expired token." });
  }
};

// Login User
exports.login = (req, res) => {
  const { email, password } = req.body;

  const query = `SELECT * FROM users WHERE email = ?`;

  db.get(query, [email], async (err, user) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: "Login failed." });
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    if (!user.is_verified) {
      return res.status(403).json({ error: "Email not verified." });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2d" }
    );

    // Send token and user details to the frontend
    res.json({
      token: "Bearer " + token,
      user: {
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
      },
    });
  });
};

// Check Authenticated User
exports.checkAuthenticated = (req, res) => {
  console.log("token: ", req.body.token);
  const token = req.body.token.split(" ")[1];
  console.log("token: ", token);
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const { id, iat, exp } = decoded;

  console.log("id: ", id);
  const query = `SELECT * FROM users WHERE id = ?`;
  console.log("query: ", query);

  db.get(query, [id], async (err, user) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: "Login failed." });
    }

    if (iat - exp >= 0) {
      return res.status(400).json({ error: "Invalid or expired token." });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "2d" }
    );

    // Send token and user details to the frontend
    res.json({
      token: "Bearer " + token,
      user: {
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
      },
    });
  }); //*/
};

// Forgot Password
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  // Check if the user exists
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err || !user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Generate reset token (expires in 1 hour)
    const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
      expiresIn: "2d",
    });

    // Store token in the database
    db.run(
      `UPDATE users SET reset_token = ? WHERE id = ?`,
      [resetToken, user.id],
      (err) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Failed to store reset token." });
        }

        // Send email with reset link
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL,
            pass: process.env.EMAIL_PASSWORD,
          },
        });

        const resetLink = `${process.env.CLIENT_URL}/reset-password.html?token=${resetToken}`;

        // const resetLink = `http://localhost:3000/reset-password.html?token=${resetToken}`;
        const mailOptions = {
          from: process.env.EMAIL,
          to: email,
          subject: "Password Reset Request",
          html: `<p>You requested a password reset. Click the link below to reset your password:</p>
                           <a href="${resetLink}">${resetLink}</a>`,
        };

        transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            console.error("Failed to send email:", err);
            return res
              .status(500)
              .json({ message: "Failed to send reset email." });
          }
          res
            .status(200)
            .json({ message: "Password reset link sent to your email." });
        });
      }
    );
  });
};

// Reset Password
exports.resetPassword = async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Authorization header missing or malformed" });
  }

  const token = authHeader.split(" ")[1]; // Extract token after "Bearer"

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Hash the new password
    const hashedPassword = await bcrypt.hash(req.body.newPassword, 12);

    // Update the user's password in the database
    const query = `UPDATE users SET password = ?, reset_token = NULL WHERE id = ?`;
    db.run(query, [hashedPassword, decoded.id], (err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to reset password." });
      }
      res.status(200).json({ message: "Password reset successfully." });
    });
  } catch (error) {
    console.error("Reset token verification failed:", error);
    res.status(400).json({ message: "Invalid or expired token." });
  }
};
