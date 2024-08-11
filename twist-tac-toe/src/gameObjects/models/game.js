import Board from './board.js';
import Player from './player.js';
import Role from '../enums/role.js';
import GameState from '../enums/gameState.js';
import GameProp from '../enums/gameProp.js';
import { winnerCheckingSlidingWindow } from '../utils/winnerCheck.js';
import { gameConfig } from '../../data/GameConfig.js';

/**
 * Represents a game object
 * 
 * @property {number} boardSize - the boardSize of the board.
 * @property {Board} board - represents the game board.
 * @property {Player} player1 - represents player 1.
 * @property {Player} player2 - represents player 2.
 * @property {Player} currentPlayer - represents active player in their turn.
 * @property {GameState} state - The current state of the game.
 */
export default class Game {
    /**
     * 
     * @param {number} boardSize - The boardSize of the board.
     * @param {number} winLength - The length of winning line on board.
     * @param {number} numPieces - The pieces players can play on board.
     * @param {boolean} isFifoOrder - First in first out elimination option for pieces played on board .
     */
    constructor(
        boardSizeX = gameConfig.boardSizeX,
        boardSizeY = gameConfig.boardSizeY,
        winLength = gameConfig.winLength,
        numPieces = gameConfig.numPieces,
        isFifoOrder = gameConfig.isFifoOrder
    ) {
        this.winLength = winLength;
        this.isLimitedPieces = false;
        this.numPieces = numPieces;
        this.isFifoOrder = isFifoOrder;

        this.board = new Board(boardSizeX, boardSizeY);
        this.player1 = new Player('Player 1', 'X', Role.P1);
        this.player2 = new Player('Player 2', 'O', Role.P2);
        this.currentPlayer = this.player1;
        this.winner = Role.NONE;
        this.winCells = [];

        this.firstTurnPlayer = this.player1;
        this.totalGamesPlayed = 0;

        this.state = GameState.READY;
    }
    /**
     * 
     * @param {string} prop - Name of the game object property to update
     * @param {Object} arg - Object containing passed arguments
     * @returns 
     */
    updateGameConfig(prop, arg) {

        // Updating game configs is not allowed during an ongoing match.
        if (this.state !== GameState.ONGOING && this.totalGamesPlayed <= 0) {
            // select the property to update and call the function.
            switch (prop) {
                case GameProp.SIZE:
                    return this.updateProp().size(arg['x'], arg['y']);
                case GameProp.WIN_LENGTH:
                    return this.updateProp().winLength(arg['len']);
                case GameProp.IS_LIMITED_PIECES:
                    return this.updateProp().isLimitedPieces(arg['isLimited']);
                case GameProp.NUM_PIECES:
                    return this.updateProp().numPieces(arg['num']);
                case GameProp.IS_FIFO_ORDER:
                    return this.updateProp().isFifoOrder(arg['isFifo']);
                default:
                    return false;
            }
        }
        return false;
    }
    /**
     * To check if the match is ongoing. 
     * 
     * @returns {boolean} - boolean
     */
    isDuringMatch() {
        if (this.state !== GameState.ONGOING && this.totalGamesPlayed <= 0) {
            return false;
        }
        return true;
    }
    /**
     * ==============================================================
     * Reusabel update function
     * 
     */
    updateProp() {
        return Object.freeze({
            /**
             * @param {number} x - 
             * @param {number} y - 
             * @returns {boolean} - boolean
             */
            size: (x, y) => {
                this.board.updateSize(x, y);
                // check the appropriate winLength and update it.
                if (x < this.winLength || y < this.winLength) {
                    const newWinLength = x < y ? x : y;
                    this.winLength = newWinLength;
                }
                return true;
            },
            /**
             * @param {number} len - 
             * @returns {boolean} - boolean
             */
            winLength: (len) => {
                // check the appropriate winLength
                if (this.getBoard().getSize()['x'] >= len || this.getBoard().getSize()['y'] >= len) {
                    this.winLength = len;
                    return true;
                }
                return false;
            },
            /**
             * 
             * @param {boolean} isLimited - 
             * @returns {boolean} - boolean
             */
            isLimitedPieces: (isLimited) => {
                this.isLimitedPieces = isLimited;
                return true;
            },
            /**
             * 
             * @param {number} num - 
             * @returns {boolean} - boolean
             */
            numPieces: (num) => {
                // check the appropriate winLength
                if (this.getBoard().getSize()['x'] * this.getBoard().getSize()['y'] >= num) {
                    game.updateNumPiecesEachPlayer(num);
                    return true;
                }
                return false;
            },
            /**
             * 
             * @param {boolean} isFifo - 
             * @returns {boolean} - boolean
             */
            isFifoOrder: (isFifo) => {
                this.isFifoOrder = isFifo;
                return true;
            },

        });
    }
    /**
     * 
     * @param {number} num 
     */
    updateNumPiecesEachPlayer(num) {
        if (this.state !== GameState.ONGOING) {
            this.numPieces = num
        }
    }
    /**
     * Prepare the game by resetting the gaem board, sorting out turns and resetting players attributes. 
     */
    readyGame() {
        this.state = GameState.PREPARING;
        this.board.resetBoard();
        this.currentPlayer = this.firstTurnPlayer;
        this.currentPlayer.resetPlayerMoveHistory();
        this.winner = Role.NONE;
        this.winCells = [];

        this.state = GameState.READY;
    }
    /**
     * @param {Player} [firstTurnPlayer] 
     */
    resetMatch(firstTurnPlayer = this.player1) {
        this.player1.resetScore();
        this.player2.resetScore();

        this.firstTurnPlayer = firstTurnPlayer;
        this.totalGamesPlayed = 0;
        this.readyGame();
    }
    /**
     * Prepares to start a match by resetting the match and starting a set.
     */
    startGame() {
        this.state = GameState.ONGOING;
    }
    /**
     * Prepares to ready up next game by swapping players' turns and carry out ready up procedures.
     */
    nextGame() {
        this.swapFirstTurn();
        this.readyGame();
    }
    /**
     * 
     * Update game state after checking winner and draw conditions. If nothing else, continue the game
     * 
     * @param {number} posX - X axis position on game board
     * @param {number} posY - Y axis position on game board
     */
    updateGameStateByLastMove(posX, posY) {
        const winCells = this.checkWinner(posX, posY);
        if (winCells) {
            // player ___ wins
            this.winner = this.currentPlayer;
            this.winCells = winCells;
            this.currentPlayer.addScore(1);
            this.totalGamesPlayed++;
            this.state = GameState.FINISHED;
        }
        else if (this.checkValidMoves()) {
            // game continues
            this.swapTurns();
            this.state = GameState.ONGOING;
        }
        else {
            // draw
            this.winner = Role.NONE;
            this.player1.addScore(0.5);
            this.player2.addScore(0.5);
            this.totalGamesPlayed++;
            this.state = GameState.FINISHED;
        }
    }
    /**
     * 
     * @param {number} x 
     * @param {number} y 
     * 
     * @returns {Object[] || boolean} - returns array of objects or false
     * @example [{x: 0, y: 2}, {x: 1, y: 2}, {x: 2, y: 2}]
     */
    checkWinner(x, y) {
        return winnerCheckingSlidingWindow(this.board.cells, this.currentPlayer.role, x, y, this.winLength);
    }

