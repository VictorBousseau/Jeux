import { useEffect, useState } from "react";
import { generateLevel, isValidPlacement, type Cell as CellType, type Level } from "../lib/gameLogic";
import { Cell } from "./Cell";
import { Timer } from "./Timer";
import { Auth } from "./Auth";
import { Leaderboard } from "./Leaderboard";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        startNewGame(gridSize);
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
                const newLevel = generateLevel(size);
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
                await addDoc(collection(db, "scores"), {
                    username: user.displayName || user.email?.split('@')[0] || "Anonymous",
                    timeSeconds: time,
                    gridSize: gridSize,
                    userId: user.uid,
                    createdAt: serverTimestamp()
                });
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
                <div className="text-red-500 text-xl">{error}</div>
                <button
                    onClick={() => startNewGame(gridSize)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row items-start justify-center gap-8 p-4">
            {/* Left Column: Game */}
            <div className="flex flex-col items-center gap-6">
                <div className="flex items-center justify-between w-full max-w-md">
                    <h1 className="text-2xl font-bold text-gray-800">Queens</h1>
                    <Timer isRunning={isRunning} onTimeUpdate={setTime} />
                    <div className="flex gap-2">
                        <select
                            value={gridSize}
                            onChange={(e) => setGridSize(Number(e.target.value))}
                            className="px-2 py-2 border rounded-lg bg-white text-gray-700 text-sm"
                        >
                            <option value={7}>7x7</option>
                            <option value={8}>8x8</option>
                            <option value={9}>9x9</option>
                        </select>
                        <button
                            onClick={() => startNewGame(gridSize)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                            New Game
                        </button>
                    </div>
                </div>

                <div
                    className="grid gap-0 border-2 border-gray-800 relative"
                    style={{
                        gridTemplateColumns: `repeat(${level?.size || gridSize}, minmax(0, 1fr))`,
                        gridTemplateRows: `repeat(${level?.size || gridSize}, minmax(0, 1fr))`,
                        width: 'min(90vw, 500px)',
                        height: 'min(90vw, 500px)'
                    }}
                >
                    {(loading || !level) ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                            <div className="text-xl font-bold text-gray-600">Generating Level...</div>
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

                <div className="text-sm text-gray-500 max-w-md text-center">
                    Place {level?.size || gridSize} queens. One per row, column, and color. Queens cannot touch.
                    <br />
                    <span className="text-xs">(Left click to place Queen, Right click to place X)</span>
                </div>
            </div>

            {/* Right Column: Auth & Leaderboard */}
            <div className="flex flex-col gap-6 w-full max-w-sm">
                <Auth user={user} />
                <Leaderboard gridSize={gridSize} refreshTrigger={refreshLeaderboard} />
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
