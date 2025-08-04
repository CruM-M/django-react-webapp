import { useState } from "react";

const Board = ({board, hits, placedShips, onCellClick, canPlace, selectedShip, orientation}) => {
    const [hoverCoords, setHoverCoords] = useState(null);

    return(
        <table 
            style={{ borderCollapse: "collapse"}} 
            onMouseLeave={() => setHoverCoords(null)}>
            <tbody>
                {board.map((row, y) => {
                    return(
                        <tr key={y}>
                            {row.map((cell, x) => {
                                const hit = hits?.[y]?.[x] || "";
                                const ship = placedShips?.find(ship =>
                                    ship.coords.some(([sx, sy]) => sx === x && sy === y)
                                );
                                const hasShip = !!ship;
                                const isSunk = ship?.sunk || false;

                                let isHovering = false;
                                if (hoverCoords && selectedShip != null) {
                                    const [hx, hy] = hoverCoords;
                                    for (let i = 0; i < selectedShip; i++) {
                                        const cx = orientation === "horizontal" ? hx + i : hx;
                                        const cy = orientation === "vertical" ? hy + i : hy;
                                        if (cx === x && cy === y) isHovering = true;
                                    }
                                }

                                let color = "#fff";
                                if (hit === "O") color = "yellow";
                                else if (hit === "X") color = "red";
                                if (hasShip) color = isSunk ? "gray" : "blue";
                                else if (isHovering) color = "lightgreen";

                                return (
                                    <td
                                        key={x}
                                        onClick={() => onCellClick?.(x, y)}
                                        onMouseEnter={() => canPlace && setHoverCoords([x, y])}
                                        onContextMenu={e =>{
                                            e.preventDefault();
                                        }}
                                        style={{
                                            width: 30,
                                            height: 30,
                                            border: "1px solid black",
                                            backgroundColor: color,
                                            cursor: canPlace ? "pointer" : "default"
                                        }}
                                    ></td>
                                );
                            })}
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

export default Board;