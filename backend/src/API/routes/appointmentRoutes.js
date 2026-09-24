/* routes/appointment.routes.js */
import express from "express";
import Appointment from "../model/Appointment.js";
import { authenticate, authorizeRoles } from "../middleware/auth.middlewere.js";
import axios from "axios"; // Add axios for notification API call

const router = express.Router();

const ownerEditableFields = [
  "petName",
  "serviceCategory",
  "appointmentDate",
  "appointmentTime",
];

const employeeEditableFields = [
  "appointmentDate",
  "appointmentTime",
  "status",
];

const idsMatch = (firstId, secondId) =>
  Boolean(firstId && secondId && firstId.toString() === secondId.toString());

const canAccessAppointment = (appointment, user) =>
  idsMatch(appointment.petOwnerId, user?._id) ||
  idsMatch(appointment.employeeId, user?._id);

const editableFieldsFor = (appointment, user) =>
  idsMatch(appointment.petOwnerId, user?._id)
    ? ownerEditableFields
    : employeeEditableFields;

// Validation helper
const isValidAppointmentDate = (date) => {
  const now = new Date();
  const maxDate = new Date();
  maxDate.setMonth(now.getMonth() + 60);
  return date >= now && date <= maxDate;
};

// Helper function to format date and time for notification
const formatDateForNotification = (date) => {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

// 📌 Create Appointment
router.post("/", authenticate, async (req, res) => {
  try {
    // console.log("🔥 Incoming appointment request");
    // console.log("🔐 User from session:", req.user);
    // console.log("📦 Request body:", req.body);

    const { employeeId, employeeFirstName, employeeRole, petName, serviceCategory, appointmentDate, appointmentTime } = req.body;

    if (!req.user || !req.user._id) {
      console.error("❌ Authentication error: No user in session");
      return res.status(401).json({ error: "User not authenticated." });
    }

    const petOwnerId = req.user._id;

    if (!employeeId || !employeeFirstName || !employeeRole || !petName || !serviceCategory || !appointmentDate || !appointmentTime) {
      console.error("❌ Validation error: Missing required fields");
      return res.status(400).json({ error: "All fields are required." });
    }

    // Convert date string to Date object
    const apptDate = new Date(appointmentDate);
    if (isNaN(apptDate.getTime())) {
      console.error("❌ Invalid date format:", appointmentDate);
      return res.status(400).json({ error: "Invalid appointment date format." });
    }

    if (!isValidAppointmentDate(apptDate)) {
      console.error("❌ Date validation error: Date out of range");
      return res.status(400).json({ error: "Appointment date must be from today up to 60 months in the future." });
    }

    const newAppointment = new Appointment({
      petOwnerId,
      employeeId,
      employeeFirstName,
      employeeRole,
      petName,
      serviceCategory,
      appointmentDate: apptDate,
      appointmentTime
    });

    await newAppointment.save();
    
    // Create notification for the pet owner
    try {
      const formattedDate = formatDateForNotification(apptDate);
      
      // Create notification data
      const notificationData = {
        userId: petOwnerId,
        appointmentId: newAppointment._id,
        title: 'Appointment Booked Successfully',
        message: `Your appointment for ${petName} with ${employeeFirstName} (${employeeRole}) has been scheduled for ${formattedDate} at ${appointmentTime}. Service: ${serviceCategory}.`,
        type: 'appointment'
      };
      
      // Send notification to notification service
      await axios.post('http://localhost:8090/api/notifications/appointment', notificationData);
      
      console.log("✅ Appointment notification created");
    } catch (notificationError) {
      console.error("❌ Failed to create notification:", notificationError);
      // Don't fail the appointment creation if notification fails
    }
    
    // console.log("✅ Appointment saved:", newAppointment);
    res.status(201).json(newAppointment);
  } catch (err) {
    console.error("❌ Appointment creation error:", err); // full stack
    res.status(500).json({ error: "Failed to create appointment", details: err.message });
  }
});

// 📌 Get appointments for a user
router.get("/user/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!idsMatch(userId, req.user?._id)) {
      return res.status(403).json({ error: "You do not have permission to access these appointments." });
    }

    const appointments = await Appointment.find({
      $or: [{ petOwnerId: req.user._id }, { employeeId: req.user._id }]
    }).sort({ appointmentDate: 1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch appointments." });
  }
});

// 📌 Update appointment
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { appointmentDate } = req.body;

    if (appointmentDate) {
      const apptDate = new Date(appointmentDate);
      if (!isValidAppointmentDate(apptDate)) {
        return res.status(400).json({ error: "Appointment date must be within 60 months from today." });
      }
    }

    const appointment = await Appointment.findById(id);

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found." });
    }

    if (!canAccessAppointment(appointment, req.user)) {
      return res.status(403).json({ error: "You do not have permission to update this appointment." });
    }

    editableFieldsFor(appointment, req.user).forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        appointment[field] = field === "appointmentDate"
          ? new Date(req.body[field])
          : req.body[field];
      }
    });

    appointment.updatedAt = new Date();
    await appointment.save();

    res.json(appointment);
  } catch (err) {
    res.status(500).json({ error: "Failed to update appointment." });
  }
});

// 📌 Delete appointment
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found." });
    }

    if (!canAccessAppointment(appointment, req.user)) {
      return res.status(403).json({ error: "You do not have permission to delete this appointment." });
    }

    await appointment.deleteOne();
    res.json({ message: "Appointment deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete appointment." });
  }
});

// 📌 Get available time slots
router.get("/available-slots", async (req, res) => {
  try {
    const { employeeId, date, serviceCategory } = req.query;
    if (!employeeId || !date || !serviceCategory) {
      return res.status(400).json({ error: "Missing required query parameters." });
    }

    const sessionLengthMinutes = (serviceCategory === "Bath + Haircut") ? 45 : 30;

    const openingHour = 8;
    const closingHour = 22;

    const slots = [];
    const dateObj = new Date(date);
    dateObj.setHours(openingHour, 0, 0, 0);

    while (dateObj.getHours() < closingHour) {
      const timeStr = dateObj.toTimeString().slice(0, 5);
      slots.push(timeStr);
      dateObj.setMinutes(dateObj.getMinutes() + sessionLengthMinutes);
    }

    const appointments = await Appointment.find({
      employeeId,
      appointmentDate: new Date(date),
    });

    const bookedTimes = appointments.map(app => app.appointmentTime);
    const availableSlots = slots.filter(slot => !bookedTimes.includes(slot));

    res.json({ availableSlots });
  } catch (err) {
    console.error("Slot fetching error:", err);
    res.status(500).json({ error: "Failed to fetch available slots." });
  }
});

// 📌 Get all appointments for authorized administrators
router.get("/all", authenticate, authorizeRoles("Admin"), async (req, res) => {
  try {
    const appointments = await Appointment.find({}).sort({ appointmentDate: 1 });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch all appointments." });
  }
});



export default router;
