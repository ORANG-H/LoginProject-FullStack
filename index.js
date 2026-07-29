import bodyParser from "body-parser";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import bcrypt from "bcrypt";
import pg from "pg";
import multer from "multer";
import 'dotenv/config';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();   

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static("public"));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/"); // Save files directly into the 'public' folder
  },
  filename: (req, file, cb) => {
    // Give the file a unique name using the current timestamp + its original name
    const uniqueSuffix = Date.now() + "-" + file.originalname;
    cb(null, uniqueSuffix);
  }
});

const upload = multer({ storage: storage });

app.use(session({ secret: "secret", 
    resave: false,
     saveUninitialized: true 
    }));



const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

db.connect()
  .then(() => console.log("Successfully connected to Supabase database!"))
  .catch((err) => console.error("Database connection error:", err.message));





app.get("/", (req, res) => {
    res.render("index.ejs");
    });


    app.get("/register", (req, res) => {
  res.render("register.ejs" , { error: null });
});

app.get("/login", (req, res) => {
    res.render("index.ejs" , { error: null });
});





app.post("/register", upload.single("pfp"), (req, res) => {
  const { name, surname, email, password, password_confirm } = req.body;
  
  if (password !== password_confirm) {
    return res.render("register.ejs", { error: "Passwords do not match." });
  }

  bcrypt.hash(password, 10, async (err, hashedPassword) => {
    if (err) {
      console.error("Error hashing password:", err);
      return res.render("register.ejs", { error: "Error processing registration. Try again." });
    }
    
    try {
      // 1. Check if user already exists
      const userExists = await db.query("SELECT * FROM registered WHERE email = $1", [email]);
      if (userExists.rows.length > 0) {
        return res.render("register.ejs", { error: "User with this email already exists." });
      }

      // 2. Determine image path if uploaded
      const imagePath = req.file ? "/" + req.file.filename : null;

      // 3. Insert user into database (declared ONLY ONCE)
      const result = await db.query(
        "INSERT INTO registered (name, surname, email, password, profile_pic) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [name, surname, email, hashedPassword, imagePath]
      );
      
      console.log("New user saved to database:", result.rows[0]);
      
      // 4. Redirect to login
      res.redirect("/login");

    } catch (dbErr) {
      console.error("Database error:", dbErr);
      res.render("register.ejs", { error: "Database error saving user." });
    }
  });
});




app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query("SELECT * FROM registered WHERE email = $1", [email]);
    const user = result.rows[0];

    // 1. Check if user exists FIRST before reading properties
   if (!user) {
      // Render login page again, but pass an error message!
      return res.render("index.ejs", { error: "No user found with this email." });
    }

    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("index.ejs", { error: "Invalid password. Try again." });
    }

    // 3. Set session data safely
    req.session.userId = user.id;
    req.session.name = user.name;
    req.session.surname = user.surname;
    req.session.email = user.email;
    req.session.img = user.profile_pic; // Pulls profile picture into session!

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Database error during login:", err);
    res.status(500).send("Error logging in");
  }
});

app.get("/dashboard", async (req, res) => {
  if (req.session.userId) {
    try {
      const result = await db.query("SELECT * FROM registered WHERE id = $1", [req.session.userId]);
      const user = result.rows[0];

      if (user) {
        const apiKey = process.env.API_KEY; 
        
        // 1. Create an array of 10 fetch promises
        const fetchPromises = [];
        for (let i = 0; i < 10; i++) {
          fetchPromises.push(
            fetch("https://api.api-ninjas.com/v1/advice", {
              method: "GET",
              headers: {
                "X-Api-Key": apiKey
              }
            }).then(res => res.json())
          );
        }

        // 2. Wait for all 10 fetches to complete simultaneously
        const advicesArray = await Promise.all(fetchPromises);
        
        // advicesArray will look like: [ {advice: "..."}, {advice: "..."}, ... ]
        console.log("Fetched 10 advices:", advicesArray); 

        // 3. Render the dashboard and pass the whole array down
        res.render("dashboard.ejs", { 
          name: user.name, 
          surname: user.surname,
          img: user.profile_pic,
          advices: advicesArray // Pass the array instead of a single string
        });

      } else {
        res.redirect("/login");
      }
    } catch (err) {
      console.error("Dashboard error:", err);
      res.status(500).send("Error loading dashboard");
    }
  } else {
    res.redirect("/login");
  }
});

// go to profile page
app.get("/profile", async (req, res) => {
  if (req.session.userId) {
    try {
      const result = await db.query("SELECT * FROM registered WHERE id = $1", [req.session.userId]);
      const user = result.rows[0];

      res.render("profile.ejs", { 
        name: user.name, 
        surname: user.surname,
        email: user.email,
        img: user.profile_pic
      });
    } catch (err) {
      console.error("Profile error:", err);
      res.status(500).send("Error loading profile");
    }
  } else {
    res.redirect("/login");
  }
});


