import type { ZipCellState } from "./gameLogic";
import { cn } from "../../lib/utils";

interface CellProps {
    cell: ZipCellState;
    onClick: () => void;
    onMouseDown: () => void;
    onMouseEnter: () => void;
    isNext: boolean;
    prevCell?: ZipCellState;
    nextCell?: ZipCellState;
}

export function Cell({ cell, onClick, onMouseDown, onMouseEnter, isNext, prevCell, nextCell }: CellProps) {
    // Determine connection directions
    const hasTop = (prevCell?.row === cell.row - 1 && prevCell?.col === cell.col) || (nextCell?.row === cell.row - 1 && nextCell?.col === cell.col);
    const hasBottom = (prevCell?.row === cell.row + 1 && prevCell?.col === cell.col) || (nextCell?.row === cell.row + 1 && nextCell?.col === cell.col);
    const hasLeft = (prevCell?.row === cell.row && prevCell?.col === cell.col - 1) || (nextCell?.row === cell.row && nextCell?.col === cell.col - 1);
    const hasRight = (prevCell?.row === cell.row && prevCell?.col === cell.col + 1) || (nextCell?.row === cell.row && nextCell?.col === cell.col + 1);

    return (
        <div
            onClick={onClick}
            onMouseDown={onMouseDown}
            onMouseEnter={onMouseEnter}
            className={cn(
                "w-full h-full aspect-square relative flex items-center justify-center select-none transition-colors duration-200 border border-slate-200",
                cell.rightWall && "border-r-4 border-r-slate-800",
                cell.bottomWall && "border-b-4 border-b-slate-800",
                cell.value === null && !cell.pathIndex && "bg-slate-100", // Empty
                cell.pathIndex !== null && "bg-white", // Visited
                isNext && "bg-indigo-50 cursor-pointer ring-2 ring-indigo-300 ring-inset"
            )}
        >
            {/* Path Lines */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {hasTop && <div className="absolute top-0 w-2 h-1/2 bg-indigo-500" />}
                {hasBottom && <div className="absolute bottom-0 w-2 h-1/2 bg-indigo-500" />}
                {hasLeft && <div className="absolute left-0 h-2 w-1/2 bg-indigo-500" />}
                {hasRight && <div className="absolute right-0 h-2 w-1/2 bg-indigo-500" />}
                {cell.pathIndex !== null && <div className="w-4 h-4 rounded-full bg-indigo-500 z-10" />}
            </div>

            {/* Checkpoint Number */}
            {cell.isCheckpoint && (
                <div className={cn(
                    "relative z-20 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-md transform transition-transform hover:scale-110",
                    cell.pathIndex !== null ? "bg-indigo-600" : "bg-slate-400"
                )}>
                    {cell.value}
                </div>
            )}
        </div>
    );
}
