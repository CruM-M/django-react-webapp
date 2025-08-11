import { useState } from "react";

/**
 * Board component - Renders the game board as a grid of cells.
 *
 * Features:
 * - Displays hits, ships, and hover indicators for placement
 * - Handles click and hover interactions for placing/removing ships
 *
 * @component
 * @param {Object} props - Component props
 * @param {Array<Array<string>>} props.board - 2D array representing
 * board cells
 * @param {Array<Array<string>>} [props.hits] - 2D array of hits ("X","O")
 * @param {Array<Object>} [props.placedShips] - Ships placed on the board
 * @param {Function} [props.onCellClick] - Callback for cell click
 * @param {boolean} props.canPlace - If true, player can place ships
 * @param {number|null} [props.selectedShip] - Length of selected ship or null
 * @param {"horizontal"|"vertical"} props.orientation - Placement orientation
 * @returns {JSX.Element} Rendered game board
 */
const Board = ({
    board,
    hits,
    placedShips,
    onCellClick,
    canPlace,
    selectedShip,
    orientation
}) => {
    // State variables
    const [hoverCoords, setHoverCoords] = useState(null);

    /**
     * Renders a single row of the game board.
     *
     * @param {Array<string>} row - Array representing one row of the board
     * @param {number} y - Row index
     * @returns {JSX.Element} Rendered row
     */
    const renderRow = (row, y) => {
        return (
            <tr key={y}>{row.map((_, x) => renderCell(x, y))}</tr>
        );
    };

    /**
     * Renders a single cell of the game board.
     *
     * Handles:
     * - Click events for placing/removing ships
     * - Hover effect for placement preview
     *
     * @param {number} x - Cell column index
     * @param {number} y - Cell row index
     * @returns {JSX.Element} Rendered cell
     */
    const renderCell = (x, y) => {
        const hit = hits?.[y]?.[x] || "";
        const ship = placedShips?.find(ship =>
            ship.coords.some(([sx, sy]) => sx === x && sy === y)
        );

        const isHovering = isHoveringCell(x, y)
        const color = getCellColor(hit, ship, isHovering)

        return (
            <td
                key={x}
                onClick={() => onCellClick?.(x, y)}
                onMouseEnter={() => {
                    if (canPlace) setHoverCoords([x, y])
                }}
                onContextMenu={(e) => { e.preventDefault(); }}
                style={{
                    width: 30,
                    height: 30,
                    border: "1px solid black",
                    backgroundColor: color,
                    cursor: canPlace ? "pointer" : "default"
                }}
            ></td>
        );
    };

     /**
     * Checks if the given cell (x, y) is part of the hover preview
     * for placing a ship.
     *
     * @param {number} x - Column index
     * @param {number} y - Row index
     * @returns {boolean} True if the cell is part of the hover preview
     */
    const isHoveringCell = (x, y) => {
        if (!hoverCoords || selectedShip == null) return false;
        const [hx, hy] = hoverCoords;
        for (let i = 0; i < selectedShip; i++) {
            const cx = orientation === "horizontal" ? hx + i : hx;
            const cy = orientation === "vertical" ? hy + i : hy;
            if (cx === x && cy === y) return true;
        }
        return false;
    };

    /**
     * Returns the background color of a cell based on its state:
     * - Yellow if a miss ("O")
     * - Red if a hit ("X")
     * - Blue if ship present, gray if sunk
     * - Light green if part of hover preview
     *
     * @param {string} hit - Cell hit status ("X", "O", or empty)
     * @param {Object|null} ship - Ship object if cell contains a ship
     * @param {boolean} isHovering - Whether the cell is currently hovered
     * for placement
     * @returns {string} Background color for the cell
     */
    const getCellColor = (hit, ship, isHovering) => {
        if (hit === "O") return "yellow";
        if (hit === "X") return "red";
        if (ship) return ship.sunk ? "gray" : "blue";
        if (isHovering) return "lightgreen";
        return "#fff";
    };

    return(
        <table 
            style={{ borderCollapse: "collapse"}} 
            onMouseLeave={() => setHoverCoords(null)}>
            <tbody>
                {board.map((row, y) => renderRow(row, y))}
            </tbody>
        </table>
    );
}

export default Board;