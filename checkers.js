// Constants
const BOARD_SIZE = 8;
const EMPTY = 0;
const PLAYER_ONE = 1; // Red
const PLAYER_TWO = 2; // Black
const KING_ONE = 3;
const KING_TWO = 4;

// Game state
let board = [];
let currentPlayer = PLAYER_ONE;
let selectedPiece = null; // { row, col, isKing }

// DOM Elements
const boardDiv = document.getElementById('checkers-board');
const gameStatusDiv = document.getElementById('game-status');

// WebSocket
let socket;

/**
 * Initializes the checkers board with pieces in their starting positions.
 * Player One (Red) starts at the bottom.
 * Player Two (Black) starts at the top.
 */
function initializeBoard() {
    board = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
        board[row] = [];
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (row < 3 && (row + col) % 2 !== 0) {
                board[row][col] = PLAYER_TWO; // Black pieces
            } else if (row > 4 && (row + col) % 2 !== 0) {
                board[row][col] = PLAYER_ONE; // Red pieces
            } else {
                board[row][col] = EMPTY;
            }
        }
    }
    console.log("Board initialized:", board);
}

/**
 * Renders the board in the DOM.
 */
function renderBoard() {
    boardDiv.innerHTML = ''; // Clear previous board

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = row;
            square.dataset.col = col;

            const piece = board[row][col];
            if (piece !== EMPTY) {
                const pieceDiv = document.createElement('div');
                pieceDiv.classList.add('piece');
                if (piece === PLAYER_ONE) {
                    pieceDiv.classList.add('player-one');
                } else if (piece === PLAYER_TWO) {
                    pieceDiv.classList.add('player-two');
                } else if (piece === KING_ONE) {
                    pieceDiv.classList.add('player-one', 'king');
                } else if (piece === KING_TWO) {
                    pieceDiv.classList.add('player-two', 'king');
                }
                square.appendChild(pieceDiv);
            }
            square.addEventListener('click', handleSquareClick);
            boardDiv.appendChild(square);
        }
    }
    updateGameStatus();
    console.log("Board rendered");
}

/**
 * Updates the game status message.
 */
function updateGameStatus() {
    let status = `Current Player: ${currentPlayer === PLAYER_ONE ? 'Red' : 'Black'}`;
    if (isGameOver()) {
        status = `Game Over! ${getWinner() === PLAYER_ONE ? 'Red' : 'Black'} wins!`;
    }
    gameStatusDiv.textContent = status;
}

/**
 * Handles clicks on board squares.
 * @param {Event} event - The click event.
 */
function handleSquareClick(event) {
    const clickedSquare = event.currentTarget;
    const row = parseInt(clickedSquare.dataset.row);
    const col = parseInt(clickedSquare.dataset.col);

    console.log(`Square clicked: row ${row}, col ${col}`);

    if (selectedPiece) {
        // Attempt to move the selected piece
        const validMoves = getValidMoves(selectedPiece.row, selectedPiece.col, board[selectedPiece.row][selectedPiece.col] >= KING_ONE);
        const targetMove = validMoves.find(move => move.to.row === row && move.to.col === col);

        if (targetMove) {
            movePiece(selectedPiece.row, selectedPiece.col, row, col, targetMove.isJump);
            if (targetMove.isJump) {
                // Check for further jumps
                const furtherJumps = getValidMoves(row, col, board[row][col] >= KING_ONE, true);
                if (furtherJumps.length > 0) {
                    selectedPiece = { row, col, isKing: board[row][col] >= KING_ONE };
                    // Highlight further jumps or force jump
                    console.log("Further jumps available");
                    renderBoard(); // Re-render to show current state before next jump
                    updateGameStatus();
                    return;
                }
            }
            switchPlayer();
        } else {
            console.log("Invalid move attempt.");
        }
        selectedPiece = null;
    } else {
        // Select a piece
        if (board[row][col] !== EMPTY && isCurrentPlayerPiece(board[row][col])) {
            selectedPiece = { row, col, isKing: board[row][col] >= KING_ONE };
            console.log("Piece selected:", selectedPiece);
            // Optionally, highlight the selected piece and its valid moves
        } else {
            console.log("Cannot select this square. Either empty or not your piece.");
        }
    }
    renderBoard(); // Re-render after selection or move attempt
    updateGameStatus();
}

/**
 * Checks if the piece belongs to the current player.
 * @param {number} piece - The piece value.
 * @returns {boolean} - True if it's the current player's piece.
 */
function isCurrentPlayerPiece(piece) {
    if (currentPlayer === PLAYER_ONE) {
        return piece === PLAYER_ONE || piece === KING_ONE;
    } else {
        return piece === PLAYER_TWO || piece === KING_TWO;
    }
}

/**
 * Switches the current player.
 */
function switchPlayer() {
    currentPlayer = (currentPlayer === PLAYER_ONE) ? PLAYER_TWO : PLAYER_ONE;
    console.log("Switched player to:", currentPlayer);
    updateGameStatus();
    // Send move to server if WebSocket is connected
    if (socket && socket.readyState === WebSocket.OPEN) {
        // For now, just sending the board state. A more specific move message is better.
        // socket.send(JSON.stringify({ type: 'move', board: board, currentPlayer: currentPlayer }));
    }
}

