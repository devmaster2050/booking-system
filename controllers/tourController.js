const db = require("../db/database");
const client = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const path = require("path"); // ??? should delete this lol

// Add a new tour
const addTour = (req, res) => {
  console.log("Received Body:", req.body);

  const {
    name,
    short_description,
    general_description,
    location,
    duration_hours,
    duration_minutes,
    what_to_bring,
    know_before,
    questions,
    private_tour,
    meeting_location,
    time_slots,
    start_date,
    end_date,
    indefinite_availability,
    max_capacity,
    itinerary_points,
    guide_rate,
    ticket_cost,
    vehicle_cost,
    is_additional_name_required,
    is_additional_email_required,
  } = req.body;

  const image = req.file ? req.file.filename : null;

  if (!name || !duration_hours || !duration_minutes) {
    return res.status(400).json({ error: "Required fields are missing." });
  }

  const query = `
        INSERT INTO tours 
        (name, short_description, general_description, location, duration_hours, duration_minutes, 
        what_to_bring, know_before, questions, image, private_tour, meeting_location, time_slots, start_date, end_date, indefinite_availability, max_capacity, guide_rate, ticket_cost, vehicle_cost, is_additional_name_required, is_additional_email_required) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

  const indefiniteValue = parseInt(
    indefinite_availability === "true" || indefinite_availability === "1"
      ? 1
      : 0
  );

  // Parse numeric fields correctly
  const parsedGuideRate = parseFloat(guide_rate) || 0;
  const parsedTicketCost = parseFloat(ticket_cost) || 0;
  const parsedVehicleCost = parseFloat(vehicle_cost) || 0;
  const parsedIsNameReq =
    is_additional_name_required === "true" ||
    is_additional_name_required === "1"
      ? 1
      : 0;
  const parsedIsEmailReq =
    is_additional_email_required === "true" ||
    is_additional_email_required === "1"
      ? 1
      : 0;

  const parsedPrivateTour = parseInt(private_tour) || 0;

  const values = [
    name,
    short_description,
    general_description,
    location,
    duration_hours,
    duration_minutes,
    what_to_bring,
    know_before,
    questions,
    image,
    parsedPrivateTour,
    meeting_location || "",
    time_slots,
    start_date || null,
    end_date || null,
    indefiniteValue,
    max_capacity,
    parsedGuideRate,
    parsedTicketCost,
    parsedVehicleCost,
    parsedIsNameReq,
    parsedIsEmailReq,
  ];

  db.run(query, values, function (err) {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to add tour." });
    }

    const tourId = this.lastID; // Correctly defining tourId here
    const tasks = [];

    // New, to test
    if (req.body.blackout_days) {
      const blackoutArray = JSON.parse(req.body.blackout_days);
      const blackoutQuery = `
                INSERT INTO blackout_days (tour_id, date) 
                VALUES (?, ?)
            `;
      blackoutArray.forEach(({ date }) => {
        tasks.push(
          new Promise((resolve, reject) => {
            db.run(blackoutQuery, [tourId, date], (err) => {
              if (err) {
                console.error("Failed to insert blackout day:", err.message);
                return reject(err);
              }
              resolve();
            });
          })
        );
      });
    }

    // Insert itinerary points if provided
    if (itinerary_points) {
      const points = JSON.parse(itinerary_points);
      const itineraryQuery = `INSERT INTO itinerary_points (tour_id, latitude, longitude) VALUES (?, ?, ?)`;

      points.forEach(([lat, lng]) => {
        tasks.push(
          new Promise((resolve, reject) => {
            db.run(itineraryQuery, [tourId, lat, lng], (itineraryErr) => {
              if (itineraryErr) {
                console.error(
                  "Failed to insert itinerary point:",
                  itineraryErr.message
                );
                return reject(itineraryErr);
              }
              resolve();
            });
          })
        );
      });
    }

    // Insert time slots if provided
    if (time_slots) {
      const slots = JSON.parse(time_slots);
      const timeSlotQuery = `
                INSERT INTO time_slots (tour_id, time, day_of_week, specific_date) VALUES (?, ?, ?, ?)
            `;

      slots.forEach(({ time, day_of_week, specific_date }) => {
        tasks.push(
          new Promise((resolve, reject) => {
            db.run(
              timeSlotQuery,
              [tourId, time, day_of_week, specific_date],
              (timeSlotErr) => {
                if (timeSlotErr) {
                  console.error(
                    "Failed to insert time slot:",
                    timeSlotErr.message
                  );
                  return reject(timeSlotErr);
                }
                resolve();
              }
            );
          })
        );
      });
    }

    // Wait for all tasks to complete before responding
    Promise.all(tasks)
      .then(() => {
        res.status(201).json({ id: tourId, ...req.body, image });
      })
      .catch((taskErr) => {
        console.error("Error inserting related data:", taskErr.message);
        res.status(500).json({ error: "Failed to add related data." });
      });
  });
};

// Get all tours
const getTours = (req, res) => {
  console.log("getTours called");

  const query = `
        SELECT * FROM tours
    `;
  db.all(query, [], (err, rows) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to fetch tours." });
    }
    res.json(rows);
  });
};

const getTourById = (req, res) => {
  console.log("getTourById called for tour ID:", req.params.id);

  const { id } = req.params;

  const query = `SELECT * FROM tours WHERE id = ?`;
  db.get(query, [id], (err, tour) => {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to fetch tour details." });
    }

    if (!tour) {
      return res.status(404).json({ error: "Tour not found." });
    }

    const itineraryQuery = `SELECT latitude, longitude FROM itinerary_points WHERE tour_id = ?`;
    db.all(itineraryQuery, [id], (err, points) => {
      if (err) {
        console.error("Database error:", err.message);
        return res.status(500).json({ error: "Failed to fetch itinerary." });
      }

      const timeSlotsQuery = `SELECT time, day_of_week, specific_date FROM time_slots WHERE tour_id = ?`;
      db.all(timeSlotsQuery, [id], (err, slots) => {
        if (err) {
          console.error("Database error:", err.message);
          return res.status(500).json({ error: "Failed to fetch time slots." });
        }

        tour.itinerary = points;
        tour.time_slots = slots;

        const bookingsQuery = `SELECT tour_date, additional_travelers FROM bookings WHERE tour_id = ?`;
        db.all(bookingsQuery, [id], (err, bookingRows) => {
          if (err) {
            console.error("Database error:", err.message);
            return res.status(500).json({ error: "Failed to fetch bookings." });
          }

          // Create a dictionary (object) to store total travelers per date/time
          const bookingMap = {};
          for (const row of bookingRows) {
            // 1 lead traveler by default
            let totalTravelers = 1;

            if (row.additional_travelers) {
              try {
                const travelersArray = JSON.parse(row.additional_travelers);
                // Add however many are in the array
                totalTravelers += travelersArray.length;
              } catch (parseErr) {
                console.error(
                  "Error parsing additional_travelers JSON:",
                  parseErr
                );
                // If invalid JSON, just skip or treat as 0 additional travelers
              }
            }

            // Sum them into bookingMap, keyed by the date/time (row.tour_date)
            bookingMap[row.tour_date] =
              (bookingMap[row.tour_date] || 0) + totalTravelers;
          }

          // Attach bookingMap to the tour object
          // e.g. bookingMap might look like:
          // {
          //   "2025-01-29 21:34": 3,
          //   "2025-01-27 18:03": 2,
          //   ...
          // }
          tour.bookingMap = bookingMap;

          // New, to test
          const blackoutQuery = `SELECT date FROM blackout_days WHERE tour_id = ?`;
          db.all(blackoutQuery, [id], (err, blackoutRows) => {
            if (err) {
              console.error("Error fetching blackout days:", err.message);
              return res
                .status(500)
                .json({ error: "Failed to fetch blackout days." });
            }

            // Add an array of { date: 'YYYY-MM-DD' } to the tour object
            tour.blackout_days = blackoutRows.map((row) => ({
              date: row.date,
            }));

            // Now respond with the complete tour
            res.json(tour);
          });
          // End of new, to test. Commented the res.json(tour); following up as we do it here now

          // Finally respond with the tour data
          //res.json(tour);
        });
      });
    });
  });
};

const deleteTour = (req, res) => {
  const { id } = req.params;

  const query = `DELETE FROM tours WHERE id = ?`;

  db.run(query, [id], function (err) {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to delete tour." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Tour not found." });
    }
    res.json({ message: "Tour deleted successfully." });
  });
};

// Update a tour. Also includes a control to send an sms in case the tour is cancelled.
const updateTour = (req, res) => {
  const { id } = req.params;
  const {
    name,
    short_description,
    general_description,
    location,
    duration_hours,
    duration_minutes,
    what_to_bring,
    know_before,
    questions,
    private_tour,
    meeting_location,
    time_slots,
    start_date,
    end_date,
    indefinite_availability,
    max_capacity,
    itinerary_points, // To check, why am I ignoring this?
    guide_rate,
    ticket_cost,
    vehicle_cost,
    is_additional_name_required,
    is_additional_email_required,
  } = req.body;

  const image = req.file ? req.file.filename : null;
  const parsedIsNameReq =
    is_additional_name_required === "true" ||
    is_additional_name_required === "1"
      ? 1
      : 0;
  const parsedIsEmailReq =
    is_additional_email_required === "true" ||
    is_additional_email_required === "1"
      ? 1
      : 0;

  const parsedPrivateTour = parseInt(private_tour) || 0;

  const query = `
        UPDATE tours 
        SET name = ?, short_description = ?, general_description = ?, location = ?, 
            duration_hours = ?, duration_minutes = ?, what_to_bring = ?, know_before = ?, 
            questions = ?, private_tour = ?, meeting_location = ?, time_slots = ?, 
            start_date = ?, end_date = ?, indefinite_availability = ?, max_capacity = ?,
            guide_rate = ?, ticket_cost = ?, vehicle_cost = ?,
            image = COALESCE(?, image), is_additional_name_required = ?, is_additional_email_required = ?
        WHERE id = ?
    `;

  const values = [
    name,
    short_description,
    general_description,
    location,
    duration_hours,
    duration_minutes,
    what_to_bring,
    know_before,
    questions,
    parsedPrivateTour ? 1 : 0,
    meeting_location,
    time_slots,
    start_date || null,
    end_date || null,
    indefinite_availability ? 1 : 0,
    max_capacity,
    parseFloat(guide_rate) || 0,
    parseFloat(ticket_cost) || 0,
    parseFloat(vehicle_cost) || 0,
    image,
    parsedIsNameReq,
    parsedIsEmailReq,
    id,
  ];

  // Begin transaction
  db.run(query, values, async function (err) {
    if (err) {
      console.error("Database error:", err.message);
      return res.status(500).json({ error: "Failed to update tour." });
    }

    const tasks = [];

    // Get existing time slots to find deleted ones
    const existingSlotsQuery = `SELECT id, time, specific_date FROM time_slots WHERE tour_id = ?`;
    db.all(existingSlotsQuery, [id], (err, existingSlots) => {
      if (err) {
        console.error("Error fetching existing time slots:", err.message);
        return res
          .status(500)
          .json({ error: "Failed to fetch existing time slots." });
      }

      const newSlots = JSON.parse(time_slots || "[]");

      // Debug log for existing and new slots
      console.log("Existing slots:", existingSlots);
      console.log("New slots:", newSlots);

      // Find deleted slots
      const deletedSlots = existingSlots.filter(
        (existingSlot) =>
          !newSlots.some(
            (newSlot) =>
              newSlot.time === existingSlot.time &&
              newSlot.specific_date === existingSlot.specific_date
          )
      );

      // Debug log for deleted slots
      console.log("Deleted slots:", deletedSlots);

      // Notify users and update bookings for deleted slots
      deletedSlots.forEach((slot) => {
        const dateTime = `${slot.specific_date} ${slot.time}`.trim();

        const bookingsQuery = `SELECT * FROM bookings WHERE tour_id = ? AND tour_date = ?`;

        // Debug log for each slot being processed
        console.log("Processing deleted slot:", slot);

        db.all(bookingsQuery, [id, dateTime], async (err, bookings) => {
          console.log("With the bookings query being: " + bookingsQuery);
          if (err) {
            console.error("Error fetching bookings:", err.message);
            return;
          }

          // Debug log for bookings associated with the deleted slot
          console.log("Bookings for deleted slot:", bookings);

          for (const booking of bookings) {
            try {
              console.log(`Sending SMS to ${booking.phone}`);
              const message = `Dear ${booking.name}, your booking for ${slot.specific_date} at ${slot.time} has been canceled.`;
              await client.messages.create({
                body: message,
                from: "+12315706964", // Replace with your Twilio number
                to: booking.phone,
              });
              console.log(`SMS sent to ${booking.phone}`);
            } catch (error) {
              console.error(
                `Failed to send SMS to ${booking.phone}:`,
                error.message
              );
            }

            const updateBookingQuery = `UPDATE bookings SET review_sent = 1 WHERE id = ?`;
            console.log(`Marking review_sent for booking ${booking.id}`);
            db.run(updateBookingQuery, [booking.id], (updateErr) => {
              if (updateErr) {
                console.error(
                  `Failed to update booking ${booking.id}:`,
                  updateErr.message
                );
              }
            });
          }
        });
      });

      // Delete old time slots
      const deleteTimeSlotsQuery = `DELETE FROM time_slots WHERE tour_id = ?`;
      tasks.push(
        new Promise((resolve, reject) => {
          db.run(deleteTimeSlotsQuery, [id], (err) => {
            if (err) {
              console.error("Failed to delete old time slots:", err.message);
              return reject(err);
            }
            resolve();
          });
        })
      );

      // Insert new time slots
      const timeSlotQuery = `
                INSERT INTO time_slots (tour_id, time, day_of_week, specific_date) VALUES (?, ?, ?, ?)
            `;
      newSlots.forEach(({ time, day_of_week, specific_date }) => {
        tasks.push(
          new Promise((resolve, reject) => {
            db.run(
              timeSlotQuery,
              [id, time, day_of_week, specific_date],
              (err) => {
                if (err) {
                  console.error("Failed to insert time slot:", err.message);
                  return reject(err);
                }
                resolve();
              }
            );
          })
        );
      });

      const updatedTimeSlots = JSON.stringify(newSlots);

      const updateTimeSlotsQuery = `UPDATE tours SET time_slots = ? WHERE id = ?`;
      db.run(updateTimeSlotsQuery, [updatedTimeSlots, id], (err) => {
        if (err) {
          console.error("Failed to update time_slots field:", err.message);
        } else {
          console.log("Updated time_slots field in tours table.");
        }
      });

      // New, to test
      if (req.body.blackout_days) {
        // 1) Delete old blackout_days for this tour
        const deleteBlackoutsQuery = `DELETE FROM blackout_days WHERE tour_id = ?`;
        tasks.push(
          new Promise((resolve, reject) => {
            db.run(deleteBlackoutsQuery, [id], (err) => {
              if (err) {
                console.error(
                  "Failed to delete old blackout days:",
                  err.message
                );
                return reject(err);
              }
              resolve();
            });
          })
        );
        // 2) Insert new blackout days
        const blackoutArray = JSON.parse(req.body.blackout_days || "[]");
        const insertBlackoutQuery = `INSERT INTO blackout_days (tour_id, date) VALUES (?, ?)`;
        blackoutArray.forEach(({ date }) => {
          tasks.push(
            new Promise((resolve, reject) => {
              db.run(insertBlackoutQuery, [id, date], (err) => {
                if (err) {
                  console.error("Failed to insert blackout day:", err.message);
                  return reject(err);
                }
                resolve();
              });
            })
          );
        });
      }

      Promise.all(tasks)
        .then(() => {
          res.json({ id, ...req.body, image });
        })
        .catch((taskErr) => {
          console.error("Error updating related data:", taskErr.message);
          res.status(500).json({ error: "Failed to update related data." });
        });
    });
  });
};

// Get Available Dates for a Tour
const getTourDates = (req, res) => {
  const { id } = req.params;

  const query = `SELECT time_slots, start_date, end_date, indefinite_availability FROM tours WHERE id = ?`;

  db.get(query, [id], (err, tour) => {
    if (err) {
      console.error("Error fetching tour dates:", err.message);
      return res.status(500).json({ message: "Error fetching tour dates." });
    }

    if (!tour) {
      console.log("No tour found with the given ID.");
      return res.status(404).json({ message: "Tour not found." });
    }

    console.log("Fetched tour data:", tour);
    const { time_slots, start_date, end_date, indefinite_availability } = tour;

    let slots;
    try {
      slots = JSON.parse(time_slots || "[]");
      console.log("Parsed time slots:", slots);
    } catch (error) {
      console.error("Failed to parse time_slots:", error);
      return res
        .status(500)
        .json({ message: "Invalid time_slots format in database." });
    }

    const dates = [];

    if (indefinite_availability) {
      const start = new Date(start_date || new Date());
      const end = new Date(end_date || "2033-12-31");
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
              dates.push({
                date: current.toISOString().split("T")[0],
                time: slot.time,
              });
            }
            current.setDate(current.getDate() + 1);
          }
        }
      });
    }

    slots.forEach((slot) => {
      if (slot.specific_date) {
        dates.push({
          date: slot.specific_date,
          time: slot.time,
        });
      }
    });

    console.log("Generated tour dates:", dates);
    res.json(dates);
  });
};

module.exports = {
  addTour,
  getTours,
  getTourById,
  deleteTour,
  updateTour,
  getTourDates,
};
