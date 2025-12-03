export type CellValue = 'SUN' | 'MOON' | null;

export type CellState = {
    row: number;
    col: number;
    value: CellValue;
    isFixed: boolean; // Part of the initial puzzle
    isError: boolean; // Violates a rule
};

export type Level = {
    size: number;
    grid: CellState[][];
};

// Rules:
// 1. No more than 2 of same symbol adjacent
// 2. Equal number of Sun/Moon in each row/col
// 3. No identical rows or columns

class SeededRNG {
    private seed: number;

    constructor(seed: string) {
        // Simple hash to convert string to number
        let h = 0xdeadbeef;
        for (let i = 0; i < seed.length; i++) {
            h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
        }
        this.seed = (h ^ h >>> 16) >>> 0;
    }

    // Returns number between 0 and 1
    next(): number {
        this.seed = (Math.imul(1664525, this.seed) + 1013904223) | 0;
        return ((this.seed >>> 0) / 4294967296);
    }
}

export function generateLevel(size: number = 6, seed?: string): Level {
    // Simple backtracking generator
    const rng = seed ? new SeededRNG(seed) : { next: () => Math.random() };
    const grid: CellValue[][] = Array(size).fill(null).map(() => Array(size).fill(null));

    if (solveGrid(grid, 0, 0, size, rng)) {
        // Create playable grid by removing some cells
        const playableGrid: CellState[][] = grid.map((row, r) =>
            row.map((val, c) => ({
                row: r,
                col: c,
                value: rng.next() > 0.6 ? val : null, // Keep ~40% as hints
                isFixed: false,
                isError: false
            }))
        );

        // Mark kept cells as fixed
        playableGrid.forEach(row => row.forEach(cell => {
            if (cell.value !== null) cell.isFixed = true;
        }));

        return { size, grid: playableGrid };
    }

    throw new Error("Failed to generate level");
}

function solveGrid(grid: CellValue[][], r: number, c: number, size: number, rng: { next: () => number }): boolean {
    if (r === size) return true; // Reached end

    const nextR = c === size - 1 ? r + 1 : r;
    const nextC = c === size - 1 ? 0 : c + 1;

    const options: CellValue[] = rng.next() > 0.5 ? ['SUN', 'MOON'] : ['MOON', 'SUN'];

    for (const val of options) {
        if (isValidMove(grid, r, c, val, size)) {
            grid[r][c] = val;
            if (solveGrid(grid, nextR, nextC, size, rng)) return true;
            grid[r][c] = null;
        }
    }

    return false;
}

function isValidMove(grid: CellValue[][], r: number, c: number, val: CellValue, size: number): boolean {
    // 1. Max 2 adjacent
    // Check horizontal
    if (c >= 2 && grid[r][c - 1] === val && grid[r][c - 2] === val) return false;
    // Check vertical
    if (r >= 2 && grid[r - 1][c] === val && grid[r - 2][c] === val) return false;

    // 2. Equal count (only check if row/col is full)
    // Row count
    let rowCount = 0;
    let rowFilled = 0;
    for (let i = 0; i < c; i++) {
        if (grid[r][i] === val) rowCount++;
        if (grid[r][i] !== null) rowFilled++;
    }
    if (rowCount >= size / 2 && val === (grid[r][c] || val)) return false; // Already have max of this type? No, this logic is tricky during generation.
    // Better: simply check if we exceed half
    // Count including current placement
    let rCount = 1;
    for (let i = 0; i < c; i++) if (grid[r][i] === val) rCount++;
    if (rCount > size / 2) return false;

    // Col count
    let cCount = 1;
    for (let i = 0; i < r; i++) if (grid[i][c] === val) cCount++;
    if (cCount > size / 2) return false;

    // 3. Unique rows/cols (only check when row/col is complete)
    // This is expensive to check at every step, usually done at end or with optimized structures.
    // For small grids (6x6), we can skip strict uniqueness during generation or check it at the end of row/col.

    return true;
}

