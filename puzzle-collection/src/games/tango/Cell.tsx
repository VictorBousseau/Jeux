import { Sun, Moon } from "lucide-react";
import type { CellState } from "./gameLogic";
import { cn } from "../../lib/utils";

interface CellProps {
    cell: CellState;
    onClick: () => void;
}

export function Cell({ cell, onClick }: CellProps) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "w-full h-full aspect-square flex items-center justify-center transition-all duration-200 border border-gray-200 cursor-pointer select-none",
                cell.isFixed ? "bg-gray-100 cursor-default" : "bg-white hover:bg-gray-50",
                cell.isError && "bg-red-50 border-red-200"
            )}
        >
            {cell.value === 'SUN' && (
                <Sun
                    className={cn(
                        "w-3/5 h-3/5 transition-all duration-300",
                        cell.isFixed ? "text-orange-400" : "text-orange-500 fill-orange-100"
                    )}
                />
            )}
            {cell.value === 'MOON' && (
                <Moon
                    className={cn(
                        "w-3/5 h-3/5 transition-all duration-300",
                        cell.isFixed ? "text-slate-400" : "text-slate-600 fill-slate-200"
                    )}
                />
            )}
        </div>
    );
}
