const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Please log in or create an account first." });
  }

  const token = authHeader.split(" ")[1]; // Extract token from 'Bearer <token>'

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded user information to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error("Token verification failed:", error);
    res
      .status(401)
      .json({ message: "Invalid or expired token. Please log in again." });
  }
};

module.exports = authMiddleware;
