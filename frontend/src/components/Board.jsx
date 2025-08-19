import { useState } from "react";
import start_h from "../assets/board/start_h.png";
import start_v from "../assets/board/start_v.png";
import end_h from "../assets/board/end_h.png";
import end_v from "../assets/board/end_v.png";
import mid1_h from "../assets/board/mid1_h.png";
import mid1_v from "../assets/board/mid1_v.png";
import mid2_h from "../assets/board/mid2_h.png";
import mid2_v from "../assets/board/mid2_v.png";
import o from "../assets/board/o.png";
import x from "../assets/board/x.png";

export const shipParts = {
    start_h,
    start_v,
    end_h,
    end_v,
    mid1_h,
    mid1_v,
    mid2_h,
    mid2_v,
    o,
    x,
};

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
 * @param {"own"|"opponent"|"small"} props.boardType - Type of board to render
 * @param {Array<Array<string>>} [props.hits] - 2D array of hits ("X","O")
 * @param {Array<Object>} [props.placedShips] - Ships placed on the board
 * @param {Array<Object>} [props.opponentPlacedShips] - Ships placed on the
 * opponent's board
 * @param {Function} [props.onCellClick] - Callback for cell click
 * @param {boolean} props.canClick - If true, player can click on cells
 * @param {number|null} [props.selectedShip] - Length of selected ship or null
 * @param {"horizontal"|"vertical"} props.orientation - Placement orientation
 * @param {"place"|"remove"} props.placeMode - Current placement mode
 * @param {Object|null} props.pendingAction - Pending placement/removal action
 * @returns {JSX.Element} Rendered game board
 */
const Board = ({
    board,
    boardType,
    hits,
    placedShips,
    opponentPlacedShips,
    onCellClick,
    canClick,
    selectedShip,
    orientation,
    placeMode,
    pendingAction
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
     * - Rendering of hits, misses, and ship graphics
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
        const opponentShip = opponentPlacedShips?.find(ship =>
            ship.coords.some(([sx, sy]) => sx === x && sy === y)
        );

        const isHovering = isHoveringCell(x, y)

        return (
            <td
                key={x}
                onClick={() => onCellClick?.(x, y)}
                onMouseEnter={() => {
                    if (canClick) setHoverCoords([x, y])
                }}
                onContextMenu={(e) => { e.preventDefault(); }}
                style={{
                    cursor: canClick && !pendingAction &&
                    (
                        selectedShip !== null 
                        || (placeMode === "remove" && ship)
                    )
                    ? "pointer"
                    : "default",
                    position: "relative"
                }}
            >
                {/* Lower layer - Ship */}
                {ship && (
                    <img
                        src={shipParts[getShipPart(ship, x, y)]}
                        style={{
                            position: "absolute",
                            filter: ship.sunk ? "brightness(0.5)" : "none",
                            top: 0, left: 0,
                            width: "100%", height: "100%"
                        }}
                    />
                )}

                {/* Upper layer - Miss/Hit */}
                {hit === "O" && boardType === "opponent" && (
                    <img
                        src={shipParts["o"]}
                        style={{
                            position: "absolute",
                            top: 0, left: 0,
                            width: "100%", height: "100%"
                        }}
                    />
                )}
                {hit === "X" && (
                    <img
                        src={shipParts["x"]}
                        style={{
                            position: "absolute",
                            filter: ship?.sunk || opponentShip?.sunk
                            ? "brightness(0.5)"
                            : "none",
                            top: 0, left: 0,
                            width: "100%", height: "100%"
                        }}
                    />
                )}

                {/*Placement preview*/}
                {isHovering && (
                    <div
                        style={{
                            backgroundColor: !ship && (placeMode === "place")
                                ? "rgba(110, 231, 110, 0.7)"
                                : "rgba(228, 110, 110, 0.7)",
                            width: "100%",
                            height: "100%",
                            position: "absolute",
                            top: 0,
                            left: 0
                        }}
                    />
                )}
            </td>
        );
    };

     /**
     * Checks if the given cell (x, y) is part of the hover preview
     * for placing or removing a ship.
     *
     * @param {number} x - Column index
     * @param {number} y - Row index
     * @returns {boolean} True if the cell is part of the hover preview
     */
    const isHoveringCell = (x, y) => {
        if (!hoverCoords && !pendingAction) return false;

        let hx, hy;
        if (pendingAction) {
            hx = pendingAction.x;
            hy = pendingAction.y;
        } else {
            [hx, hy] = hoverCoords;
        }

        if (placeMode === "remove") {
            const ship = placedShips?.find(ship =>
                ship.coords.some(([sx, sy]) => sx === hx && sy === hy)
            );

            if (ship && ship.coords.some(
                ([sx, sy]) => sx === x && sy === y)
            ) return true;
        } else {
            if (selectedShip === null) return false;

            for (let i = 0; i < selectedShip; i++) {
                const cx = orientation === "horizontal" ? hx + i : hx;
                const cy = orientation === "vertical" ? hy + i : hy;
                if (cx === x && cy === y) return true;
            }
        }
        return false;
    };

    /**
     * Determines which ship part image to render for the given
     * ship segment (start, mid, end).
     *
     * @param {Object} ship - Ship object with coords array
     * @param {Array<Array<number>>} ship.coords - Coordinates of the ship
     * parts
     * @param {number} x - Column index
     * @param {number} y - Row index
     * @returns {string|null} Key of shipParts image or null
     */
    const getShipPart = (ship, x, y) => {
        if (!ship || !ship.coords) return null

        const index = ship.coords.findIndex(
            ([sx, sy]) => sx === x && sy === y
        );
        const length = ship.coords.length;

        const [x1, y1] = ship.coords[0];
        const [x2, y2] = ship.coords[1];
        const orientation = x1 !== x2 ? "horizontal" : "vertical";

        if (index === 0) {
            return orientation === "horizontal" ? "start_h" : "start_v";
        }
        else if (index === length - 1) {
            return orientation === "horizontal" ? "end_h" : "end_v";
        }
        else if (index === 1 && length > 2) {
            return orientation === "horizontal" ? "mid1_h" : "mid1_v";
        }
        else {
            return orientation === "horizontal" ? "mid2_h" : "mid2_v";
        }
    };

    return(
        <table
            className={`board-table ${
                boardType === "small"
                ? "small"
                : ""
            }`}
            onMouseLeave={() => setHoverCoords(null)}
        >
            <tbody>
                {board.map((row, y) => renderRow(row, y))}
            </tbody>
        </table>
    );
}

export default Board;