    /**
     * 
     * @returns {boolean} - returns true or false after checking valid moves.
     */
    checkValidMoves() {
        return this.board.hasPlayableSquares();
    }
    /**
     * 
     * @param {number} x - X axis position on game board
     * @param {number} y - Y axis position on game board
     * @returns {boolean}
     */
    playerMakeMove(x, y) {
        // only proceed if game is ongoing
        if (this.state !== GameState.ONGOING) return false;

        const isMarkPlaced = this.board.placeMark(x, y, this.currentPlayer.role);
        if (isMarkPlaced) {
            this.currentPlayer.updatePlayerMove(x, y);

            console.log('=================================');
            console.log('=================================');
            console.log(this.board.cells);
            console.log('=================================');
            console.log(this.player1.moveHistory);
            console.log(this.player2.moveHistory);
            return true;
        }
        return false;
    }
    /**
     * 
     * @returns {Player} - swap turn and returns Player object 
     */
    swapTurns() {
        return this.currentPlayer = this.currentPlayer === this.player1 ? this.player2 : this.player1;
    }
    /**
     * 
     * @returns {Player} - swap turn and returns Player object that determines who play first this game.
     */
    swapFirstTurn() {
        return this.firstTurnPlayer = this.firstTurnPlayer === this.player1 ? this.player2 : this.player1;
    }
    /**
     * Getters ===============================================
     * 
     * @returns {number} - The length of winning decision line on board.
     */
    getWinningLineLength() {
        return this.winLength;
    }
    /**
     * 
     * @returns {boolean} - boolean
     */
    getIsLimitedPieces() {
        return this.isLimitedPieces;
    }
    /**
     * 
     * @returns {number} - Number of pieces each player has and can play on board.
     */
    getNumPiecesEachPlayer() {
        return this.numPieces;
    }
    /**
     * 
     * @returns {boolean} - First in first out elimination option for pieces played on board. 
     */
    getIsFifoOrder() {
        return this.isFifoOrder;
    }
    /**
     * 
     * @returns {Board} - Game board
     */
    getBoard() {
        return this.board;
    }
    /**
     * 
     * @returns {Player} - Get Player One object
     */
    getPlayer1() {
        return this.player1;
    }
    /**
     * 
     * @returns {Player} - Get Player Two object
     */
    getPlayer2() {
        return this.player2;
    }
    /**
     * 
     * @returns {Player} - Get Current Player object
     */
    getCurrentPlayer() {
        return this.currentPlayer;
    }
    /**
     * 
     * @returns {Role} - Get Role object which represents the winner of a game. 
     */
    getGameWinner() {
        return this.winner;
    }
    /**
     * 
     * @returns {Role} - Get Role object of a player who's score is higher. Returns null if scores are equal
     */
    getMatchLeadingPlayer() {
        if (this.player1.score > this.player2.score) {
            return this.player1.role;
        }
        else if (this.player2.score > this.player1.score) {
            return this.player2.role;
        }
        return Role.NONE;
    }
    /**
     * 
     * @returns {Object[]} - Get array of number objects. 
     * @example [{0, 2}, {1, 2}, {2, 2}]
     */
    getWinningSquaresOnBoard() {
        return this.winCells;
    }
    /**
     * 
     * @returns {Player} - returns player who play first turn this game.
     */
    getPlayerToPlayFirst() {
        return this.firstTurnPlayer;
    }
    /**
     * 
     * @returns {number} - total games played in this match.
     */
    getGamesPlayedInMatch() {
        return this.totalGamesPlayed;
    }
    /**
     * 
     * @returns {GameState} - returns game state
     */
    getGameState() {
        return this.state;
    }
}
