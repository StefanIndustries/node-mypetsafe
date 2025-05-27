export interface Message {
    message_type: string;
    created_at: string;
    payload: {
        isFoodLow: number;
        amount: number;
        source: string;
        h: number;
        m: number;
        sensorReading1Infrared: number;
        sensorReading2Infrared: number;
        time: number;
    };
}