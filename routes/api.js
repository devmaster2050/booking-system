const express = require("express");

const {
  addTour,
  getTours,
  getTourById,
  deleteTour,
  updateTour,
  getTourDates,
} = require("../controllers/tourController");
const {
  addBooking,
  getBookings,
  getBookingsById,
} = require("../controllers/bookingController");
const userRoutes = require("./user");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();
const db = require("../db/database");
const multer = require("multer");
const path = require("path");

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads"); // Save images in the 'uploads' folder
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // Unique filenames
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and WEBP files are allowed"), false);
    }
  },
});

// Debugging middleware
router.use((req, res, next) => {
  console.log("--- Incoming Request Debugging ---");
  console.log(`Method: ${req.method}`);
  console.log(`URL: ${req.originalUrl}`);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  next();
});

// User routes
router.use("/users", userRoutes);

// Tour routes with upload middleware for image uploads
router.post("/tours", upload.single("image"), addTour); // Add a tour with image upload
router.get("/tours", getTours); // Get all tours
router.get("/tours/:id", getTourById);
router.delete("/tours/:id", deleteTour);
router.put("/tours/:id", upload.single("image"), updateTour);

router.get("/tours/:id/dates", getTourDates);

router.post("/bookings", authMiddleware, addBooking);
router.get("/bookings", getBookings);

// To be pushed into bookingController
router.get("/bookings/my", authMiddleware, getBookingsById);

// Debugging response for unhandled routes
router.use((req, res) => {
  console.error(`Unhandled route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: "Route not found" });
});

module.exports = router;
