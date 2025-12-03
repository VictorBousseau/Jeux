import { useEffect, useState } from "react";
import { collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";

interface Score {
    id: string;
    username: string;
    timeSeconds: number;
    gridSize: number;
    userId: string;
    createdAt: any;
    gameType?: 'queens' | 'tango' | 'zip';
}

interface LeaderboardProps {
    gridSize: number;
    refreshTrigger: number;
    challengeDate?: string;
    gameType?: 'queens' | 'tango' | 'zip';
}

export function Leaderboard({ gridSize, refreshTrigger, challengeDate, gameType = 'queens' }: LeaderboardProps) {
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
                let q;
                if (challengeDate) {
                    // Daily Challenge Query
                    q = query(
                        collection(db, "scores"),
                        where("challengeDate", "==", challengeDate),
                        where("gameType", "==", gameType),
                        orderBy("timeSeconds", "asc"),
                        limit(10)
                    );
                } else {
                    // Practice Mode Query
                    // Note: We need composite indexes for these queries in Firestore
                    q = query(
                        collection(db, "scores"),
                        where("gridSize", "==", gridSize),
                        where("gameType", "==", gameType),
                        orderBy("timeSeconds", "asc"),
                        limit(10)
                    );
                }

                const querySnapshot = await getDocs(q);
                const fetchedScores: Score[] = [];
                querySnapshot.forEach((doc) => {
                    fetchedScores.push({ id: doc.id, ...doc.data() } as Score);
                });
                setScores(fetchedScores);
            } catch (error: any) {
                console.error("Error fetching leaderboard:", error);
                // Fallback for missing index or legacy data
                if (error.code === 'failed-precondition') {
                    setError("Leaderboard configuration missing (Index).");
                } else {
                    setError(error.message);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchScores();
    }, [gridSize, refreshTrigger, challengeDate, gameType]);

    if (loading) return <div className="text-sm text-gray-500">Loading top scores...</div>;
    if (error) return <div className="text-sm text-red-500">Error: {error}</div>;

    const getIcon = () => {
        switch (gameType) {
            case 'tango': return '☀️';
            case 'zip': return '⚡';
            default: return '👑';
        }
    };

    const getColor = () => {
        switch (gameType) {
            case 'tango': return 'text-orange-600';
            case 'zip': return 'text-indigo-600';
            default: return 'text-blue-600';
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm border border-gray-100">
            <h3 className="font-bold text-xl mb-4 border-b pb-3 text-gray-800 flex items-center gap-2">
                {challengeDate ? (
                    <>
                        <span className="text-purple-600">🏆</span>
                        <span>Daily Challenge</span>
                        <span className="text-xs font-normal text-gray-500 ml-auto">{challengeDate}</span>
                    </>
                ) : (
                    <>
                        <span className={getColor()}>{getIcon()}</span>
                        <span>Top 10 Scores</span>
                        <span className="text-xs font-normal text-gray-500 ml-auto bg-gray-100 px-2 py-1 rounded-full">{gridSize}x{gridSize}</span>
                    </>
                )}
            </h3>

            {scores.length === 0 ? (
                <div className="text-center py-8 text-gray-500 italic bg-gray-50 rounded-lg">
                    No scores yet.<br />Be the first to win!
                </div>
            ) : (
                <ul className="space-y-3">
                    {scores.map((score, index) => (
                        <li key={score.id} className={`flex justify-between text-sm items-center p-2 rounded-lg transition-colors ${score.userId === currentUserId ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-gray-50'}`}>
                            <span className="flex items-center gap-3">
                                <span className={`
                                    w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shadow-sm
                                    ${index === 0 ? 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200' :
                                        index === 1 ? 'bg-gray-100 text-gray-700 ring-1 ring-gray-200' :
                                            index === 2 ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-200' : 'text-gray-400 bg-gray-50'}
                                `}>
                                    {index + 1}
                                </span>
                                <span className={`font-medium truncate max-w-[120px] ${score.userId === currentUserId ? 'text-blue-700' : 'text-gray-700'}`}>
                                    {score.username}
                                </span>
                            </span>
                            <span className="font-mono font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded text-xs">
                                {Math.floor(score.timeSeconds / 60000)}:{String(Math.floor((score.timeSeconds % 60000) / 1000)).padStart(2, '0')}:{String(Math.floor((score.timeSeconds % 1000) / 10)).padStart(2, '0')}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
