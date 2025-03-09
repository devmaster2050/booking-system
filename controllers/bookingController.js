const db = require("../db/database");

const twilio = require("twilio");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Add a new booking
const addBooking = async (req, res) => {
  const {
    name,
    surname,
    email,
    phone,
    tour_id,
    tour_date,
    additional_travelers,
    special_requirements,
  } = req.body;

  if (!name || !surname || !email || !phone || !tour_id || !tour_date) {
    return res.status(400).json({ message: "All fields are required." });
  }

  // Get user ID from token or session
  const userId = req.user?.id; // Assuming middleware attaches `user` to the `req` object

  if (!userId) {
    return res.status(401).json({ message: "User must be logged in to book." });
  }

  const query = `SELECT name AS tour_name, time_slots, start_date, end_date, indefinite_availability FROM tours WHERE id = ?`;
  db.get(query, [tour_id], async (err, tour) => {
    if (err) {
      console.error("Error validating tour:", err);
      return res.status(500).json({ message: "Server error." });
    }

    console.log("Tour fetched from DB:", tour);

    if (!tour) {
      return res.status(404).json({ message: "Tour not found." });
    }

    const {
      tour_name,
      time_slots,
      start_date,
      end_date,
      indefinite_availability,
    } = tour;

    console.log("Time Slots Raw:", time_slots);
    console.log("Start Date:", start_date, "End Date:", end_date);
    console.log("Indefinite Availability:", indefinite_availability);

    const slots = JSON.parse(time_slots || "[]");
    console.log("Parsed Time Slots:", slots);

    const availableDates = [];
    if (indefinite_availability) {
      if (start_date && end_date) {
        const start = new Date(start_date);
        const end = new Date(end_date);
        const dayToNum = {
          Sunday: 0,
          Monday: 1,
          Tuesday: 2,
          Wednesday: 3,
          Thursday: 4,
          Friday: 5,
          Saturday: 6,
        };

        slots.forEach((slot) => {
          if (slot.day_of_week) {
            const day = dayToNum[slot.day_of_week];
            let current = new Date(start);

            while (current <= end) {
              if (current.getDay() === day) {
                availableDates.push(
                  `${current.toISOString().split("T")[0]} ${slot.time}`
                );
              }
              current.setDate(current.getDate() + 1);
            }
          }
        });
      }
    }

    // Always consider specific dates, even if `indefinite_availability` is true
    slots.forEach((slot) => {
      if (slot.specific_date && slot.time) {
        availableDates.push(`${slot.specific_date} ${slot.time}`);
      }
    });

    console.log("Final Available Dates:", availableDates);

    if (!availableDates.includes(tour_date.trim())) {
      console.log("Mismatch detected. Available Dates:", availableDates);
      console.log("Tour Date Trimmed:", tour_date.trim());
      return res.status(400).json({ message: "Invalid tour date selected." });
    }
    try {
      // Save booking
      const insertQuery = `
                INSERT INTO bookings (name, surname, email, phone, tour_id, tour_date, additional_travelers, special_requirements, user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
      db.run(
        insertQuery,
        [
          name,
          surname,
          email,
          phone,
          tour_id,
          tour_date,
          additional_travelers,
          special_requirements,
          userId,
        ],
        async function (err) {
          if (err) {
            console.error("Error saving booking:", err);
            return res.status(500).json({ message: "Failed to save booking." });
          }

          try {
            const bookingId = this.lastID;
            // Send confirmation SMS with tour name
            console.log("Tour Name for SMS:", tour_name);
            await sendConfirmationSMS(
              phone,
              name,
              bookingId,
              tour_date,
              tour_name
            );
            res
              .status(201)
              .json({ message: "Booking saved successfully!", bookingId });
          } catch (smsError) {
            console.error(`SMS Error: ${smsError.message}`);
            return res
              .status(400)
              .json({
                message:
                  "Failed to send SMS. Invalid phone number or service issue.",
              });
          }
        }
      );
    } catch (error) {
      console.error(`Unexpected error: ${error.message}`);
      return res.status(500).json({ message: "An unexpected error occurred." });
    }
  });
};

// Function to send confirmation SMS
async function sendConfirmationSMS(phone, name, bookingId, tourDate, tourName) {
  const message = `Hello ${name}, your booking (ID: ${bookingId}) for the tour "${tourName}" on ${tourDate} is confirmed!`;

  const smsResponse = await client.messages.create({
    body: message,
    from: "+12315706964",
    to: phone,
  });

  return smsResponse;
}

// Get all bookings
const getBookings = (req, res) => {
  const query = `
        SELECT bookings.*, tours.name AS tour_name
        FROM bookings
        JOIN tours ON bookings.tour_id = tours.id
    `;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to fetch bookings." });
    }
    res.json(rows);
  });
};

const getBookingsById = (req, res) => {
  const userId = req.user.id;

  const query = `
        SELECT b.*, t.name AS tour_name
        FROM bookings b
        JOIN tours t ON b.tour_id = t.id
        WHERE b.user_id = ?
    `;

  db.all(query, [userId], (err, rows) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to fetch your bookings." });
    }
    res.json(rows);
  });
};

module.exports = { addBooking, getBookings, getBookingsById };
