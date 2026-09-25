import "dotenv/config";
import cors from "cors";
import express from "express";
import session from "express-session";
import passport from "passport";
import MongoStore from "connect-mongo";
import logger from "./utils/logger.js";
import { connect } from "./utils/database.connection.js";
import { googleAuth } from "../src/configs/google.auth.js";
import { routesInit } from "./API/middleware/routesInit.js";
import config from "./configs/index.js";
import router from "./API/routes/pets.js";
import Employee from "./API/model/Employee.js";
import PetAd from "./API/model/PetAd.js";

const app = express();
const PORT = process.env.PORT || "8090";

// Environment check
const isProduction = process.env.NODE_ENV === 'production';
const frontendURL = isProduction ? process.env.FRONTEND_URL : "http://localhost:3000";

app.use(cors({
    origin: [
        "http://localhost:3000", // Development
        frontendURL, // Production
        process.env.FRONTEND_URL // Additional production URL
    ].filter(Boolean), // Remove undefined values
    credentials: true
}));

// ✅ Ensure Express parses JSON properly
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ Set up session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || "your-default-session-secret",
    resave: false,
    saveUninitialized: false, // Prevent empty sessions
    store: MongoStore.create({ mongoUrl: config.DB_CONNECTION_STRING }),
    cookie: {
        secure: isProduction,  // Use secure cookies in production (HTTPS required)
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 1 day session expiration
        sameSite: isProduction ? 'none' : 'lax' // Allow cross-site cookies in production
    }
}));

// ✅ Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// ✅ Apply Routes
const googleAuthEnabled = googleAuth(passport);
routesInit(app, passport, googleAuthEnabled);

// ✅ Main Routes
app.get("/", (req, res) => {
    res.send("<a href='http://localhost:8090/auth/google'>Login with Google</a> <h1>Welcome</h1>");
});

// ✅ Fix: Get session correctly
app.get("/get-session", (req, res) => {
    const currentUser = req.session?.employee || req.user;

    if (currentUser) {
        res.json({ sessionID: req.sessionID, user: currentUser });
    } else {
        res.json({ message: "No session found", user: null });
    }
});

//Fix (V11 : Use POST instead of GET to prevent Logout CSRF attacks)
app.post("/logout", (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error("Logout error:", err);
            return res.status(500).json({ message: "Error logging out" });
        }
        req.session.destroy(() => {
            res.clearCookie("connect.sid"); // ✅ Clear session cookie
            res.json({ message: "Logged out successfully" });
        });
    });
});

const petRouter = require("./API/routes/pets.js")
app.use("/pet", petRouter)

import imageProxyRouter from "./API/routes/imageProxy.js";
app.use("/image-proxy", imageProxyRouter);

const medicalRecords = require("./API/routes/medicalRecords.js")
app.use('/medical', medicalRecords);

//Route for product
const productRouter = require("./API/routes/productRoutes.js")
app.use("/product", productRouter)

//Route for Order
const orderRoutes = require("./API/routes/orderRoutes.js")
app.use("/order", orderRoutes);

// Appointment routes
import appointmentRoutes from "./API/routes/appointmentRoutes.js";
app.use("/api/appointments", appointmentRoutes);

// Serve static files from the uploads folder
app.use("/uploads", express.static("uploads"));

const employeeRoutes = require("./API/routes/employeeRoutes.js")
app.use("/employee", employeeRoutes)

const PetAdRoutes = require("./API/routes/PetAdRoutes.js")
app.use("/pet-ad", PetAdRoutes);

const expenseRoutes = require("./API/routes/expenseRoutes.js");
app.use("/api/expenses", expenseRoutes);

const geminiRoutes = require("./API/routes/gemini.js")
app.use("/gemini", geminiRoutes);

const feedbackRoutes = require("./API/routes/feedbackRoutes.js")
app.use("/feedback", feedbackRoutes);

// Notification routes
import notificationRoutes from "./API/routes/notificationRoutes.js";
app.use("/api/notifications", notificationRoutes);

// IoT Pet Health Tracker simulator (SE4030 test/demo aid only, disabled by default).
// Requires NODE_ENV != production so this testing utility can never come up in a
// production deployment, even if ENABLE_IOT_SIMULATOR is left set by mistake.
// See docs/IOT_SIMULATOR.md.
if (process.env.ENABLE_IOT_SIMULATOR === "true" && process.env.NODE_ENV !== "production") {
    const simulatorRoutes = require("./API/routes/simulatorRoutes.js");
    app.use("/api/simulator", simulatorRoutes);
    logger.info(`IoT simulator routes enabled at /api/simulator (ENABLE_IOT_SIMULATOR=true, NODE_ENV=${process.env.NODE_ENV || "development"})`);
} else if (process.env.ENABLE_IOT_SIMULATOR === "true") {
    logger.warn("ENABLE_IOT_SIMULATOR=true was ignored because NODE_ENV=production. The IoT simulator must not run in production.");
}

app.listen(PORT, () => {
    logger.info(`Server is running on PORT ${PORT}`);
    connect();
});

export default app;
