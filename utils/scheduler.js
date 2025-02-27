const schedule = require('node-schedule');
const db = require('../db/database'); 
const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Function to calculate completion time
const calculateCompletionTime = (startDateTime, durationHours, durationMinutes) => {
    const startTime = new Date(startDateTime);
    startTime.setHours(startTime.getHours() + durationHours);
    startTime.setMinutes(startTime.getMinutes() + durationMinutes);
    return startTime.toISOString();
};

// Function to send review requests
const sendReviewMessage = async (booking, reviewLink) => {
    const { phone, name } = booking;
    const message = `Hello ${name}, thank you for attending the tour! Please leave your review here: ${reviewLink}`;

    // Send SMS via Twilio
    try {
        await client.messages.create({
            body: message,
            from: '+12315706964', // Replace with your Twilio phone number
            to: phone,
        });
        console.log(`SMS sent to ${phone}`);
    } catch (error) {
        console.error(`Failed to send SMS to ${phone}:`, error.message);
    }
};

// Schedule task to check for completed tours and send review requests
const scheduleReviewRequests = () => {
    schedule.scheduleJob('*/5 * * * *', async () => {
        try {
            const now = new Date();

            // Query for bookings with completed tours and no review sent
            const query = `
                SELECT b.*, t.duration_hours, t.duration_minutes
                FROM bookings b
                JOIN tours t ON b.tour_id = t.id
                WHERE review_sent = 0
            `;

            db.all(query, [], async (err, bookings) => {
                if (err) {
                    console.error('Failed to fetch bookings:', err.message);
                    return;
                }

                for (const booking of bookings) {
                    const completionTime = calculateCompletionTime(booking.tour_date, booking.duration_hours, booking.duration_minutes);

                    if (new Date(completionTime) <= now) {
                        const reviewLink = `https://example.com/reviews/${booking.id}`;
                        await sendReviewMessage(booking, reviewLink);

                        // Mark as review sent
                        const updateQuery = `UPDATE bookings SET review_sent = 1 WHERE id = ?`;
                        db.run(updateQuery, [booking.id], (updateErr) => {
                            if (updateErr) {
                                console.error(`Failed to update review_sent for booking ${booking.id}:`, updateErr.message);
                            } else {
                                console.log(`Review sent for booking ${booking.id}`);
                            }
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Scheduler error:', error.message);
        }
    });
};

module.exports = { scheduleReviewRequests };
