import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, Sparkles, Cpu, User, RotateCcw } from 'lucide-react';

const JoinDots = () => {
  const [gameState, setGameState] = useState('menu'); // menu, playing, gameOver
  const [board, setBoard] = useState(Array(6).fill().map(() => Array(7).fill(null)));
  const [currentPlayer, setCurrentPlayer] = useState('human');
  const [winner, setWinner] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [aiThoughts, setAiThoughts] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [winningCells, setWinningCells] = useState([]);
  const [hoveredCol, setHoveredCol] = useState(null);
  const [animatingPieces, setAnimatingPieces] = useState(new Set());
  const boardRef = useRef(null);

  // Check for winner
  const checkWinner = (board, row, col) => {
    const player = board[row][col];
    if (!player) return null;

    const directions = [
      [[0, 1], [0, -1]], // horizontal
      [[1, 0], [-1, 0]], // vertical
      [[1, 1], [-1, -1]], // diagonal
      [[1, -1], [-1, 1]] // anti-diagonal
    ];

    for (const [dir1, dir2] of directions) {
      const cells = [[row, col]];
      
      // Check in both directions
      for (const [dr, dc] of [dir1, dir2]) {
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === player) {
          cells.push([r, c]);
          r += dr;
          c += dc;
        }
      }

      if (cells.length >= 4) {
        setWinningCells(cells);
        return player;
      }
    }

    return null;
  };

  // Advanced threat detection
  const findThreats = (board, player) => {
    const threats = [];
    
    // Check all possible 4-in-a-row positions
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 7; col++) {
        // Check horizontal
        if (col <= 3) {
          const positions = [[row, col], [row, col+1], [row, col+2], [row, col+3]];
          const threat = analyzePositions(board, positions, player);
          if (threat) threats.push(threat);
        }
        
        // Check vertical
        if (row <= 2) {
          const positions = [[row, col], [row+1, col], [row+2, col], [row+3, col]];
          const threat = analyzePositions(board, positions, player);
          if (threat) threats.push(threat);
        }
        
        // Check diagonal
        if (row <= 2 && col <= 3) {
          const positions = [[row, col], [row+1, col+1], [row+2, col+2], [row+3, col+3]];
          const threat = analyzePositions(board, positions, player);
          if (threat) threats.push(threat);
        }
        
        // Check anti-diagonal
        if (row >= 3 && col <= 3) {
          const positions = [[row, col], [row-1, col+1], [row-2, col+2], [row-3, col+3]];
          const threat = analyzePositions(board, positions, player);
          if (threat) threats.push(threat);
        }
      }
    }
    
    // CRITICAL: Check for open-ended 2-in-a-row that could become unblockable
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col <= 4; col++) {
        // Pattern: _XX_ (2 pieces with open ends)
        if (board[row][col] === null && 
            board[row][col+1] === player && 
            board[row][col+2] === player && 
            col+3 < 7 && board[row][col+3] === null) {
          // Check if positions are playable
          const leftPlayable = row === 5 || board[row+1][col] !== null;
          const rightPlayable = row === 5 || board[row+1][col+3] !== null;
          if (leftPlayable || rightPlayable) {
            threats.push({ 
              type: 'critical', 
              column: leftPlayable ? col : col+3, 
              row: row,
              reason: 'open-ended-2'
            });
          }
        }
        
        // Pattern: X_X (split 2 with potential to form open 3)
        if (col <= 3 && 
            board[row][col] === player && 
            board[row][col+1] === null && 
            board[row][col+2] === player) {
          const midPlayable = row === 5 || board[row+1][col+1] !== null;
          if (midPlayable) {
            // Check if this would create open-ended 3
            const leftOpen = col === 0 || board[row][col-1] === null;
            const rightOpen = col+3 >= 7 || board[row][col+3] === null;
            if (leftOpen && rightOpen) {
              threats.push({ 
                type: 'critical', 
                column: col+1, 
                row: row,
                reason: 'prevents-open-3'
              });
            }
          }
        }
      }
    }
    
    return threats;
  };

  const analyzePositions = (board, positions, player) => {
    let playerCount = 0;
    let emptyCount = 0;
    let emptyPositions = [];
    
    for (const [r, c] of positions) {
      if (board[r][c] === player) {
        playerCount++;
      } else if (board[r][c] === null) {
        emptyCount++;
        emptyPositions.push([r, c]);
      }
    }
    
    // Threat if 3 pieces and 1 empty
    if (playerCount === 3 && emptyCount === 1) {
      const [r, c] = emptyPositions[0];
      // Check if position is playable
      if (r === 5 || (r < 5 && board[r+1][c] !== null)) {
        return { type: 'immediate', column: c, row: r };
      }
    }
    
    // Potential threat if 2 pieces and 2 empty
    if (playerCount === 2 && emptyCount === 2) {
      for (const [r, c] of emptyPositions) {
        if (r === 5 || (r < 5 && board[r+1][c] !== null)) {
          return { type: 'potential', column: c, row: r };
        }
      }
    }
    
    return null;
  };

  // Check if board is full
  const isBoardFull = (board) => {
    return board[0].every(cell => cell !== null);
  };

  // Get available column
  const getAvailableRow = (board, col) => {
    for (let row = 5; row >= 0; row--) {
      if (board[row][col] === null) {
        return row;
      }
    }
    return -1;
  };

  // Helper function to check if a move would win
  const checkWinningMove = (board, col, player) => {
    const row = getAvailableRow(board, col);
    if (row === -1) return false;
    
    const testBoard = board.map(r => [...r]);
    testBoard[row][col] = player;
    return checkWinner(testBoard, row, col) === player;
  };

  // Helper function to get all valid moves
  const getValidMoves = (board) => {
    const moves = [];
    for (let col = 0; col < 7; col++) {
      if (getAvailableRow(board, col) !== -1) {
        moves.push(col);
      }
    }
    return moves;
  };

  // Handle column click
  const handleColumnClick = async (col) => {
    if (gameState !== 'playing' || currentPlayer !== 'human' || isAIThinking) return;
    
    const row = getAvailableRow(board, col);
    if (row === -1) return;

    // Animate piece
    const pieceId = `${row}-${col}`;
    setAnimatingPieces(prev => new Set(prev).add(pieceId));

    // Place piece
    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = 'red';
    setBoard(newBoard);
    setLastMove({ row, col });

    // Remove from animating after animation
    setTimeout(() => {
      setAnimatingPieces(prev => {
        const next = new Set(prev);
        next.delete(pieceId);
        return next;
      });
    }, 300);

    // Check for winner
    const winner = checkWinner(newBoard, row, col);
    if (winner) {
      setWinner(winner);
      setGameState('gameOver');
      return;
    }

    if (isBoardFull(newBoard)) {
      setWinner('draw');
      setGameState('gameOver');
      return;
    }

    // Switch to AI
    setCurrentPlayer('ai');
  };

  // AI move
  useEffect(() => {
    if (currentPlayer !== 'ai' || gameState !== 'playing') return;

    const makeAIMove = async () => {
      setIsAIThinking(true);
      setAiThoughts([]);

      try {
        // Convert board to ASCII for Claude
        const boardASCII = board.map(row => 
          row.map(cell => cell === 'red' ? 'R' : cell === 'yellow' ? 'Y' : '.').join(' ')
        ).join('\n');

        // Pre-analyze critical moves
        const validMoves = getValidMoves(board);
        const winningMoves = validMoves.filter(col => checkWinningMove(board, col, 'yellow'));
        const blockingMoves = validMoves.filter(col => checkWinningMove(board, col, 'red'));
        
        // Find all threats
        const yellowThreats = findThreats(board, 'yellow');
        const redThreats = findThreats(board, 'red');
        const immediateRedThreats = redThreats.filter(t => t.type === 'immediate').map(t => t.column);
        const criticalRedThreats = redThreats.filter(t => t.type === 'critical').map(t => t.column);
        const potentialRedThreats = redThreats.filter(t => t.type === 'potential').map(t => t.column);
        
        const analysis = `
Critical Analysis:
- Valid moves: [${validMoves.join(', ')}]
- WINNING moves for AI: [${winningMoves.join(', ') || 'none'}]
- MUST BLOCK opponent wins: [${blockingMoves.join(', ') || 'none'}]
- CRITICAL: Prevent unblockable threats: [${criticalRedThreats.join(', ') || 'none'}]
- Opponent immediate threats: [${immediateRedThreats.join(', ') || 'none'}]
- Opponent building threats: [${potentialRedThreats.join(', ') || 'none'}]
- AI can create threats at: [${yellowThreats.filter(t => t.type === 'immediate').map(t => t.column).join(', ') || 'none'}]`;

        const prompt = `You are playing Connect Four as Yellow (Y) against Red (R). Current board:

${boardASCII}

${analysis}

CRITICAL RULES:
1. If "MUST BLOCK opponent wins" shows ANY columns, you MUST play one of those columns or you lose immediately!
2. If "WINNING moves for AI" shows ANY columns, play one to win immediately!
3. If "CRITICAL: Prevent unblockable threats" shows ANY columns, you MUST block these NOW or opponent will have unstoppable win next turn!
4. Pieces fall to the lowest empty position in a column.

${difficulty === 'easy' ? `
EASY MODE Instructions:
1. If opponent can win next turn, YOU MUST BLOCK (no exceptions!)
2. If you can win, take it (most of the time)
3. Block critical threats that lead to unblockable positions
4. Try to control center columns (3,2,4)
5. Sometimes (30% chance) play a less optimal move after handling critical threats` : ''}
${difficulty === 'medium' ? `
MEDIUM MODE Instructions:
1. ALWAYS block immediate wins (check the analysis above!)
2. ALWAYS take your winning moves
3. ALWAYS block critical threats (open-ended patterns)
4. Block opponent threats early
5. Create multiple threats when possible
6. Control center (3,2,4,1,5)
7. Think 2-3 moves ahead` : ''}
${difficulty === 'hard' ? `
HARD MODE - PERFECT PLAY:
1. PRIORITY ORDER (follow EXACTLY):
   a) WIN if possible (check "WINNING moves for AI")
   b) BLOCK if opponent can win (check "MUST BLOCK")
   c) PREVENT CRITICAL THREATS (check "Prevent unblockable threats")
   d) Create winning threats/forks
   e) Block opponent's developing threats early
   f) Control center columns (3,2,4)
   g) Never allow opponent to get 2-in-a-row with open ends
