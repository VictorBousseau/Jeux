import { useEffect, useState } from "react";
import { Cell } from "./Cell";
import { generateLevel, checkWin, validateBoard, type CellState, type Level } from "./gameLogic";
import { Timer } from "../../components/Timer";
import { Auth } from "../../components/Auth";
import { Leaderboard } from "../../components/Leaderboard";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { addDoc, collection, serverTimestamp, query, where, getDocs } from "firebase/firestore";

export function Grid() {
    const [level, setLevel] = useState<Level | null>(null);
    const [grid, setGrid] = useState<CellState[][]>([]);
    const [won, setWon] = useState(false);
    const [gridSize, setGridSize] = useState(6);
    const [loading, setLoading] = useState(true);

    // Auth & Timer state
    const [user, setUser] = useState<User | null>(null);
    const [time, setTime] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [refreshLeaderboard, setRefreshLeaderboard] = useState(0);

    const [savingScore, setSavingScore] = useState(false);
    const [saveError, setSaveError] = useState("");

    const [gameMode, setGameMode] = useState<'practice' | 'daily'>('practice');
    const [dailyStarted, setDailyStarted] = useState(false);
    const [hasPlayedDaily, setHasPlayedDaily] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const checkDailyStatus = async () => {
            if (gameMode === 'daily' && user) {
                const today = new Date().toISOString().split('T')[0];
                const q = query(
                    collection(db, "scores"),
                    where("userId", "==", user.uid),
                    where("challengeDate", "==", today),
                    where("gameType", "==", "tango")
                );
                const snapshot = await getDocs(q);
                setHasPlayedDaily(!snapshot.empty);
            } else {
                setHasPlayedDaily(false);
            }
        };
        checkDailyStatus();
    }, [gameMode, user]);

    useEffect(() => {
        if (gameMode === 'daily') {
            setGridSize(6); // Fixed size for daily (6x6)
            setDailyStarted(false);
        } else {
            startNewGame(gridSize);
        }
    }, [gameMode]);

    useEffect(() => {
        if (gameMode === 'practice') {
            startNewGame(gridSize);
        }
    }, [gridSize]);

    const startNewGame = (size: number = gridSize) => {
        setLoading(true);
        setWon(false);
        setTime(0);
        setIsRunning(false);

        setTimeout(() => {
            try {
                let seed: string | undefined;
                if (gameMode === 'daily') {
                    const today = new Date().toISOString().split('T')[0];
                    seed = "tango-" + today;
                }

                const newLevel = generateLevel(size, seed);
                setLevel(newLevel);
                setGrid(newLevel.grid);
            } catch (e) {
                console.error("Failed to generate level", e);
            } finally {
                setLoading(false);
            }
        }, 100);
    };

    const handleDailyStart = () => {
        if (hasPlayedDaily) return;
        setDailyStarted(true);
        startNewGame(6);
    };

    const handleCellClick = (r: number, c: number) => {
        if (won || !grid[r][c] || grid[r][c].isFixed) return;
        if (!isRunning) setIsRunning(true);

        const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
        const currentVal = newGrid[r][c].value;

        // Cycle: null -> SUN -> MOON -> null
        if (currentVal === null) newGrid[r][c].value = 'SUN';
        else if (currentVal === 'SUN') newGrid[r][c].value = 'MOON';
        else newGrid[r][c].value = null;

        // Reset errors
        newGrid.forEach(row => row.forEach(cell => cell.isError = false));

        // Validate
        const errors = validateBoard(newGrid);
        errors.forEach(err => {
            newGrid[err.r][err.c].isError = true;
        });

        setGrid(newGrid);

        if (checkWin(newGrid)) {
            handleWin();
        }
    };

    const handleWin = async () => {
        setWon(true);
        setIsRunning(false);

        if (user) {
            setSavingScore(true);
            setSaveError("");
            try {
                const scoreData: any = {
                    username: user.displayName || user.email?.split('@')[0] || "Anonymous",
                    timeSeconds: time,
                    gridSize: gridSize,
                    userId: user.uid,
                    createdAt: serverTimestamp(),
                    gameType: 'tango'
                };

                if (gameMode === 'daily') {
                    scoreData.challengeDate = new Date().toISOString().split('T')[0];
                }

                await addDoc(collection(db, "scores"), scoreData);
                setRefreshLeaderboard(prev => prev + 1);
            } catch (e: any) {
                console.error("Error saving score:", e);
                setSaveError(e.message || "Error saving score");
            } finally {
                setSavingScore(false);
            }
        }
    };

    return (
        <div className="flex flex-col lg:flex-row items-start justify-center gap-8 p-8 max-w-7xl mx-auto">
            {/* Left Column: Game */}
            <div className="flex flex-col items-center gap-8 w-full max-w-xl">
                {/* Header Section */}
                <div className="flex flex-col w-full gap-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                            <span>☀️</span> Tango <span>🌑</span>
                        </h1>

                        <div className="bg-gray-100 p-1.5 rounded-xl flex gap-1 shadow-inner">
                            <button
                                onClick={() => setGameMode('practice')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${gameMode === 'practice' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                            >
                                Practice
                            </button>
                            <button
                                onClick={() => setGameMode('daily')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${gameMode === 'daily' ? 'bg-white shadow-sm text-purple-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
                            >
                                Daily
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                        <Timer isRunning={isRunning} time={time} onTimeUpdate={setTime} />

                        {gameMode === 'practice' && (
                            <div className="flex gap-3 items-center">
                                <select
                                    value={gridSize}
                                    onChange={(e) => setGridSize(Number(e.target.value))}
                                    className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all cursor-pointer hover:bg-gray-100"
                                >
                                    <option value={6}>6x6 Grid</option>
                                    <option value={8}>8x8 Grid</option>
                                </select>
                                <button
                                    onClick={() => startNewGame(gridSize)}
                                    className="px-5 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-all shadow-md hover:shadow-lg active:scale-95 text-sm font-bold"
                                >
                                    New Game
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Grid Container */}
                <div
                    className="grid gap-0 border-4 border-gray-800 bg-gray-800 rounded-lg overflow-hidden shadow-2xl relative"
                    style={{
                        gridTemplateColumns: `repeat(${level?.size || gridSize}, minmax(0, 1fr))`,
                        width: 'min(90vw, 500px)',
                        height: 'min(90vw, 500px)'
                    }}
                >
                    {(loading || !level || (gameMode === 'daily' && !dailyStarted)) ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/98 z-10 p-8 text-center backdrop-blur-sm">
                            {loading ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                    <div className="text-xl font-bold text-gray-600">Generating Level...</div>
                                </div>
                            ) : gameMode === 'daily' ? (
                                hasPlayedDaily ? (
                                    <div className="animate-in fade-in zoom-in duration-500">
                                        <div className="text-6xl mb-4">✅</div>
                                        <h2 className="text-3xl font-extrabold text-green-600 mb-3">Challenge Complete!</h2>
                                        <p className="text-gray-600 mb-8 text-lg">
                                            You've mastered today's puzzle.<br />
                                            Come back tomorrow for a new challenge!
                                        </p>
                                        <div className="text-sm font-medium text-gray-500 bg-gray-100 py-2 px-4 rounded-full inline-block">
                                            Check the leaderboard to see your rank 🏆
                                        </div>
                                    </div>
                                ) : !dailyStarted ? (
                                    <div className="animate-in fade-in zoom-in duration-500">
                                        <div className="text-6xl mb-4">📅</div>
                                        <h2 className="text-3xl font-extrabold text-purple-600 mb-3">Daily Challenge</h2>
                                        <p className="text-gray-600 mb-8 text-lg max-w-xs mx-auto">
                                            Join players worldwide in solving today's unique 8x8 puzzle.
                                        </p>
                                        <button
                                            onClick={handleDailyStart}
                                            className="px-10 py-4 bg-purple-600 text-white text-xl font-bold rounded-2xl hover:bg-purple-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0"
                                        >
                                            Start Challenge
                                        </button>
                                    </div>
                                ) : null
                            ) : null}
                        </div>
                    ) : (
                        grid.map((row, r) =>
                            row.map((cell, c) => (
                                <Cell
                                    key={`${r}-${c}`}
                                    cell={cell}
                                    onClick={() => handleCellClick(r, c)}
                                />
                            ))
                        )
                    )}
                </div>

                <div className="text-gray-500 text-sm max-w-md text-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <p className="font-bold mb-2">Rules:</p>
                    <ul className="text-left list-disc pl-4 space-y-1">
                        <li>No more than 2 same symbols adjacent.</li>
                        <li>Equal number of Sun/Moon in each row/col.</li>
                        <li>No two rows or columns are identical.</li>
                    </ul>
                </div>
            </div>

            {/* Right Column: Auth & Leaderboard */}
            <div className="flex flex-col gap-6 w-full max-w-sm lg:sticky lg:top-8">
                <Auth user={user} />
                <Leaderboard
                    gridSize={gridSize}
                    refreshTrigger={refreshLeaderboard}
                    challengeDate={gameMode === 'daily' ? new Date().toISOString().split('T')[0] : undefined}
                    gameType="tango"
                />
            </div>

            {won && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm fixed top-0 left-0 w-full h-full">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl transform text-center max-w-md mx-4">
                        <div className="text-6xl mb-4">🎉</div>
                        <h2 className="text-3xl font-extrabold text-green-600 mb-2">Level Complete!</h2>
                        <p className="text-gray-500 mb-6">Great job solving the puzzle!</p>
                        <p className="text-xl font-mono font-bold mb-6">
                            Time: {Math.floor(time / 60000)}:{String(Math.floor((time % 60000) / 1000)).padStart(2, '0')}:{String(Math.floor((time % 1000) / 10)).padStart(2, '0')}
                        </p>

                        {user ? (
                            <div className="mb-4">
                                {savingScore && <p className="text-blue-600">Saving score...</p>}
                                {saveError && <p className="text-red-500">Error: {saveError}</p>}
                                {!savingScore && !saveError && <p className="text-green-600 font-bold">Score Saved!</p>}
                            </div>
                        ) : (
                            <p className="text-sm text-amber-600 mb-4">Log in to save your score!</p>
                        )}

                        <button
                            onClick={() => startNewGame(gridSize)}
                            className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg"
                        >
                            Play Again
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