/**
 * Moves a piece on the board.
 * @param {number} fromRow - The starting row.
 * @param {number} fromCol - The starting column.
 * @param {number} toRow - The destination row.
 * @param {number} toCol - The destination column.
 * @param {boolean} isJump - Whether the move is a jump.
 */
function movePiece(fromRow, fromCol, toRow, toCol, isJump) {
    const piece = board[fromRow][fromCol];
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = EMPTY;

    if (isJump) {
        const jumpedRow = (fromRow + toRow) / 2;
        const jumpedCol = (fromCol + toCol) / 2;
        board[jumpedRow][jumpedCol] = EMPTY;
        console.log(`Piece jumped from (${fromRow},${fromCol}) to (${toRow},${toCol}), capturing (${jumpedRow},${jumpedCol})`);
    } else {
        console.log(`Piece moved from (${fromRow},${fromCol}) to (${toRow},${toCol})`);
    }

    // Check for king promotion
    if (piece === PLAYER_ONE && toRow === 0) {
        board[toRow][toCol] = KING_ONE;
        console.log("Player One piece promoted to King at:", toRow, toCol);
    } else if (piece === PLAYER_TWO && toRow === BOARD_SIZE - 1) {
        board[toRow][toCol] = KING_TWO;
        console.log("Player Two piece promoted to King at:", toRow, toCol);
    }

    // Send move to server
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'move',
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            isJump: isJump
        }));
    }
}

/**
 * Gets valid moves for a piece.
 * @param {number} row - The piece's row.
 * @param {number} col - The piece's column.
 * @param {boolean} isKing - Whether the piece is a king.
 * @param {boolean} jumpsOnly - Whether to only return jump moves.
 * @returns {Array} - An array of valid move objects { to: {row, col}, isJump: boolean }.
 */
function getValidMoves(row, col, isKing, jumpsOnly = false) {
    const moves = [];
    const piece = board[row][col];
    let player, opponent, king, opponentKing;

    if (piece === PLAYER_ONE || piece === KING_ONE) {
        player = PLAYER_ONE;
        opponent = PLAYER_TWO;
        king = KING_ONE;
        opponentKing = KING_TWO;
    } else if (piece === PLAYER_TWO || piece === KING_TWO) {
        player = PLAYER_TWO;
        opponent = PLAYER_ONE;
        king = KING_TWO;
        opponentKing = KING_ONE;
    } else {
        return moves; // Not a player piece
    }

    const directions = [];
    if (isKing) {
        directions.push({ dr: -1, dc: -1 }); // Up-left
        directions.push({ dr: -1, dc: 1 });  // Up-right
        directions.push({ dr: 1, dc: -1 });  // Down-left
        directions.push({ dr: 1, dc: 1 });   // Down-right
    } else if (player === PLAYER_ONE) {
        directions.push({ dr: -1, dc: -1 }); // Up-left
        directions.push({ dr: -1, dc: 1 });  // Up-right
    } else { // PLAYER_TWO
        directions.push({ dr: 1, dc: -1 });  // Down-left
        directions.push({ dr: 1, dc: 1 });   // Down-right
    }

    // Check for jumps first
    for (const dir of directions) {
        const r1 = row + dir.dr;
        const c1 = col + dir.dc;
        const r2 = row + 2 * dir.dr;
        const c2 = col + 2 * dir.dc;

        if (r2 >= 0 && r2 < BOARD_SIZE && c2 >= 0 && c2 < BOARD_SIZE) {
            if ((board[r1][c1] === opponent || board[r1][c1] === opponentKing) && board[r2][c2] === EMPTY) {
                moves.push({ to: { row: r2, col: c2 }, isJump: true });
            }
        }
    }

    // If jumpsOnly is true and there are jumps, return only jumps
    if (jumpsOnly && moves.some(move => move.isJump)) {
        return moves.filter(move => move.isJump);
    }
    // If not jumpsOnly or no jumps available, add regular moves
    if (!jumpsOnly || !moves.some(move => move.isJump)) {
        for (const dir of directions) {
            const r1 = row + dir.dr;
            const c1 = col + dir.dc;
            if (r1 >= 0 && r1 < BOARD_SIZE && c1 >= 0 && c1 < BOARD_SIZE && board[r1][c1] === EMPTY) {
                moves.push({ to: { row: r1, col: c1 }, isJump: false });
            }
        }
    }
    // If jumps are available, only jumps are valid moves for the turn
    if (moves.some(move => move.isJump)) {
        return moves.filter(move => move.isJump);
    }

    return moves;
}


/**
 * Checks if the game is over.
 * @returns {boolean} - True if the game is over.
 */
