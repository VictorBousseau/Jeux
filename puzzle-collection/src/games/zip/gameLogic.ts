export type ZipCellState = {
    row: number;
    col: number;
    value: number | null; // The checkpoint number (1, 2, 3...) or null if empty
    isCheckpoint: boolean; // If true, this is a target number
    pathIndex: number | null; // The order in the user's path (0, 1, 2...)
    rightWall: boolean;
    bottomWall: boolean;
};

export type Level = {
    size: number;
    grid: ZipCellState[][];
    checkpoints: number; // Total number of checkpoints
    totalCells: number; // Total cells to visit (size*size usually)
};

class SeededRNG {
    private seed: number;

    constructor(seed: string) {
        let h = 0xdeadbeef;
        for (let i = 0; i < seed.length; i++) {
            h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
        }
        this.seed = (h ^ h >>> 16) >>> 0;
    }

    next(): number {
        this.seed = (Math.imul(1664525, this.seed) + 1013904223) | 0;
        return ((this.seed >>> 0) / 4294967296);
    }
}

export function generateLevel(size: number = 7, seed?: string): Level {
    // Robust backtracking generator for Hamiltonian path (visit ALL cells)
    const rng = seed ? new SeededRNG(seed) : { next: () => Math.random() };

    const grid: ZipCellState[][] = Array(size).fill(null).map((_, r) =>
        Array(size).fill(null).map((_, c) => ({
            row: r,
            col: c,
            value: null,
            isCheckpoint: false,
            pathIndex: null,
            rightWall: false,
            bottomWall: false
        }))
    );

    const visited = new Set<string>();
    const path: { r: number, c: number }[] = [];
    const totalCells = size * size;

    // Start at a random position
    const startR = Math.floor(rng.next() * size);
    const startC = Math.floor(rng.next() * size);

    function getNeighbors(r: number, c: number) {
        const dirs = [
            { r: -1, c: 0 }, { r: 1, c: 0 },
            { r: 0, c: -1 }, { r: 0, c: 1 }
        ];
        return dirs.map(d => ({ r: r + d.r, c: c + d.c }))
            .filter(n =>
                n.r >= 0 && n.r < size && n.c >= 0 && n.c < size &&
                !visited.has(`${n.r},${n.c}`)
            );
    }

    let steps = 0;
    const MAX_STEPS = 5000; // Limit recursion to prevent freezing

    function solve(r: number, c: number): boolean {
        steps++;
        if (steps > MAX_STEPS) return false;

        path.push({ r, c });
        visited.add(`${r},${c}`);

        if (path.length === totalCells) return true;

        const neighbors = getNeighbors(r, c);
        // Randomize neighbors
        neighbors.sort(() => rng.next() - 0.5);

        // Heuristic: Warnsdorff's rule (prefer neighbors with fewer moves)
        neighbors.sort((a, b) => getNeighbors(a.r, a.c).length - getNeighbors(b.r, b.c).length);

        for (const n of neighbors) {
            if (solve(n.r, n.c)) return true;
        }

        path.pop();
        visited.delete(`${r},${c}`);
        return false;
    }

    // Try generation
    // If it fails to find a full path (rare for small grids but possible), fallback to snake
    if (!solve(startR, startC)) {
        path.length = 0;
        visited.clear();
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const actualC = r % 2 === 0 ? c : size - 1 - c;
                path.push({ r, c: actualC });
                visited.add(`${r},${actualC}`);
            }
        }
    }

    // Place checkpoints along the path
    const numCheckpoints = Math.max(3, Math.floor(path.length / 5));

    for (let i = 0; i < numCheckpoints; i++) {
        const pathIdx = i === numCheckpoints - 1 ? path.length - 1 : Math.round(i * (path.length - 1) / (numCheckpoints - 1));
        const node = path[pathIdx];
        grid[node.r][node.c].value = i + 1;
        grid[node.r][node.c].isCheckpoint = true;
    }

    // Add Walls
    // A wall can be placed between any two adjacent cells that are NOT connected in the path.
    // We want to add enough walls to make it interesting, but not too many to make it trivial.
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const currentIdx = path.findIndex(p => p.r === r && p.c === c);
            const next = currentIdx < path.length - 1 ? path[currentIdx + 1] : null;
            const prev = currentIdx > 0 ? path[currentIdx - 1] : null;

            // Check Right Neighbor
            if (c < size - 1) {
                const isConnected = (next?.r === r && next?.c === c + 1) || (prev?.r === r && prev?.c === c + 1);
                if (!isConnected) {
                    // Randomly place a wall (e.g., 30% chance)
                    if (rng.next() < 0.3) {
                        grid[r][c].rightWall = true;
                    }
                }
            }

            // Check Bottom Neighbor
            if (r < size - 1) {
                const isConnected = (next?.r === r + 1 && next?.c === c) || (prev?.r === r + 1 && prev?.c === c);
                if (!isConnected) {
                    if (rng.next() < 0.3) {
                        grid[r][c].bottomWall = true;
                    }
                }
            }
        }
    }

    return {
        size,
        grid,
        checkpoints: numCheckpoints,
        totalCells: path.length
    };
}

export function isValidMove(
    grid: ZipCellState[][],
    from: { r: number, c: number },
    to: { r: number, c: number }
): boolean {
    const size = grid.length;

    // Check bounds
    if (to.r < 0 || to.r >= size || to.c < 0 || to.c >= size) return false;

    const targetCell = grid[to.r][to.c];

    // Cannot visit already visited cell
    if (targetCell.pathIndex !== null) return false;

    // Check adjacency and Walls
    const dr = to.r - from.r;
    const dc = to.c - from.c;

    if (Math.abs(dr) + Math.abs(dc) !== 1) return false;

    // Check walls
    if (dr === 0 && dc === 1) { // Moving Right
        if (grid[from.r][from.c].rightWall) return false;
    }
    if (dr === 0 && dc === -1) { // Moving Left
        if (grid[to.r][to.c].rightWall) return false; // Check neighbor's right wall
    }
    if (dr === 1 && dc === 0) { // Moving Down
        if (grid[from.r][from.c].bottomWall) return false;
    }
    if (dr === -1 && dc === 0) { // Moving Up
        if (grid[to.r][to.c].bottomWall) return false; // Check neighbor's bottom wall
    }

    return true;
}

export function checkWin(grid: ZipCellState[][], level: Level): boolean {
    // 1. Check if all cells are visited
    let visitedCount = 0;

    for (let r = 0; r < level.size; r++) {
        for (let c = 0; c < level.size; c++) {
            if (grid[r][c].pathIndex !== null) {
                visitedCount++;
            }
        }
    }

    if (visitedCount !== level.totalCells) return false;

    // 2. Check if checkpoints are visited in correct order
    const path = new Array(visitedCount);
    for (let r = 0; r < level.size; r++) {
        for (let c = 0; c < level.size; c++) {
            if (grid[r][c].pathIndex !== null) {
                path[grid[r][c].pathIndex!] = grid[r][c];
            }
        }
    }

    let nextCheckpoint = 1;
    for (let i = 0; i < path.length; i++) {
        const cell = path[i];
        if (cell.isCheckpoint) {
            if (cell.value === nextCheckpoint) {
                nextCheckpoint++;
            } else {
                return false; // Visited wrong checkpoint or out of order
            }
        }
    }

    return nextCheckpoint === level.checkpoints + 1;
}
