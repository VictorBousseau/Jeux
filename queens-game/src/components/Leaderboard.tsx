import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface Score {
    id: string;
    username: string;
    timeSeconds: number; // This now stores milliseconds despite the name (legacy)
    gridSize: number;
    userId: string;
    createdAt: any;
}

interface LeaderboardProps {
    gridSize: number;
    refreshTrigger: number;
}

export function Leaderboard({ gridSize, refreshTrigger }: LeaderboardProps) {
    const [scores, setScores] = useState<Score[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUserId(user ? user.uid : null);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchScores = async () => {
            setLoading(true);
            setError("");
            try {
                const q = query(
                    collection(db, "scores"),
                    where("gridSize", "==", gridSize),
                    where("timeSeconds", ">", 1000), // Filter out legacy scores (stored as seconds)
                    orderBy("timeSeconds", "asc"),
                    limit(10)
                );
                const querySnapshot = await getDocs(q);
                const fetchedScores: Score[] = [];
                querySnapshot.forEach((doc) => {
                    fetchedScores.push({ id: doc.id, ...doc.data() } as Score);
                });
                setScores(fetchedScores);
            } catch (error: any) {
                console.error("Error fetching leaderboard:", error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchScores();
    }, [gridSize, refreshTrigger]);

    if (loading) return <div className="text-sm text-gray-500">Loading top scores...</div>;
    if (error) return <div className="text-sm text-red-500">Error loading scores: {error}</div>;

    return (
        <div className="bg-white p-4 rounded-lg shadow-md w-full max-w-sm">
            <h3 className="font-bold text-lg mb-3 border-b pb-2">Top 10 Scores ({gridSize}x{gridSize})</h3>
            {scores.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No scores yet. Be the first!</p>
            ) : (
                <ul className="space-y-2">
                    {scores.map((score, index) => (
                        <li key={score.id} className={`flex justify-between text-sm items-center ${score.userId === currentUserId ? 'bg-blue-50 p-1 rounded' : ''}`}>
                            <span className="flex items-center gap-2">
                                <span className={`
                    w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold
                    ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                        index === 1 ? 'bg-gray-100 text-gray-700' :
                                            index === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-500'}
                `}>
                                    {index + 1}
                                </span>
                                <span className="font-medium truncate max-w-[120px]">{score.username}</span>
                            </span>
                            <span className="font-mono text-gray-600">
                                {Math.floor(score.timeSeconds / 60000)}:{String(Math.floor((score.timeSeconds % 60000) / 1000)).padStart(2, '0')}:{String(Math.floor((score.timeSeconds % 1000) / 10)).padStart(2, '0')}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