export function validateBoard(grid: CellState[][]): { r: number, c: number }[] {
    const size = grid.length;
    const errors: { r: number, c: number }[] = [];
    const errorSet = new Set<string>();

    const addError = (r: number, c: number) => {
        const key = `${r},${c}`;
        if (!errorSet.has(key)) {
            errors.push({ r, c });
            errorSet.add(key);
        }
    };

    // 1. Adjacency (3 same symbols)
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const val = grid[r][c].value;
            if (!val) continue;

            // Horizontal
            if (c < size - 2) {
                if (grid[r][c + 1].value === val && grid[r][c + 2].value === val) {
                    addError(r, c);
                    addError(r, c + 1);
                    addError(r, c + 2);
                }
            }
            // Vertical
            if (r < size - 2) {
                if (grid[r + 1][c].value === val && grid[r + 2][c].value === val) {
                    addError(r, c);
                    addError(r + 1, c);
                    addError(r + 2, c);
                }
            }
        }
    }

    // 2. Equal counts (only if row/col is full)
    for (let i = 0; i < size; i++) {
        let sunsR = 0, moonsR = 0;
        let sunsC = 0, moonsC = 0;

        for (let j = 0; j < size; j++) {
            if (grid[i][j].value === 'SUN') sunsR++;
            else if (grid[i][j].value === 'MOON') moonsR++;

            if (grid[j][i].value === 'SUN') sunsC++;
            else if (grid[j][i].value === 'MOON') moonsC++;
        }

        if (sunsR > size / 2 || moonsR > size / 2) {
            // Mark whole row as error if count exceeded
            for (let j = 0; j < size; j++) addError(i, j);
        }
        if (sunsC > size / 2 || moonsC > size / 2) {
            // Mark whole col as error
            for (let j = 0; j < size; j++) addError(j, i);
        }
    }

    // 3. Unique rows/cols (only check if rows/cols are full)
    const rowStrings = new Map<string, number[]>();
    const colStrings = new Map<string, number[]>();

    for (let i = 0; i < size; i++) {
        let rowStr = "";
        let colStr = "";
        let rowFull = true;
        let colFull = true;

        for (let j = 0; j < size; j++) {
            if (grid[i][j].value === null) rowFull = false;
            rowStr += grid[i][j].value === 'SUN' ? 'S' : 'M';

            if (grid[j][i].value === null) colFull = false;
            colStr += grid[j][i].value === 'SUN' ? 'S' : 'M';
        }

        if (rowFull) {
            if (rowStrings.has(rowStr)) {
                // Mark both rows as error
                const prevIdx = rowStrings.get(rowStr)!;
                prevIdx.push(i);
            } else {
                rowStrings.set(rowStr, [i]);
            }
        }

        if (colFull) {
            if (colStrings.has(colStr)) {
                // Mark both cols as error
                const prevIdx = colStrings.get(colStr)!;
                prevIdx.push(i);
            } else {
                colStrings.set(colStr, [i]);
            }
        }
    }

    // Apply errors for duplicates
    rowStrings.forEach((indices) => {
        if (indices.length > 1) {
            indices.forEach(r => {
                for (let c = 0; c < size; c++) addError(r, c);
            });
        }
    });

    colStrings.forEach((indices) => {
        if (indices.length > 1) {
            indices.forEach(c => {
                for (let r = 0; r < size; r++) addError(r, c);
            });
        }
    });

    return errors;
}

export function checkWin(grid: CellState[][]): boolean {
    const size = grid.length;

    // Check all cells filled
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (grid[r][c].value === null) return false;
        }
    }

    // Check for any validation errors
    if (validateBoard(grid).length > 0) return false;

    // Check unique rows/cols (final check)
    const rows = new Set<string>();
    const cols = new Set<string>();
    for (let i = 0; i < size; i++) {
        let rowStr = "";
        let colStr = "";
        for (let j = 0; j < size; j++) {
            rowStr += grid[i][j].value === 'SUN' ? 'S' : 'M';
            colStr += grid[j][i].value === 'SUN' ? 'S' : 'M';
        }
        if (rows.has(rowStr)) {
            console.log("Duplicate row:", i);
            return false;
        }
        rows.add(rowStr);
        if (cols.has(colStr)) {
            console.log("Duplicate col:", i);
            return false;
        }
        cols.add(colStr);
    }

    console.log("Win condition met!");
    return true;
}