function isGameOver() {
    // Check if current player has any pieces left
    let currentPlayerPieces = 0;
    let opponentPlayerPieces = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = board[r][c];
            if (piece !== EMPTY) {
                if (isCurrentPlayerPiece(piece)) {
                    currentPlayerPieces++;
                } else {
                    opponentPlayerPieces++;
                }
            }
        }
    }

    if (currentPlayerPieces === 0 || opponentPlayerPieces === 0) {
        return true;
    }

    // Check if current player has any valid moves
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = board[r][c];
            if (isCurrentPlayerPiece(piece)) {
                const validMoves = getValidMoves(r, c, piece >= KING_ONE);
                if (validMoves.length > 0) {
                    return false; // Found a valid move
                }
            }
        }
    }
    return true; // No valid moves for the current player
}

/**
 * Gets the winner of the game.
 * @returns {number | null} - The winning player, or null if no winner yet.
 */
function getWinner() {
    let playerOnePieces = 0;
    let playerTwoPieces = 0;
    let playerOneMoves = 0;
    let playerTwoMoves = 0;

    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const piece = board[r][c];
            if (piece === PLAYER_ONE || piece === KING_ONE) {
                playerOnePieces++;
                if (getValidMoves(r, c, piece === KING_ONE).length > 0) playerOneMoves++;
            } else if (piece === PLAYER_TWO || piece === KING_TWO) {
                playerTwoPieces++;
                if (getValidMoves(r, c, piece === KING_TWO).length > 0) playerTwoMoves++;
            }
        }
    }

    if (playerOnePieces === 0) return PLAYER_TWO;
    if (playerTwoPieces === 0) return PLAYER_ONE;

    if (currentPlayer === PLAYER_ONE && playerOneMoves === 0) return PLAYER_TWO;
    if (currentPlayer === PLAYER_TWO && playerTwoMoves === 0) return PLAYER_ONE;

    return null;
}


/**
 * Initializes WebSocket connection.
 */
function initializeWebSocket() {
    const wsUrl = 'ws://localhost:8080'; // Placeholder URL
    socket = new WebSocket(wsUrl);

    socket.onopen = function(event) {
        console.log('WebSocket connection established to:', wsUrl);
        gameStatusDiv.textContent = 'Connected to server. Waiting for opponent...';
        // Optionally send an initial message, e.g., player identity
        // socket.send(JSON.stringify({ type: 'join', playerId: 'player123' }));
    };

    socket.onmessage = function(event) {
        console.log('Message from server:', event.data);
        try {
            const message = JSON.parse(event.data);
            handleServerMessage(message);
        } catch (error) {
            console.error('Error parsing message from server:', error);
        }
    };

    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
        gameStatusDiv.textContent = 'Connection error. Please try refreshing.';
    };

    socket.onclose = function(event) {
        console.log('WebSocket connection closed:', event);
        gameStatusDiv.textContent = 'Disconnected from server.';
        socket = null; // Ensure we know the socket is closed
    };
}

/**
 * Handles messages received from the WebSocket server.
 * @param {object} message - The parsed message object from the server.
 */
function handleServerMessage(message) {
    switch (message.type) {
        case 'gameState':
            board = message.board;
            currentPlayer = message.currentPlayer;
            renderBoard();
            updateGameStatus();
            console.log('Game state updated from server.');
            break;
        case 'move':
            // Assuming the server validates the move and sends the new board state
            // Or, apply the move locally if the server just relays it
            // For simplicity, let's assume server sends full state or specific move details
            if (message.from && message.to) {
                 // Check if the move is for the *other* player before applying
                if (!isCurrentPlayerPiece(board[message.from.row][message.from.col])) {
                    movePiece(message.from.row, message.from.col, message.to.row, message.to.col, message.isJump);
                    // If server doesn't send new currentPlayer, we need to switch it
                    if (message.currentPlayer !== undefined) {
                        currentPlayer = message.currentPlayer;
                    } else {
                        // If the server only sent the move, and not the new current player,
                        // it implies the turn switches.
                        // However, this is tricky if the server is the source of truth for turns.
                        // Best if server always dictates current player after a move.
                        // For now, if server doesn't specify, we assume it switched.
                         switchPlayer(); // This might be problematic if local player just moved.
                    }
                    renderBoard();
                    updateGameStatus();
                }
            } else if (message.board) { // Fallback to full board update
                board = message.board;
                currentPlayer = message.currentPlayer;
                renderBoard();
                updateGameStatus();
            }
            console.log('Move processed from server.');
            break;
        case 'playerAssignment': // Example: Server assigns player number
            // myPlayerNumber = message.player;
            // gameStatusDiv.textContent = `You are Player ${myPlayerNumber}.`;
            console.log("Player assignment:", message);
            break;
        case 'gameOver':
            gameStatusDiv.textContent = `Game Over! ${message.winner === PLAYER_ONE ? 'Red' : 'Black'} wins!`;
            // Optionally disable board interactions
            break;
        case 'error':
            console.error('Server error message:', message.message);
            gameStatusDiv.textContent = `Error: ${message.message}`;
            break;
        default:
            console.warn('Unknown message type from server:', message.type);
    }
}


// --- Initialize ---
document.addEventListener('DOMContentLoaded', () => {
    initializeBoard();
    renderBoard();
    initializeWebSocket();
    updateGameStatus();
});
