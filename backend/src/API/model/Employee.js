const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const employeeSchema = new mongoose.Schema({
    employeeId: {
        type: String,
        required: true,
        unique: true
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    role: {
        type: String,
        required: true
    },
    availability: [{
        date: {
            type: Date,
            required: true
        },
        status: {
            type: String,
            enum: ['Available', 'Booked'],
            default: 'Available'
        }
    }],
    appointments: [{
        petName: {
            type: String,
            required: true
        },
        appointmentDate: {
            type: Date,
            required: true
        }
    }]
});

employeeSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        this.password = await bcrypt.hash(this.password, 12);
        next();
    } catch (error) {
        next(error);
    }
});

module.exports = mongoose.model('Employee', employeeSchema);
