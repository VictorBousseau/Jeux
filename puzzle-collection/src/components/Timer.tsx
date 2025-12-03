import { useEffect } from "react";

interface TimerProps {
    isRunning: boolean;
    time: number;
    onTimeUpdate: (time: number | ((prev: number) => number)) => void;
}

export function Timer({ isRunning, time, onTimeUpdate }: TimerProps) {
    useEffect(() => {
        let interval: any;
        if (isRunning) {
            interval = setInterval(() => {
                onTimeUpdate((prev) => prev + 10);
            }, 10);
        }
        return () => clearInterval(interval);
    }, [isRunning, onTimeUpdate]);

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
