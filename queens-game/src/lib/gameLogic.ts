export type CellState = 'EMPTY' | 'QUEEN' | 'CROSS';

export interface Cell {
    row: number;
    col: number;
    regionId: number;
    state: CellState;
    isError: boolean;
}



export interface Level {
    size: number;
    regions: number[][]; // regionId for each cell [row][col]
    solution?: { row: number; col: number }[];
}


export function generateLevel(size: number = 8): Level {
    let attempts = 0;
    while (attempts < 20000) {
        attempts++;
        // 1. Generate a valid queen placement (solution)
        const queens = generateValidQueens(size);
        if (!queens) continue;

        // 2. Generate regions based on queens
        const regions = generateRegions(size, queens);

        // 2.5 Validate region constraints (max 1 singleton region)
        const regionSizes = new Array(size).fill(0);
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                regionSizes[regions[r][c]]++;
            }
        }
        const singletons = regionSizes.filter(s => s === 1).length;
        if (singletons > 1) continue;

        // 3. Validate uniqueness
        const solutions = solve(size, regions, 2); // Stop if we find more than 1
        if (solutions.length === 1) {
            return { size, regions, solution: queens };
        }
    }
    throw new Error(`Failed to generate unique level after ${attempts} attempts`);
}

function generateValidQueens(size: number): { row: number; col: number }[] | null {
    const queens: { row: number; col: number }[] = [];
    const cols = Array.from({ length: size }, (_, i) => i);

    // Randomize columns to get different solutions
    for (let i = cols.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cols[i], cols[j]] = [cols[j], cols[i]];
    }

    function backtrack(row: number): boolean {
        if (row === size) return true;

        for (const col of cols) {
            if (isValidQueenPlacement(queens, row, col)) {
                queens.push({ row, col });
                if (backtrack(row + 1)) return true;
                queens.pop();
            }
        }
        return false;
    }

    if (backtrack(0)) return queens;
    return null;
}

function isValidQueenPlacement(queens: { row: number; col: number }[], r: number, c: number): boolean {
    for (const q of queens) {
        // Row check (implicit by design)
        // Col check
        if (q.col === c) return false;
        // Diagonal touching check (King's move + diagonals)
        if (Math.abs(q.row - r) <= 1 && Math.abs(q.col - c) <= 1) return false;
    }
    return true;
}

function generateRegions(size: number, queens: { row: number; col: number }[]): number[][] {
    const regions = Array(size).fill(0).map(() => Array(size).fill(-1));
    const queue: { r: number; c: number; id: number }[] = [];

    // Initialize seeds
    queens.forEach((q, i) => {
        regions[q.row][q.col] = i;
        queue.push({ r: q.row, c: q.col, id: i });
    });

    // Randomize queue for irregular growth
    // Actually, standard BFS is too regular. We want random growth.
    // Let's use a list of active edge cells and pick randomly.

    const active = [...queue];

    while (active.length > 0) {
        const idx = Math.floor(Math.random() * active.length);
        const { r, c, id } = active[idx];
        active.splice(idx, 1); // Remove processed cell

        const neighbors = [
            { r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 }
        ];

        for (const n of neighbors) {
            if (n.r >= 0 && n.r < size && n.c >= 0 && n.c < size && regions[n.r][n.c] === -1) {
                regions[n.r][n.c] = id;
                active.push({ r: n.r, c: n.c, id });
            }
        }
    }

    // Fill any remaining holes (if any, though flood fill should cover all reachable)
    // In case of disconnected islands, we might need a post-pass, but simple flood fill usually works for full grid.
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (regions[r][c] === -1) {
                // Assign to random neighbor
                const neighbors = [
                    { r: r - 1, c }, { r: r + 1, c }, { r, c: c - 1 }, { r, c: c + 1 }
                ].filter(n => n.r >= 0 && n.r < size && n.c >= 0 && n.c < size && regions[n.r][n.c] !== -1);
                if (neighbors.length > 0) {
                    regions[r][c] = regions[neighbors[0].r][neighbors[0].c];
                } else {
                    regions[r][c] = 0; // Fallback
                }
            }
        }
    }

    return regions;
}

export function solve(size: number, regions: number[][], limit: number = 2): { row: number; col: number }[][] {
    const solutions: { row: number; col: number }[][] = [];
    const current: { row: number; col: number }[] = [];

    // Optimization: Pre-calculate region cells
    const regionCells: { r: number, c: number }[][] = Array(size).fill(0).map(() => []);
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            regionCells[regions[r][c]].push({ r, c });
        }
    }

    // Track used columns and regions to speed up
    const usedCols = new Set<number>();
    const usedRegions = new Set<number>();

    function backtrack(row: number) {
        if (solutions.length >= limit) return;
        if (row === size) {
            solutions.push([...current]);
            return;
        }

        for (let col = 0; col < size; col++) {
            const region = regions[row][col];

            // Pruning
            if (usedCols.has(col)) continue;
            if (usedRegions.has(region)) continue;

            // Check touching constraint
            let touching = false;
            for (const q of current) {
                if (Math.abs(q.row - row) <= 1 && Math.abs(q.col - col) <= 1) {
                    touching = true;
                    break;
                }
            }
            if (touching) continue;

            // Place
            current.push({ row, col });
            usedCols.add(col);
            usedRegions.add(region);

            backtrack(row + 1);

            // Backtrack
            usedRegions.delete(region);
            usedCols.delete(col);
            current.pop();
        }
    }

    backtrack(0);
    return solutions;
}

export function isValidPlacement(board: Cell[][], row: number, col: number, size: number): boolean {
    // Check row
    for (let c = 0; c < size; c++) {
        if (c !== col && board[row][c].state === 'QUEEN') return false;
    }

    // Check col
    for (let r = 0; r < size; r++) {
        if (r !== row && board[r][col].state === 'QUEEN') return false;
    }

    // Check region
    const regionId = board[row][col].regionId;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if ((r !== row || c !== col) && board[r][c].regionId === regionId && board[r][c].state === 'QUEEN') {
                return false;
            }
        }
    }

    // Check diagonals (touching)
    const dirs = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    for (const [dr, dc] of dirs) {
        const nr = row + dr;
        const nc = col + dc;
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
            if (board[nr][nc].state === 'QUEEN') return false;
        }
    }

    return true;
}
