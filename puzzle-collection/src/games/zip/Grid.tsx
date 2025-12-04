import { useEffect, useState } from "react";
import { Cell } from "./Cell";
import { generateLevel, isValidMove, checkWin, type ZipCellState, type Level } from "./gameLogic";
import { Timer } from "../../components/Timer";
import { Auth } from "../../components/Auth";
import { Leaderboard } from "../../components/Leaderboard";
import { AdminPanel } from "../../components/AdminPanel";
import { useAdmin } from "../../hooks/useAdmin";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { addDoc, collection, serverTimestamp, query, where, getDocs, doc, onSnapshot } from "firebase/firestore";

export function Grid() {
    const [level, setLevel] = useState<Level | null>(null);
    const [grid, setGrid] = useState<ZipCellState[][]>([]);
    const [lastFilled, setLastFilled] = useState<{ r: number, c: number } | null>(null);
    const [won, setWon] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [path, setPath] = useState<{ r: number, c: number }[]>([]);
    const [gridSize, setGridSize] = useState(7);
    const [loading, setLoading] = useState(true);

    // Auth & Timer state
    const [user, setUser] = useState<User | null>(null);
    const isAdmin = useAdmin(user);
    const [time, setTime] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [refreshLeaderboard, setRefreshLeaderboard] = useState(0);

    const [savingScore, setSavingScore] = useState(false);
    const [saveError, setSaveError] = useState("");

    const [gameMode, setGameMode] = useState<'practice' | 'daily'>('practice');
    const [dailyStarted, setDailyStarted] = useState(false);
    const [hasPlayedDaily, setHasPlayedDaily] = useState(false);
    const [dailySeedVersion, setDailySeedVersion] = useState(0);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsubscribe();
    }, []);

    // Listen for daily config changes
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const unsub = onSnapshot(doc(db, "dailyConfig", today), (doc) => {
            if (doc.exists()) {
                setDailySeedVersion(doc.data().seedVersion || 0);
            } else {
                setDailySeedVersion(0);
            }
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const checkDailyStatus = async () => {
            if (gameMode === 'daily' && user) {
                const today = new Date().toISOString().split('T')[0];
                const q = query(
                    collection(db, "scores"),
                    where("userId", "==", user.uid),
                    where("challengeDate", "==", today),
                    where("gameType", "==", "zip")
                );
                const snapshot = await getDocs(q);
                setHasPlayedDaily(!snapshot.empty);
            } else {
                setHasPlayedDaily(false);
            }
        };
        checkDailyStatus();
    }, [gameMode, user, refreshLeaderboard]);

    useEffect(() => {
        if (gameMode === 'daily') {
            setGridSize(9); // Fixed size for daily
            setDailyStarted(false);
            if (dailyStarted) {
                startNewGame(9);
            }
        } else {
            startNewGame(gridSize);
        }
    }, [gameMode, dailySeedVersion]);

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
                    seed = "zip-" + today + (dailySeedVersion > 0 ? `-v${dailySeedVersion}` : '');
                }

                const newLevel = generateLevel(size, seed);
                setLevel(newLevel);

                // Find start (Checkpoint 1)
                let start = { r: 0, c: 0 };
                for (let r = 0; r < newLevel.size; r++) {
                    for (let c = 0; c < newLevel.size; c++) {
                        if (newLevel.grid[r][c].value === 1) {
                            start = { r, c };
                            newLevel.grid[r][c].pathIndex = 0;
                        }
                    }
                }

                setGrid(newLevel.grid);
                setLastFilled(start);
                setPath([start]);
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
        startNewGame(9);
    };

    const handleInteraction = (r: number, c: number) => {
        if (won || !level || !lastFilled) return;
        if (!isRunning) setIsRunning(true);

        const cell = grid[r][c];

        // 1. Smart Undo: clicking anywhere on the existing path
        if (cell.pathIndex !== null) {
            const newPathLength = cell.pathIndex + 1;

            // If clicking an earlier cell (not the current head), truncate path
            if (newPathLength < path.length) {
                const newGrid = grid.map(row => row.map(c => ({ ...c })));

                // Clear pathIndex for removed cells
                for (let i = newPathLength; i < path.length; i++) {
                    const p = path[i];
                    newGrid[p.r][p.c].pathIndex = null;
                }

                setGrid(newGrid);
                setPath(path.slice(0, newPathLength));
                setLastFilled({ r, c });
                setWon(false);
                return;
            }
        }

        // 2. Move logic
        if (isValidMove(grid, lastFilled, { r, c })) {
            // Check if we hit a checkpoint
            if (cell.isCheckpoint) {
                // Must be the NEXT checkpoint
                // Find current max checkpoint visited
                let maxCheckpoint = 0;
                path.forEach(p => {
                    const val = grid[p.r][p.c].value;
                    if (val && val > maxCheckpoint) maxCheckpoint = val;
                });

                if (cell.value !== maxCheckpoint + 1) return; // Invalid checkpoint order
            }

            const newGrid = grid.map(row => row.map(c => ({ ...c })));
            newGrid[r][c].pathIndex = path.length;

            const newPath = [...path, { r, c }];
            setGrid(newGrid);
            setPath(newPath);
            setLastFilled({ r, c });

            if (checkWin(newGrid, level)) {
                handleWin();
            }
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
                    gameType: 'zip'
                };

                if (gameMode === 'daily') {
                    scoreData.challengeDate = new Date().toISOString().split('T')[0];
                }

                await addDoc(collection(db, "scores"), scoreData);
                if (gameMode === 'daily') {
                    setHasPlayedDaily(true);
                }
                setRefreshLeaderboard(prev => prev + 1);
            } catch (e: any) {
                console.error("Error saving score:", e);
                setSaveError(e.message || "Error saving score");
            } finally {
                setSavingScore(false);
            }
        }
    };

    const handleMouseDown = (r: number, c: number) => {
        setIsDragging(true);
        handleInteraction(r, c);
    };

    const handleMouseEnter = (r: number, c: number) => {
        if (isDragging) {
            handleInteraction(r, c);
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    return (
        <div
            className="flex flex-col lg:flex-row items-start justify-center gap-8 p-8 max-w-7xl mx-auto"
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Left Column: Game */}
            <div className="flex flex-col items-center gap-8 w-full max-w-xl">
                {/* Header Section */}
                <div className="flex flex-col w-full gap-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                            <span>⚡</span> Zip
                        </h1>

                        <div className="bg-gray-100 p-1.5 rounded-xl flex gap-1 shadow-inner">
                            <button
                                onClick={() => setGameMode('practice')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${gameMode === 'practice' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
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
                                    className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer hover:bg-gray-100"
                                >
                                    <option value={7}>7x7 Grid</option>
                                    <option value={9}>9x9 Grid</option>
                                    <option value={11}>11x11 Grid</option>
                                </select>
                                <button
                                    onClick={() => startNewGame(gridSize)}
                                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95 text-sm font-bold"
                                >
                                    New Game
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Grid Container */}
                <div
                    className="grid gap-0 border-4 border-slate-800 bg-slate-800 rounded-xl overflow-hidden shadow-2xl select-none touch-none relative"
                    style={{
                        gridTemplateColumns: `repeat(${level?.size || gridSize}, minmax(0, 1fr))`,
                        width: 'min(90vw, 500px)',
                        height: 'min(90vw, 500px)'
                    }}
                >
                    {(loading || !level || (gameMode === 'daily' && (!dailyStarted || hasPlayedDaily))) ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/98 z-10 p-8 text-center backdrop-blur-sm">
                            {loading ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
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
                                            Join players worldwide in solving today's unique 9x9 puzzle.
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
                            row.map((cell, c) => {
                                // Find prev/next for line drawing
                                const pIndex = cell.pathIndex;
                                let prevCell = undefined;
                                let nextCell = undefined;

                                if (pIndex !== null) {
                                    if (pIndex > 0) {
                                        const p = path[pIndex - 1];
                                        prevCell = grid[p.r][p.c];
                                    }
                                    if (pIndex < path.length - 1) {
                                        const n = path[pIndex + 1];
                                        nextCell = grid[n.r][n.c];
                                    }
                                }

                                return (
                                    <Cell
                                        key={`${r}-${c}`}
                                        cell={cell}
                                        onClick={() => handleInteraction(r, c)}
                                        onMouseDown={() => handleMouseDown(r, c)}
                                        onMouseEnter={() => handleMouseEnter(r, c)}
                                        isNext={lastFilled ? isValidMove(grid, lastFilled, { r, c }) : false}
                                        prevCell={prevCell}
                                        nextCell={nextCell}
                                    />
                                );
                            })
                        )
                    )}
                </div>

                <div className="text-gray-500 text-sm max-w-md text-center">
                    Connect checkpoints 1 to {level?.checkpoints}.<br />
                    Visit ALL cells.
                </div>
            </div>

            {/* Right Column: Auth & Leaderboard */}
            <div className="flex flex-col gap-6 w-full max-w-sm lg:sticky lg:top-8">
                {isAdmin && <AdminPanel />}
                <Auth user={user} />
                <Leaderboard
                    gridSize={gridSize}
                    refreshTrigger={refreshLeaderboard}
                    challengeDate={gameMode === 'daily' ? new Date().toISOString().split('T')[0] : undefined}
                    gameType="zip"
                />
            </div>

            {won && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm fixed top-0 left-0 w-full h-full">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl transform text-center max-w-md mx-4">
                        <div className="text-6xl mb-4">🎉</div>
                        <h2 className="text-3xl font-extrabold text-green-600 mb-2">Level Complete!</h2>
                        <p className="text-gray-500 mb-6">You connected all checkpoints!</p>
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
                            onClick={() => {
                                if (gameMode === 'daily') {
                                    setWon(false);
                                } else {
                                    startNewGame(gridSize);
                                }
                            }}
                            className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-lg"
                        >
                            {gameMode === 'daily' ? 'Close' : 'Play Again'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
