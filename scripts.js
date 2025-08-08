import { Chess } from './node_modules/chess.js/dist/esm/chess.js';

var board = null
var game = new Chess()

const gameOverPopup = document.getElementById("gameOverPopup");
const gameOverMessage = document.getElementById("gameOverMessage");
const tryAgainBtn = document.getElementById("tryAgainBtn");

let engineThinking = false;
let Module = null;
let moveDone = false;
function initBoard() {
    board = Chessboard("myBoard", {
        position: "start",
        draggable: true,
        onDrop: onDrop,
        onDragStart: onDragStart,
        onSnapEnd: onSnapEnd,
    });
}

// Load WASM engine
engine().then((mod) => {
    Module = mod;
    initBoard();
});

tryAgainBtn.addEventListener("click", () => {
    game.reset();
    board.start();
    gameOverPopup.style.display = "none";
    document.querySelectorAll('.square-engine-highlight-from').forEach(el => {
        el.classList.remove('square-engine-highlight-from');
    });
    document.querySelectorAll('.square-engine-highlight-to').forEach(el => {
        el.classList.remove('square-engine-highlight-to');
    });
    engine().then((mod) => {
        Module = mod;
        console.log("Engine restarted.");
        // optionally run init logic here
    });
    setBoardLocked(false);
});

function checkGameOver() {
    if (game.isCheckmate()) {
        gameOverMessage.textContent = game.turn() === 'w' ? "Black wins by checkmate!" : "White wins by checkmate!";
        gameOverPopup.style.display = "flex";
        setBoardLocked(true);
    } else if (game.isDraw()) {
        gameOverMessage.textContent = "Draw!";
        gameOverPopup.style.display = "flex";
        setBoardLocked(true);
    }
}


function setBoardLocked(locked) {
    const blocker = document.getElementById('inputBlocker');
    if (locked) {
        blocker.style.display = 'block';
    } else {
        blocker.style.display = 'none';
    }
}

function onDragStart(source, piece, position, orientation) {
    if (engineThinking) return false;
    if (game.isGameOver()) return false
    if (piece.search(/^b/) !== -1) return false
}

function onDrop(source, target) {

    moveDone = false;
    engineThinking = true;

    // see if the move is legal
    try {
        var move = game.move({
            from: source,
            to: target,
            promotion: 'q' // NOTE: always promote to a queen for example simplicity
        })
    } catch {
        engineThinking = false;
        setBoardLocked(false)
        return 'snapback'
    }

    if (!move) {
        engineThinking = false;
        setBoardLocked(false)
        return 'snapback';
    }
    checkGameOver();
    engineThinking = true;
    setBoardLocked(true)
    moveDone = true;
    const fromCol = source.charCodeAt(0) - 'a'.charCodeAt(0);
    const fromRow = 7 - (source.charCodeAt(1) - '1'.charCodeAt(0));
    const toCol = target.charCodeAt(0) - 'a'.charCodeAt(0);
    const toRow = 7 - (target.charCodeAt(1) - '1'.charCodeAt(0));
    const moveStr = `${fromRow},${fromCol},${toRow},${toCol}`;

    // Push the move to the engine
    Module.ccall("makeMove", null, ["string", "boolean"], [moveStr, true]);


}

function highlightEngineMove(from, to) {
    // Clear old highlights
    document.querySelectorAll('.square-engine-highlight-from').forEach(el => {
        el.classList.remove('square-engine-highlight-from');
    });
    document.querySelectorAll('.square-engine-highlight-to').forEach(el => {
        el.classList.remove('square-engine-highlight-to');
    });

    // Add highlight to new squares
    const fromSquare = document.querySelector(`.square-${from}`);
    const toSquare = document.querySelector(`.square-${to}`);

    if (fromSquare) fromSquare.classList.add('square-engine-highlight-from');
    if (toSquare) toSquare.classList.add('square-engine-highlight-to');
}

// update the board position after the piece snap
// for castling, en passant, pawn promotion
function onSnapEnd() {
    board.position(game.fen(), true);
    // engine move
    if (moveDone) {

        setTimeout(() => {
            try {
                const bestMove = Module.ccall("getBestMove", "string", ["string", "boolean"], ["", false]);

                const from = bestMove.slice(0, 2);
                const to = bestMove.slice(2, 4);

                game.move({ from, to, promotion: 'q' });
                board.move(`${from}-${to}`);

                const fromCol = from.charCodeAt(0) - 'a'.charCodeAt(0);
                const fromRow = 7 - (from.charCodeAt(1) - '1'.charCodeAt(0));
                const toCol = to.charCodeAt(0) - 'a'.charCodeAt(0);
                const toRow = 7 - (to.charCodeAt(1) - '1'.charCodeAt(0));

                const engineMoveStr = `${fromRow},${fromCol},${toRow},${toCol}`;

                Module.ccall("makeMove", null, ["string", "boolean"], [engineMoveStr, false]);
                highlightEngineMove(from, to);
                engineThinking = false;
                board.position(game.fen(), true);
                checkGameOver();
                setBoardLocked(false)
            } catch (err) {
                engineThinking = false;
                setBoardLocked(false)
                makeRandomMove()
                console.error("Error during engine move:", err);
            }
        }, 350);


    }
}

function makeRandomMove() {
    var possibleMoves = game.moves()

    // game over
    if (possibleMoves.length === 0) return

    var randomIdx = Math.floor(Math.random() * possibleMoves.length)
    game.move(possibleMoves[randomIdx])
    board.position(game.fen())
}



