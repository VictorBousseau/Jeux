import { useEffect, useState } from "react";

interface TimerProps {
    isRunning: boolean;
    onTimeUpdate: (time: number) => void;
}

export function Timer({ isRunning, onTimeUpdate }: TimerProps) {
    const [time, setTime] = useState(0);

    useEffect(() => {
        let interval: any;
        if (isRunning) {
            interval = setInterval(() => {
                setTime((prev) => {
                    const newTime = prev + 10; // Increment by 10ms
                    onTimeUpdate(newTime);
                    return newTime;
                });
            }, 10);
        }
        return () => clearInterval(interval);
    }, [isRunning, onTimeUpdate]);

    // Reset timer when it stops running and is 0 (new game)
    useEffect(() => {
        if (!isRunning && time === 0) {
            setTime(0);
        }
    }, [isRunning, time]);

    const formatTime = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const milliseconds = Math.floor((ms % 1000) / 10);
        return `${minutes}:${seconds.toString().padStart(2, '0')}:${milliseconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="font-mono text-xl font-bold bg-gray-800 text-white px-4 py-2 rounded-lg">
            {formatTime(time)}
        </div>
    );
}