//go to About page
app.get("/about", async (req, res) => {
  // 1. Check if the user is logged in
  if (req.session.userId) {
    try {
      // 2. Fetch the user's data from the database
      const result = await db.query("SELECT * FROM registered WHERE id = $1", [req.session.userId]);
      const user = result.rows[0];

      if (user) {
        // 3. Render the about page AND pass the variables it needs!
        res.render("about.ejs", { 
          name: user.name, 
          surname: user.surname,
          img: user.profile_pic,
          zaidImg: "99619384.jpg"
        });
      } else {
        res.redirect("/login");
      }
    } catch (err) {
      console.error("About page error:", err);
      res.status(500).send("Error loading about page");
    }
  } else {
    // If they aren't logged in, send them back to login
    res.redirect("/login");
  }
});


//go to refresh-data page
app.get("/refresh-data", async (req, res) => {
  if (req.session.userId) {
    try {
      // Fetch new advice from API Ninjas
      const apiKey = "5Bsa86x4sFo7mfRmwWc0cHsIMs19KP870J9Zk1Kj";
      const apiResponse = await fetch("https://api.api-ninjas.com/v1/advice", {
        method: "GET",
        headers: {
          "X-Api-Key": apiKey
        }
      });

      const apiData = await apiResponse.json();

      // Redirect back to the dashboard with the new advice
      res.redirect("/dashboard");
    } catch (err) {
      console.error("Refresh data error:", err);
      res.status(500).send("Error refreshing data");
    }
  } else {
    res.redirect("/login");
  }
});




app.get("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
        }
        res.redirect("/login");
    });
});



app.post("/profile", upload.single("profilePicture"), async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const { name, surname, email } = req.body;

  try {
    // Determine the image path (use new file if uploaded, otherwise keep existing session image)
    const imagePath = req.file ? "/" + req.file.filename : req.session.img;

    // Update database (Make sure your table has the 'profile_pic' column!)
    await db.query(
      "UPDATE registered SET name = $1, surname = $2, email = $3, profile_pic = $4 WHERE id = $5",
      [name, surname, email, imagePath, req.session.userId]
    );

    // Update session data so navbar updates instantly
    req.session.name = name;
    req.session.surname = surname;
    req.session.email = email;
    req.session.img = imagePath;

    res.redirect("/dashboard");
  } catch (err) {
    console.error("Profile update error:", err);
    res.status(500).send("Error updating profile");
  }
});


    app.post("/delete-account", async (req, res) => {
    if (!req.session.userId) {
        return res.redirect("/login");
    }

    try {
        await db.query("DELETE FROM registered WHERE id = $1", [req.session.userId]);
        req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
        }
        res.redirect("/login");
        });
    } catch (err) {
        console.error("Delete account error:", err);
        res.status(500).send("Error deleting account");
    }
    });


// Save advice route
app.post("/save-advice", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { adviceText } = req.body;

  try {
    await db.query(
      "INSERT INTO saved_advices (user_id, advice_text) VALUES ($1, $2)",
      [req.session.userId, adviceText]
    );
    res.json({ success: true, message: "Advice saved successfully!" });
  } catch (err) {
    console.error("Error saving advice:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Render Saved Advices (Faves) Page
app.get("/saved-advices", async (req, res) => {
  if (req.session.userId) {
    try {
      // 1. Fetch logged-in user details for navbar
      const userResult = await db.query("SELECT * FROM registered WHERE id = $1", [req.session.userId]);
      const user = userResult.rows[0];

      // 2. Fetch user's saved quotes from DB (newest first)
      const savedResult = await db.query(
        "SELECT * FROM saved_advices WHERE user_id = $1 ORDER BY saved_at DESC",
        [req.session.userId]
      );

      res.render("saved-advices.ejs", { 
        name: user.name, 
        surname: user.surname,
        img: user.profile_pic,
        savedAdvices: savedResult.rows 
      });
    } catch (err) {
      console.error("Error fetching saved advices:", err);
      res.status(500).send("Error loading saved advices");
    }
  } else {
    res.redirect("/login");
  }
});


// Delete a saved advice
app.post("/delete-saved-advice", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  const { id } = req.body;

  try {
    // Ensure the advice belongs to the logged-in user before deleting
    await db.query(
      "DELETE FROM saved_advices WHERE id = $1 AND user_id = $2",
      [id, req.session.userId]
    );
    res.json({ success: true, message: "Advice deleted successfully!" });
  } catch (err) {
    console.error("Error deleting saved advice:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});