2. Key patterns to prevent:
   - _XX_ (2 pieces with spaces on both sides)
   - X_X becoming XXX with open ends
3. Analyze EVERY possible opponent response
4. Play PERFECTLY - no mistakes allowed` : ''}

Based on the analysis provided, choose the BEST move.

Respond with ONLY this JSON:
{
  "column": <0-6>,
  "thoughts": [
    "What immediate wins/blocks/critical threats exist",
    "Strategic evaluation of position",
    "Why this specific move is optimal"
  ]
}

REMEMBER: Priority is WIN > BLOCK WIN > PREVENT CRITICAL THREATS > STRATEGY`;

        const response = await window.claude.complete(prompt);
        const aiResponse = JSON.parse(response);
        
        // Update thoughts with animation
        for (let i = 0; i < aiResponse.thoughts.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 300));
          setAiThoughts(prev => [...prev, {
            text: aiResponse.thoughts[i],
            round: board.flat().filter(c => c).length + 1
          }]);
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        // Make the move
        const col = aiResponse.column;
        const row = getAvailableRow(board, col);
        
        if (row !== -1) {
          const pieceId = `${row}-${col}`;
          setAnimatingPieces(prev => new Set(prev).add(pieceId));

          const newBoard = board.map(r => [...r]);
          newBoard[row][col] = 'yellow';
          setBoard(newBoard);
          setLastMove({ row, col });

          setTimeout(() => {
            setAnimatingPieces(prev => {
              const next = new Set(prev);
              next.delete(pieceId);
              return next;
            });
          }, 300);

          const winner = checkWinner(newBoard, row, col);
          if (winner) {
            setWinner(winner);
            setGameState('gameOver');
          } else if (isBoardFull(newBoard)) {
            setWinner('draw');
            setGameState('gameOver');
          } else {
            setCurrentPlayer('human');
          }
        }
      } catch (error) {
        console.error('AI Error:', error);
        setAiThoughts([{
          text: "Using strategic fallback analysis",
          round: board.flat().filter(c => c).length + 1
        }]);
        
        // Smart fallback with threat detection
        const validMoves = getValidMoves(board);
        let chosenMove = null;
        
        // 1. Check for winning move
        for (const col of validMoves) {
          if (checkWinningMove(board, col, 'yellow')) {
            chosenMove = col;
            setAiThoughts(prev => [...prev, {
              text: "Found winning move!",
              round: board.flat().filter(c => c).length + 1
            }]);
            break;
          }
        }
        
        // 2. Block opponent's winning move
        if (chosenMove === null) {
          for (const col of validMoves) {
            if (checkWinningMove(board, col, 'red')) {
              chosenMove = col;
              setAiThoughts(prev => [...prev, {
                text: "Blocking opponent's win!",
                round: board.flat().filter(c => c).length + 1
              }]);
              break;
            }
          }
        }
        
        // 3. Block critical threats (that lead to unblockable positions)
        if (chosenMove === null) {
          const redThreats = findThreats(board, 'red');
          const criticalThreats = redThreats.filter(t => t.type === 'critical' && validMoves.includes(t.column));
          if (criticalThreats.length > 0) {
            chosenMove = criticalThreats[0].column;
            setAiThoughts(prev => [...prev, {
              text: "Preventing critical threat!",
              round: board.flat().filter(c => c).length + 1
            }]);
          }
        }
        
        // 4. Block immediate threats
        if (chosenMove === null) {
          const redThreats = findThreats(board, 'red');
          const immediateThreats = redThreats.filter(t => t.type === 'immediate' && validMoves.includes(t.column));
          if (immediateThreats.length > 0) {
            chosenMove = immediateThreats[0].column;
            setAiThoughts(prev => [...prev, {
              text: "Blocking developing threat",
              round: board.flat().filter(c => c).length + 1
            }]);
          }
        }
        
        // 5. Create own threats or play center
        if (chosenMove === null) {
          const centerPriority = [3, 2, 4, 1, 5, 0, 6];
          for (const col of centerPriority) {
            if (validMoves.includes(col)) {
              chosenMove = col;
              break;
            }
          }
        }
        
        // Make the move
        if (chosenMove !== null) {
          const row = getAvailableRow(board, chosenMove);
          const pieceId = `${row}-${chosenMove}`;
          setAnimatingPieces(prev => new Set(prev).add(pieceId));

          const newBoard = board.map(r => [...r]);
          newBoard[row][chosenMove] = 'yellow';
          setBoard(newBoard);
          setLastMove({ row, col: chosenMove });

          setTimeout(() => {
            setAnimatingPieces(prev => {
              const next = new Set(prev);
              next.delete(pieceId);
              return next;
            });
          }, 300);

          const winner = checkWinner(newBoard, row, chosenMove);
          if (winner) {
            setWinner(winner);
            setGameState('gameOver');
          } else if (isBoardFull(newBoard)) {
            setWinner('draw');
            setGameState('gameOver');
          } else {
            setCurrentPlayer('human');
          }
        }
      } finally {
        setIsAIThinking(false);
      }
    };

    makeAIMove();
  }, [currentPlayer, gameState, board, difficulty]);

  // Start game
  const startGame = (selectedDifficulty) => {
    setDifficulty(selectedDifficulty);
    setGameState('playing');
    setBoard(Array(6).fill().map(() => Array(7).fill(null)));
    setCurrentPlayer('human');
    setWinner(null);
    setAiThoughts([]);
    setLastMove(null);
    setWinningCells([]);
  };

  // Reset game
  const resetGame = () => {
    setGameState('menu');
    setBoard(Array(6).fill().map(() => Array(7).fill(null)));
    setCurrentPlayer('human');
    setWinner(null);
    setAiThoughts([]);
    setLastMove(null);
    setWinningCells([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Menu */}
      {gameState === 'menu' && (
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 shadow-2xl border border-white/20 max-w-md w-full">
            <h1 className="text-6xl font-bold text-center mb-4 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
              Join Dots
            </h1>
            <p className="text-center text-gray-300 mb-8">Connect Four with AI</p>
            
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white text-center mb-4">Select Difficulty</h2>
              
              <button
                onClick={() => startGame('easy')}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-between group"
              >
                <span>Easy</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button
                onClick={() => startGame('medium')}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-between group"
              >
                <span>Medium</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button
                onClick={() => startGame('hard')}
                className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center justify-between group"
              >
                <span>Hard</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game */}
      {(gameState === 'playing' || gameState === 'gameOver') && (
        <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
          <div className="flex gap-8 max-w-7xl w-full">
            {/* Game Board */}
            <div className="flex-1">
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-white/20">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                    Join Dots
                  </h1>
                  <div className="flex items-center gap-4">
                    <div className={`px-4 py-2 rounded-full font-semibold transition-all duration-300 ${
                      currentPlayer === 'human' 
                        ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg shadow-red-500/30' 
                        : 'bg-white/10 text-gray-400'
                    }`}>
                      <User className="inline w-4 h-4 mr-2" />
                      Your Turn
                    </div>
                    <div className={`px-4 py-2 rounded-full font-semibold transition-all duration-300 ${
                      currentPlayer === 'ai' 
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg shadow-yellow-500/30' 
                        : 'bg-white/10 text-gray-400'
                    }`}>
                      <Cpu className="inline w-4 h-4 mr-2" />
                      AI Turn
                    </div>
                  </div>
                </div>

                {/* Board */}
                <div ref={boardRef} className="bg-blue-900/50 rounded-2xl p-4 shadow-inner">
                  <div className="grid grid-cols-7 gap-2">
                    {Array(7).fill().map((_, col) => (
                      <div
                        key={col}
                        className="relative"
                        onClick={() => handleColumnClick(col)}
                        onMouseEnter={() => setHoveredCol(col)}
                        onMouseLeave={() => setHoveredCol(null)}
                      >
                        {/* Column hover effect */}
                        {hoveredCol === col && currentPlayer === 'human' && !isAIThinking && (
                          <div className="absolute top-0 left-0 right-0 h-full bg-white/5 rounded-lg pointer-events-none" />
                        )}
                        
                        {/* Cells */}
                        {board.map((row, rowIndex) => {
                          const isWinning = winningCells.some(([r, c]) => r === rowIndex && c === col);
                          const isLastMove = lastMove?.row === rowIndex && lastMove?.col === col;
                          const isAnimating = animatingPieces.has(`${rowIndex}-${col}`);
                          
                          return (
                            <div
                              key={rowIndex}
                              className={`aspect-square rounded-full border-4 border-blue-800 relative overflow-hidden transition-all duration-300 ${
                                row[col] === null ? 'bg-blue-950/50' : ''
                              } ${currentPlayer === 'human' && !isAIThinking && row[col] === null ? 'cursor-pointer hover:bg-blue-900/50' : ''}`}
                            >
                              {row[col] && (
                                <div className={`absolute inset-0 ${
                                  row[col] === 'red' 
                                    ? 'bg-gradient-to-br from-red-400 to-pink-500 shadow-lg shadow-red-500/50' 
                                    : 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-yellow-500/50'
                                } ${isWinning ? 'animate-pulse' : ''} ${
                                  isAnimating ? 'animate-drop' : ''
                                }`} />
                              )}
                              {isLastMove && !isWinning && (
                                <div className="absolute inset-0 border-4 border-white/50 rounded-full animate-ping" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Game Over */}
                {gameState === 'gameOver' && (
                  <div className="mt-6 text-center">
                    <h2 className="text-3xl font-bold mb-4">
                      {winner === 'draw' ? (
                        <span className="text-gray-300">It's a Draw!</span>
                      ) : winner === 'red' ? (
                        <span className="bg-gradient-to-r from-red-400 to-pink-400 bg-clip-text text-transparent">You Win!</span>
                      ) : (
                        <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">AI Wins!</span>
                      )}
                    </h2>
                    <button
                      onClick={resetGame}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg inline-flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Play Again
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* AI Thinking Panel */}
            <div className="w-96">
              <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-6 shadow-2xl border border-white/20 h-full">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <h2 className="text-xl font-semibold text-white">AI Thoughts</h2>
                  <span className="ml-auto text-sm text-gray-400 capitalize">{difficulty} Mode</span>
                </div>
                
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {isAIThinking && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 animate-pulse">
                      <p className="text-yellow-200 text-sm">Analyzing board...</p>
                    </div>
                  )}
                  
                  {aiThoughts.slice().reverse().map((thought, index) => (
                    <div
                      key={aiThoughts.length - index - 1}
                      className="bg-white/5 border border-white/10 rounded-lg p-3 transform transition-all duration-300"
                      style={{
                        animation: 'slideIn 0.3s ease-out',
                        opacity: index === 0 ? 1 : 0.7 - index * 0.1
                      }}
                    >
                      <p className="text-gray-300 text-sm">{thought.text}</p>
                      <p className="text-gray-500 text-xs mt-1">Move {thought.round}</p>
                    </div>
                  ))}
                  
                  {aiThoughts.length === 0 && !isAIThinking && (
                    <p className="text-gray-500 text-center py-8">AI thoughts will appear here...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        
        @keyframes drop {
          0% { transform: translateY(-600px); }
          100% { transform: translateY(0); }
        }
        
        @keyframes slideIn {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        
        .animate-blob {
          animation: blob 7s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        .animate-drop {
          animation: drop 0.3s ease-in;
        }
      `}</style>
    </div>
  );
};

export default JoinDots;
