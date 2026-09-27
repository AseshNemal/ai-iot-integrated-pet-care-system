const mongoose = require('mongoose');

const employeeIdSequenceSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true
    },
    value: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    versionKey: false
});

module.exports = mongoose.model('EmployeeIdSequence', employeeIdSequenceSchema);
