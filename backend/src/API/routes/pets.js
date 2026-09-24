const router = require("express").Router();
//import { useId } from "react";
import axios from "axios";
import Pet from "../model/pet";
const { authenticate } = require('../middleware/auth.middlewere');

// Server-side-only read of the same Realtime Database node the IoT simulator
// writes to (backend/src/services/iotSimulatorService.js). Reused here rather
// than adding a parallel config so the tracker endpoint below always points at
// the same "petcare" node that telemetry is actually published to.
function getFirebaseTelemetryUrl() {
    const databaseUrl =
        process.env.FIREBASE_RTDB_URL || process.env.IOT_SIMULATOR_FIREBASE_DATABASE_URL;
    if (!databaseUrl) {
        throw new Error(
            "FIREBASE_RTDB_URL (or IOT_SIMULATOR_FIREBASE_DATABASE_URL) is not set. " +
            "Add it to backend/.env to use the pet tracker endpoint."
        );
    }
    return `${databaseUrl.replace(/\/$/, "")}/petcare.json`;
}


router.route("/add").post(authenticate, (req,res)=>{

    const petName = req.body.petName;
    const userId = req.body.userId;
    const species = req.body.species;
    const bDate = req.body.bDate;
    const gender = req.body.gender;
    const weight = req.body.weight;
    const color = req.body.color;
    const breed = req.body.breed;
    const deviceId = req.body.deviceId;

    const newPet = new Pet({
        petName,
        userId,
        species,
        bDate,
        gender,
        weight,
        color,
        breed,
        deviceId
    })

    

    newPet.save().then(()=>{
        res.json("Pet Added")
    }).catch((err) => {
        console.log(err);
    })

})

router.route("/").get(authenticate, (req, res) => {
    Pet.find()
        .then((pets) => {
            res.json(pets);
        })
        .catch((err) => {
            console.log(err);
            res.status(500).json({ error: "Error fetching pets", details: err.message });
        });
});


router.route("/update/:id").put(authenticate, async (req, res) => {
    try {
        const pet = await Pet.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!pet) {
            return res.status(404).json({ error: "Pet not found" });
        }
        
        res.json({ 
            status: "Pet Updated",
            pet // Return the updated pet
        });
    } catch (err) {
        res.status(500).json({ 
            error: "Error updating pet",
            details: err.message 
        });
    }
});


router.get('/petDetaile/:petId', authenticate, async (req, res) => {
    try {
      const pet = await Pet.findById(req.params.petId);
      if (!pet) {
        return res.status(404).json({ message: 'Pet not found' });
      }
      res.json({ pet });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });

router.route("/delete/:id").delete(authenticate, async(req,res) =>{
    let petid = req.params.id;

    await Pet.findByIdAndDelete(petid)
    .then(() => {
        res.status(200).send({status: "Pet deleted"})
    }).catch((err) =>{
        console.log(err.message);
        res.status(500).send({status: "Error with delete Pet",eror: err.message});
    })

} )

router.route("/find/:uid").get(authenticate, async (req, res) => {
    try {
        const userId = req.params.uid;
        const pets = await Pet.find({ userId });

        if (!pets || pets.length === 0) {
            return res.status(404).json({ status: "No pets found for this user" });
        }

        res.status(200).json({ status: "Pets fetched", pets });
    } catch (err) {
        console.error("Error fetching pets:", err);
        res.status(500).json({ status: "Error fetching pets", error: err.message });
    }
});

// Authenticated, ownership-checked telemetry read for the Pet Tracker
// dashboard (frontend/src/components/deviceData.js). Replaces the previous
// unauthenticated direct-from-browser Firebase read: the backend derives the
// caller from their session, checks that the requested device belongs to one
// of their pets, and only then fetches and returns that device's telemetry.
router.route("/tracker/:deviceId").get(authenticate, async (req, res) => {
    try {
        const { deviceId } = req.params;
        const requesterId = String(req.user?._id || req.user?.id || "");

        const numericDeviceId = Number(deviceId);
        const ownerPet = Number.isNaN(numericDeviceId)
            ? null
            : await Pet.findOne({ deviceId: numericDeviceId });

        if (!ownerPet) {
            return res.status(404).json({ error: "Device not found" });
        }

        if (String(ownerPet.userId) !== requesterId) {
            return res.status(403).json({ error: "You do not have access to this device" });
        }

        const authSecret =
            process.env.FIREBASE_RTDB_SECRET || process.env.IOT_SIMULATOR_FIREBASE_DATABASE_SECRET;
        const response = await axios.get(getFirebaseTelemetryUrl(), {
            params: authSecret ? { auth: authSecret } : undefined,
        });

        const rawData = response.data || {};
        const records = Object.entries(rawData)
            .filter(([, record]) => String(record?.["Device ID"]) === String(deviceId))
            .map(([id, record]) => ({ id, ...record }));

        res.json({ deviceId: numericDeviceId, records });
    } catch (err) {
        console.error("Error fetching pet tracker telemetry:", err.message);
        res.status(500).json({ error: "Error fetching telemetry", details: err.message });
    }
});

module.exports = router;
