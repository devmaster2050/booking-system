const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to SQLite database.');
});

// Initialize tables
db.serialize(() => {
    // Create tours table
    db.run(`
        CREATE TABLE IF NOT EXISTS tours (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            short_description TEXT,
            general_description TEXT,
            location TEXT,
            duration_hours INTEGER,
            duration_minutes INTEGER,
            what_to_bring TEXT,
            know_before TEXT,
            questions TEXT,
            image TEXT,
            private_tour INTEGER DEFAULT 0,
            meeting_location TEXT,
            time_slots TEXT,
            start_date TEXT,
            end_date TEXT,
            indefinite_availability INTEGER,
            max_capacity INTEGER,
            guide_rate REAL DEFAULT 0,
            ticket_cost REAL DEFAULT 0,
            vehicle_cost REAL DEFAULT 0,
            is_additional_name_required INTEGER DEFAULT 0,
            is_additional_email_required INTEGER DEFAULT 0,
            is_additional_dob_required INTEGER DEFAULT 0
        );
    `);
    

     // Create itinerary_points table
     db.run(`
        CREATE TABLE IF NOT EXISTS itinerary_points (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tour_id INTEGER NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE
        );
    `);

    // Create time_slots table
    db.run(`
        CREATE TABLE IF NOT EXISTS time_slots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tour_id INTEGER NOT NULL,
            time TEXT NOT NULL,
            day_of_week TEXT, -- For indefinite availability
            specific_date DATE, -- For specific availability
            FOREIGN KEY (tour_id) REFERENCES tours (id) ON DELETE CASCADE
        );

    `);

    // Create bookings table
    db.run(`
        CREATE TABLE IF NOT EXISTS bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            surname TEXT NOT NULL,
            email TEXT NOT NULL,
            tour_id INTEGER NOT NULL,
            tour_date TEXT NOT NULL,
            additional_travelers TEXT,
            special_requirements TEXT,
            phone TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            review_sent BOOLEAN DEFAULT 0,
            FOREIGN KEY (tour_id) REFERENCES tours(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'customer', -- Roles: customer, admin, travel_agent
            is_verified INTEGER DEFAULT 0, -- For email confirmation
            verification_token TEXT,
            reset_token TEXT
        );
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS blackout_days (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tour_id INTEGER NOT NULL,
            date TEXT NOT NULL, 
            FOREIGN KEY (tour_id) REFERENCES tours(id) ON DELETE CASCADE
        );
    `);
    
});

module.exports = db;
