const Employee = require('../model/Employee');
const EmployeeIdSequence = require('../model/EmployeeIdSequence');

const EMPLOYEE_ID_PREFIX = 'EMP';
const EMPLOYEE_SEQUENCE_KEY = 'employee';

const findHighestExistingNumber = async (EmployeeModel) => {
    const [result] = await EmployeeModel.aggregate([
        { $match: { employeeId: /^EMP\d+$/ } },
        {
            $project: {
                value: {
                    $toInt: {
                        $substrCP: [
                            '$employeeId',
                            EMPLOYEE_ID_PREFIX.length,
                            { $subtract: [{ $strLenCP: '$employeeId' }, EMPLOYEE_ID_PREFIX.length] }
                        ]
                    }
                }
            }
        },
        { $group: { _id: null, value: { $max: '$value' } } }
    ]);

    return result?.value || 0;
};

const allocateEmployeeId = async ({
    EmployeeModel = Employee,
    SequenceModel = EmployeeIdSequence
} = {}) => {
    const highestExistingNumber = await findHighestExistingNumber(EmployeeModel);

    try {
        await SequenceModel.updateOne(
            { _id: EMPLOYEE_SEQUENCE_KEY },
            { $max: { value: highestExistingNumber } },
            { upsert: true }
        );
    } catch (error) {
        // A concurrent first request may create the sequence after our upsert check.
        // The atomic increment below remains safe once that document exists.
        if (error?.code !== 11000) throw error;
    }

    const sequence = await SequenceModel.findOneAndUpdate(
        { _id: EMPLOYEE_SEQUENCE_KEY },
        { $inc: { value: 1 } },
        { new: true }
    );

    if (!sequence || !Number.isSafeInteger(sequence.value)) {
        throw new Error('Unable to allocate an employee ID');
    }

    return `${EMPLOYEE_ID_PREFIX}${String(sequence.value).padStart(3, '0')}`;
};

module.exports = allocateEmployeeId;
