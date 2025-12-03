import { useEffect, useState } from "react";
import { generateLevel, isValidPlacement, type Cell as CellType, type Level } from "./gameLogic";
import { Cell } from "./Cell";
import { Timer } from "../../components/Timer";
import { Auth } from "../../components/Auth";
import { Leaderboard } from "../../components/Leaderboard";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { addDoc, collection, serverTimestamp, query, where, getDocs } from "firebase/firestore";

const REGION_COLORS = [
    "#E69F00", // Orange
    "#56B4E9", // Sky Blue
    "#009E73", // Bluish Green
    "#F0E442", // Yellow
    "#0072B2", // Blue
    "#D55E00", // Vermilion
    "#CC79A7", // Reddish Purple
    "#999999", // Grey
    "#F5C710", // Gold
    "#FFFFFF", // White
];

export function Grid() {
    const [gridSize, setGridSize] = useState(8);
    const [level, setLevel] = useState<Level | null>(null);
    const [board, setBoard] = useState<CellType[][]>([]);
    const [loading, setLoading] = useState(true);
    const [won, setWon] = useState(false);

    // Auth & Timer state
    const [user, setUser] = useState<User | null>(null);
    const [time, setTime] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [refreshLeaderboard, setRefreshLeaderboard] = useState(0);

    const [savingScore, setSavingScore] = useState(false);
    const [saveError, setSaveError] = useState("");

    const [error, setError] = useState("");

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
                    where("challengeDate", "==", today)
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
            setGridSize(9); // Fixed size for daily
            setDailyStarted(false);
            // Don't generate level yet, wait for start
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
        setError(""); // Reset error
        setWon(false);
        setTime(0);
        setIsRunning(false); // Will start on first click

        // Use timeout to allow UI to render loading state
        setTimeout(() => {
            try {
                let seed: string | undefined;
                if (gameMode === 'daily') {
                    const today = new Date().toISOString().split('T')[0];
                    seed = today;
                }

                const newLevel = generateLevel(size, seed);
                setLevel(newLevel);
                const initialBoard = newLevel.regions.map((row, r) =>
                    row.map((regionId, c) => ({
                        row: r,
                        col: c,
                        regionId,
                        state: "EMPTY",
                        isError: false,
                    } as CellType))
                );
                setBoard(initialBoard);
            } catch (e: any) {
                console.error(e);
                setError(e.message || "Failed to generate level");
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

    useEffect(() => {
        if (board.length > 0 && !won) {
            checkWin(board);
        }
    }, [board]);

    const handleCellClick = (r: number, c: number) => {
        if (won) return;
        if (!isRunning) setIsRunning(true);

        setBoard((prev) => {
            const newBoard = prev.map((row) => row.map((cell) => ({ ...cell })));
            const cell = newBoard[r][c];

            if (cell.state === "QUEEN") {
                cell.state = "EMPTY";
            } else {
                cell.state = "QUEEN";
            }

            updateErrors(newBoard);
            return newBoard;
        });
    };

    const handleRightClick = (e: React.MouseEvent, r: number, c: number) => {
        e.preventDefault();
        if (won) return;
        if (!isRunning) setIsRunning(true);

        setBoard((prev) => {
            const newBoard = prev.map((row) => row.map((cell) => ({ ...cell })));
            const cell = newBoard[r][c];

            if (cell.state === "CROSS") {
                cell.state = "EMPTY";
            } else {
                cell.state = "CROSS";
            }

            updateErrors(newBoard);
            return newBoard;
        });
    };

    const updateErrors = (currentBoard: CellType[][]) => {
        const size = currentBoard.length;
        // Reset errors
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                currentBoard[r][c].isError = false;
            }
        }

        // Check for conflicts
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (currentBoard[r][c].state === "QUEEN") {
                    if (!isValidPlacement(currentBoard, r, c, size)) {
                        markConflicts(currentBoard, r, c, size);
                    }
                }
            }
        }
    };

    const markConflicts = (board: CellType[][], row: number, col: number, size: number) => {
        board[row][col].isError = true;
        // Mark row conflicts
        for (let c = 0; c < size; c++) {
            if (c !== col && board[row][c].state === 'QUEEN') board[row][c].isError = true;
        }
        // Mark col conflicts
        for (let r = 0; r < size; r++) {
            if (r !== row && board[r][col].state === 'QUEEN') board[r][col].isError = true;
        }
        // Mark region conflicts
        const regionId = board[row][col].regionId;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if ((r !== row || c !== col) && board[r][c].regionId === regionId && board[r][c].state === 'QUEEN') {
                    board[r][c].isError = true;
                }
            }
        }
        // Mark touching conflicts
        const dirs = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        for (const [dr, dc] of dirs) {
            const nr = row + dr, nc = col + dc;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size && board[nr][nc].state === 'QUEEN') {
                board[nr][nc].isError = true;
            }
        }
    };

    const checkWin = (currentBoard: CellType[][]) => {
        const size = currentBoard.length;
        let queensCount = 0;
        let hasErrors = false;

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (currentBoard[r][c].state === "QUEEN") {
                    queensCount++;
                }
                if (currentBoard[r][c].isError) {
                    hasErrors = true;
                }
            }
        }

        if (queensCount === size && !hasErrors) {
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
                    gameType: 'queens'
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

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
                <div className="text-red-500 text-xl font-medium bg-red-50 px-6 py-4 rounded-xl border border-red-100">{error}</div>
                <button
                    onClick={() => startNewGame(gridSize)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row items-start justify-center gap-8 p-8 max-w-7xl mx-auto">
            {/* Left Column: Game */}
            <div className="flex flex-col items-center gap-8 w-full max-w-xl">
                {/* Header Section */}
                <div className="flex flex-col w-full gap-6">
                    <div className="flex items-center justify-between">
                        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                            <span className="text-4xl">👑</span> Queens
                        </h1>

                        <div className="bg-gray-100 p-1.5 rounded-xl flex gap-1 shadow-inner">
                            <button
                                onClick={() => setGameMode('practice')}
                                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${gameMode === 'practice' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}
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
                                <div className="relative">
                                    <select
                                        value={gridSize}
                                        onChange={(e) => setGridSize(Number(e.target.value))}
                                        className="appearance-none pl-4 pr-10 py-2.5 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer hover:bg-gray-100"
                                    >
                                        <option value={7}>7x7 Grid</option>
                                        <option value={8}>8x8 Grid</option>
                                        <option value={9}>9x9 Grid</option>
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                                <button
                                    onClick={() => startNewGame(gridSize)}
                                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg active:scale-95 text-sm font-bold flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                    New Game
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Grid Container */}
                <div
                    className="grid gap-0 border-4 border-gray-800 relative rounded-lg overflow-hidden shadow-2xl"
                    style={{
                        gridTemplateColumns: `repeat(${level?.size || gridSize}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${level?.size || gridSize}, minmax(0, 1fr))`,
                        width: 'min(85vw, 500px)',
                        height: 'min(85vw, 500px)'
                    }}
                >
                    {(loading || !level || (gameMode === 'daily' && !dailyStarted)) ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/98 z-10 p-8 text-center backdrop-blur-sm">
                            {loading ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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
                        board.map((row, r) =>
                            row.map((cell, c) => (
                                <Cell
                                    key={`${r}-${c}`}
                                    cell={cell}
                                    color={REGION_COLORS[cell.regionId % REGION_COLORS.length]}
                                    onClick={() => handleCellClick(r, c)}
                                    onRightClick={(e) => handleRightClick(e, r, c)}
                                />
                            ))
                        )
                    )}
                </div>

                <div className="text-sm text-gray-500 max-w-md text-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <p className="font-medium text-gray-700 mb-1">How to play</p>
                    Place <span className="font-bold text-blue-600">{level?.size || gridSize} queens</span>. One per row, column, and color. Queens cannot touch correctly.
                    <div className="mt-2 text-xs text-gray-400 flex justify-center gap-4">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Left click: Queen</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Right click: Cross</span>
                    </div>
                </div>
            </div>

            {/* Right Column: Auth & Leaderboard */}
            <div className="flex flex-col gap-6 w-full max-w-sm lg:sticky lg:top-8">
                <Auth user={user} />
                <Leaderboard
                    gridSize={gridSize}
                    refreshTrigger={refreshLeaderboard}
                    challengeDate={gameMode === 'daily' ? new Date().toISOString().split('T')[0] : undefined}
                    gameType="queens"
                />
            </div>

            {won && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-xl shadow-2xl text-center animate-in fade-in zoom-in duration-300">
                        <h2 className="text-4xl font-bold text-green-600 mb-4">You Won!</h2>
                        <p className="text-gray-600 mb-2">Great job solving the puzzle.</p>
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
                            className="px-6 py-3 bg-blue-600 text-white text-lg rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Play Again
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
