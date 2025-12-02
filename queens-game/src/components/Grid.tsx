import { useEffect, useState } from "react";
import { generateLevel, isValidPlacement, type Cell as CellType, type Level } from "../lib/gameLogic";
import { Cell } from "./Cell";

const REGION_COLORS = [
    "#ffadad", // pastel red
    "#ffd6a5", // pastel orange
    "#fdffb6", // pastel yellow
    "#caffbf", // pastel green
    "#9bf6ff", // pastel cyan
    "#a0c4ff", // pastel blue
    "#bdb2ff", // pastel purple
    "#ffc6ff", // pastel pink
    "#fffffc", // pastel white/cream
    "#d4d4d4", // light gray
];

export function Grid() {
    const [level, setLevel] = useState<Level | null>(null);
    const [board, setBoard] = useState<CellType[][]>([]);
    const [loading, setLoading] = useState(true);
    const [won, setWon] = useState(false);

    useEffect(() => {
        startNewGame();
    }, []);

    const startNewGame = () => {
        setLoading(true);
        setWon(false);
        // Use timeout to allow UI to render loading state
        setTimeout(() => {
            try {
                const newLevel = generateLevel(8);
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
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }, 100);
    };

    const handleCellClick = (r: number, c: number) => {
        if (won) return;
        setBoard((prev) => {
            const newBoard = prev.map((row) => row.map((cell) => ({ ...cell })));
            const cell = newBoard[r][c];

            if (cell.state === "QUEEN") {
                cell.state = "EMPTY";
            } else {
                cell.state = "QUEEN";
            }

            updateErrors(newBoard);
            checkWin(newBoard);
            return newBoard;
        });
    };

    const handleRightClick = (e: React.MouseEvent, r: number, c: number) => {
        e.preventDefault();
        if (won) return;
        setBoard((prev) => {
            const newBoard = prev.map((row) => row.map((cell) => ({ ...cell })));
            const cell = newBoard[r][c];

            if (cell.state === "CROSS") {
                cell.state = "EMPTY";
            } else {
                cell.state = "CROSS";
            }

            // Crosses don't cause errors, but removing a queen might clear them
            updateErrors(newBoard);
            checkWin(newBoard);
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
            setWon(true);
        } else {
            setWon(false);
        }
    };

    if (loading || !level) {
        return <div className="flex items-center justify-center h-64 text-xl">Generating Level...</div>;
    }

    return (
        <div className="flex flex-col items-center gap-6">
            <div className="flex items-center justify-between w-full max-w-md">
                <h1 className="text-2xl font-bold text-gray-800">Queens</h1>
                <button
                    onClick={startNewGame}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    New Game
                </button>
            </div>

            <div
                className="grid gap-0 border-2 border-gray-800"
                style={{
                    gridTemplateColumns: `repeat(${level.size}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${level.size}, minmax(0, 1fr))`,
                    width: 'min(90vw, 500px)',
                    height: 'min(90vw, 500px)'
                }}
            >
                {board.map((row, r) =>
                    row.map((cell, c) => (
                        <Cell
                            key={`${r}-${c}`}
                            cell={cell}
                            color={REGION_COLORS[cell.regionId % REGION_COLORS.length]}
                            onClick={() => handleCellClick(r, c)}
                            onRightClick={(e) => handleRightClick(e, r, c)}
                        />
                    ))
                )}
            </div>

            {won && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-8 rounded-xl shadow-2xl text-center animate-in fade-in zoom-in duration-300">
                        <h2 className="text-4xl font-bold text-green-600 mb-4">You Won!</h2>
                        <p className="text-gray-600 mb-6">Great job solving the puzzle.</p>
                        <button
                            onClick={startNewGame}
                            className="px-6 py-3 bg-blue-600 text-white text-lg rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Play Again
                        </button>
                    </div>
                </div>
            )}

            <div className="text-sm text-gray-500 max-w-md text-center">
                Place {level.size} queens. One per row, column, and color. Queens cannot touch.
                <br />
                <span className="text-xs">(Left click to place Queen, Right click to place X)</span>
            </div>
        </div>
    );
}
