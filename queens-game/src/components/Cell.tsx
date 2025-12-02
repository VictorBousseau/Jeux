import { Crown, X } from "lucide-react";
import type { Cell as CellType } from "../lib/gameLogic";
import { cn } from "../lib/utils";

interface CellProps {
    cell: CellType;
    onClick: () => void;
    onRightClick: (e: React.MouseEvent) => void;
    color: string;
}

export function Cell({ cell, onClick, onRightClick, color }: CellProps) {
    return (
        <div
            className={cn(
                "w-full h-full border border-gray-800/20 flex items-center justify-center cursor-pointer transition-colors duration-200 box-border",
                cell.isError && "bg-red-500/50 animate-pulse",
            )}
            style={{ backgroundColor: cell.isError ? undefined : color }}
            onClick={onClick}
            onContextMenu={onRightClick}
        >
            {cell.state === "QUEEN" && (
                <Crown className="w-3/5 h-3/5 text-white drop-shadow-md" fill="currentColor" />
            )}
            {cell.state === "CROSS" && (
                <X className="w-2/5 h-2/5 text-black/30" />
            )}
        </div>
    );
}
