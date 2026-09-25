const express = require('express');
const router = express.Router();
const MedicalRecord = require('../model/MedicalRecord');
const { authenticate } = require('../middleware/auth.middlewere');

const editableMedicalRecordFields = [
  'visitDate',
  'visitType',
  'veterinarian',
  'diagnosis',
  'treatment',
  'medications',
  'notes',
  'followUpDate'
];

// Create record
router.post('/', authenticate, async (req, res) => {
    try {
      const { petId, visitDate, visitType, veterinarian, diagnosis, treatment, medications, notes } = req.body;
      
      const newRecord = new MedicalRecord({
        petId,
        visitDate: visitDate || Date.now(),
        visitType,
        veterinarian,
        diagnosis,
        treatment,
        medications: medications || [],
        notes
      });
  
      const savedRecord = await newRecord.save();
      res.status(201).json(savedRecord);
    } catch (err) {
      res.status(400).json({ 
        error: 'Failed to create record',
        details: err.message 
      });
    }
  });

// Get all records for a pet
router.get('/:petId', authenticate, async (req, res) => {
  try {
    const records = await MedicalRecord.find({ petId: req.params.petId })
      .sort({ visitDate: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single record
router.get('/single/:id', authenticate, async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update record
router.put('/:id', authenticate, async (req, res) => {
  try {
    const updates = {};
    editableMedicalRecordFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    });

    const updatedRecord = await MedicalRecord.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!updatedRecord) return res.status(404).json({ error: 'Record not found' });
    res.json(updatedRecord);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete record
router.delete('/delete/:id', authenticate, async (req, res) => {
  try {
    const deletedRecord = await MedicalRecord.findByIdAndDelete(req.params.id);
    if (!deletedRecord) return res.status(404).json({ error: 'Record not found' });
    res.json({ message: 'Record deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
