const allocateEmployeeId = require('../employeeIdAllocator');

describe('employee ID allocation', () => {
    test('keeps increasing after employees are deleted', async () => {
        const EmployeeModel = {
            aggregate: jest.fn()
                .mockResolvedValueOnce([{ value: 8 }])
                .mockResolvedValueOnce([{ value: 6 }])
        };
        let sequenceValue;
        const SequenceModel = {
            updateOne: jest.fn(async (filter, update) => {
                const existingValue = sequenceValue ?? 0;
                sequenceValue = Math.max(existingValue, update.$max.value);
            }),
            findOneAndUpdate: jest.fn(async () => {
                sequenceValue += 1;
                return { value: sequenceValue };
            })
        };

        await expect(allocateEmployeeId({ EmployeeModel, SequenceModel })).resolves.toBe('EMP009');
        await expect(allocateEmployeeId({ EmployeeModel, SequenceModel })).resolves.toBe('EMP010');
    });

    test('continues when another request creates the sequence first', async () => {
        const EmployeeModel = {
            aggregate: jest.fn().mockResolvedValue([{ value: 8 }])
        };
        const SequenceModel = {
            updateOne: jest.fn().mockRejectedValue({ code: 11000 }),
            findOneAndUpdate: jest.fn().mockResolvedValue({ value: 9 })
        };

        await expect(allocateEmployeeId({ EmployeeModel, SequenceModel })).resolves.toBe('EMP009');
    });

    test('does not hide unexpected sequence errors', async () => {
        const databaseError = new Error('database unavailable');
        const EmployeeModel = {
            aggregate: jest.fn().mockResolvedValue([{ value: 8 }])
        };
        const SequenceModel = {
            updateOne: jest.fn().mockRejectedValue(databaseError)
        };

        await expect(allocateEmployeeId({ EmployeeModel, SequenceModel })).rejects.toBe(databaseError);
    });
});
