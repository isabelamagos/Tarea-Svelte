<script>
	import {onMount} from 'svelte';
	import {generateBoard, countNeighbours} from "./board";
	import {randomBegin, getOpenCells, bombEqualNum, randomGuess, oneDoubleTwoOne, oneTwoOne} from "./solver";

	`
(1. Array of N*M Size -> Three Presets -> Small, Medium, Large)
(2. 3 Difficulties -> Easy , Medium , Hard -> N0 of Mines increases)
3. 4  states = { empty = 0 ; bomb = -1 ; number = 1-8 ; flag = 'F'  }
3.5 Array structure => [ [ el , cellVisibility ] ]
4. On left-click empty, -> remove all connected empties.
4.5 On left-click bomb, -> lose
4.5.2 On left-click num , -> chording
(5. -> Different colors for diff numbers) `

	export let state = false;    
	let board = [[]]
	let mines = 80;
	let bCount = mines;
	let cellsClicked = [];
	let move = [0,0]

	board = generateBoard(board , [30,16], mines);
	board = countNeighbours(board);


	function showCell(i , j) {
		if (board[i][j][0] === -1) {
			state = true;
		}
		board[i][j][1] = true;
		if (board[i][j][0] === 0) {
			for (let k = -1; k <= 1 ; k++) {
				for (let y = -1; y <= 1 ; y++) {
					try {
						if (board[i+k][j+y][0] !== -1 && board[i+k][j+y][1] === false) {
							showCell(i+k , j+y)
						}
					}
					catch(msg){}
				}
			}
		}
	}

	function hideCell(i , j) {
		board[i][j][1] = false;
		bCount += 1;

	}

	function flagCell(i , j) {
		if (board[i][j][1] !== 'F') {
			board[i][j][1] = 'F';
			bCount -= 1;
		}
	}

	function chord(row , col) {
		const dx = [1, 1, 1, 0, 0, -1, -1, -1];
		const dy = [1, 0, -1, 1, -1, 1, 0, -1];
		let fcount = 0;
		if (board[row][col][0] >= 1) {
			for (let i = 0 ; i < 8 ; i++) {
				let nr = row + dy[i], nc = col + dx[i];
				if (nr >= 0 && nr < board.length && nc >= 0 && nc < board[row].length ) {
					if (board[nr][nc][1] === 'F' ) {
						fcount += 1;
					}
				}
			}
		}
		if (fcount === board[row][col][0]) {
			for (let i = 0 ; i < 8 ; i++) {
				let nr = row + dy[i], nc = col + dx[i];
				if (nr >= 0 && nr < board.length && nc >= 0 && nc < board[row].length ) {
					if (board[nr][nc][0] === 0) {
						showCell(nr,nc);
					}
					if (board[nr][nc][1] !== 'F') {
						board[nr][nc][1] = true;
						showCell(nr, nc);
					}
					if (board[nr][nc][1] === 'F' && board[nr][nc][0] !== -1) {
						state = true;
					}
				}
			}
		}
		return board;
	}


	function newGame() {
		state = false;
		board = generateBoard(board , [30,16], 80);
		board = countNeighbours(board);
		bCount = 80;
		move = [0,0]
	}

	function endGame() {
		state = true;
		autoSolve(true, false);
		newGame();
	}

	function checkWin() {
		for (let i = 0; i < board.length ; i++) {
			for (let j = 0 ; j < board[i].length ; j++) {
				if (board[i][j][1] === 'F' && board[i][j][0] !== -1) {
					return false
				}
				if (board[i][j][1] === false) {
					return false
				}
			}
		}
		return true
	}

	move = randomBegin(board);
	showCell(move[0], move[1])
	function autoSolve(oneMove, toggle) {
		if (toggle) {
			let delay = 0;
			setTimeout(()=> {
				delay = 0;
				let possCells = getOpenCells(board);
				let marked = bombEqualNum(possCells, board);
				if (marked.length > 0) {
					for (let i = 0; i < marked.length; i++) {
						for (let j = 0 ; j < marked[i].length; j++) {
							
							setTimeout(function() {
								flagCell(marked[i][j][0],marked[i][j][1]);
							}, i)
						}
					}
					delay *= 40;
				}
				else if (marked.length === 0) {
					try {
						let [toFlag, toOpen] = oneDoubleTwoOne(getOpenCells(board), board);
						if (toFlag.length > 0) {
							console.table(toFlag);
							for (let i = 0; i < toFlag.length; i++) {
								setTimeout(function () {
									flagCell(toFlag[i][0], toFlag[i][1]);
								}, i)
							}
						}
						if (toOpen.length > 0) {
							for (let i = 0; i < toOpen.length; i++) {
								setTimeout(function () {
									showCell(toOpen[i][0], toOpen[i][1]);
								}, i)
							}
						}
					}
					catch(msg){}
					let [toFlag, toOpen] = oneTwoOne(getOpenCells(board), board);
					if (toFlag.length > 0) {
						console.table(toFlag);
						for (let i = 0; i < toFlag.length; i++) {
							setTimeout(function () {
								flagCell(toFlag[i][0], toFlag[i][1]);
							}, i)
						}
					}
					if (toOpen.length > 0) {
						for (let i = 0; i < toOpen.length; i++) {
							setTimeout(function () {
								showCell(toOpen[i][0], toOpen[i][1]);
							}, i)
						}
					}

				}
				for (let i = 0; i < possCells.length; i++) {
					setTimeout(function() {
						chord(possCells[i][0],possCells[i][1])
					}, i)
					delay++
				}

				delay = 0;
				if (!oneMove || state) {
					autoSolve(false, true);
				}
			},10)
		}
	}


</script>

<svelte:window
	on:keydown={(press) => {
		if (press.key === 'Enter') {
			newGame();
		}
	}}/>


<main>
	<h1 class="game-container">Minesweeper Svelte</h1>
	<h3 class="game-container">Flags left: {bCount}</h3>

	<div class="game-container">
		{#if state === true}
			<h1 class="end">You Lost</h1>
			<h3 class="end">Press Enter to try again</h3>
		{:else if bCount === 0 && checkWin()}
			<h1 class="end">You Win!</h1>
			<h3 class="end">Press Enter to play again</h3>
		{/if}
		<div>
			{#each board as row, i}
				<div class="row">
					{#each row as cell, j}
						{#if state === false}
							{#if board[i][j][1] === true }
								{#if board[i][j][0] === 0}
									<div on:contextmenu|preventDefault class="cell empty "></div>
								{:else if board[i][j][0] > 0}
									<div on:contextmenu|preventDefault on:click={()=> {chord(i,j)}}  class="cell num">{board[i][j][0]}</div>
								{:else}
									<div on:contextmenu|preventDefault="{() => {hideCell(i,j)}}" class="cell bomb"></div>
								{/if}
							{:else if board[i][j][1] === 'F'}
								<div on:contextmenu|preventDefault="{() => {hideCell(i,j)}}" class="cell flag"></div>
							{:else}
								<div on:click={()=> {showCell(i,j)}} on:contextmenu|preventDefault="{() => {flagCell(i,j)}}" class="cell hidden "></div>
							{/if}


						{:else}
							<div class = "lost">
							{#if board[i][j][0] === 0}
								<div on:contextmenu|preventDefault class="cell empty "></div>
							{:else if board[i][j][0] > 0}
								<div on:contextmenu|preventDefault class="cell num">{board[i][j][0]}</div>
							{:else}
								<div on:contextmenu|preventDefault="{() => {hideCell(i,j)}}" class="cell bomb"></div>
							{/if}
							</div>
						{/if}
					{/each}
				</div>
			{/each}
		</div>
	</div>
	<div class="button-container">
		<div>
			<button class="btn" on:click={()=> {autoSolve(false, true)}}>Solve</button>
		</div>
		<div>
			<button class="btn" on:click={endGame}>Play Again</button>
		</div>
		<div>
			<button class="btn" on:click={()=> {autoSolve(true, true)}}>Next Layer</button>
		</div>
	</div>

</main>

<style>

	button{
		height: 33px;
		width: 100%;
		margin: 2px;
	}

	.btn {
		padding: 15px 12px;
		height: 60px;
		width: 150px;
		outline: none;
		text-decoration: none;
		justify-content: center;
		align-items: center;
		cursor: pointer;
		text-transform: uppercase;
		background-color: #1d1d1d;
		border-radius: 10px;
		color: #ffffff;
		font-weight: 600;

		font-size: 20px;
		font-family: inherit;
		z-index: 0;
		overflow: hidden;
		transition: all 0.3s cubic-bezier(0.02, 0.01, 0.47, 1);
		border: 1px solid rgba(255, 255, 255, 0.6);
	}

	.button-container {
		padding-top: 5%;
		position: relative;
		display: flex;
		justify-content: center;
		align-items: center;
	}


	.game-container {
		position: relative;
		display: flex;
		justify-content: center;
		align-items: center;

	}
	.row {
		cursor: pointer;
		display: flex;
		box-shadow: 2px 0px 25px 0px rgba(0,0,0,0.55);
		-webkit-box-shadow: 2px 0px 25px 0px rgba(0,0,0,0.55);
		-moz-box-shadow: 2px 0px 25px 0px rgba(0,0,0,0.55);
	}

	.cell {
		width: 30px;
		height: 30px;
		border: solid 1px #4c4c4c;;
		border-radius: 27%;
	}
	.empty {
		background-color: #373737;
		cursor: default;
	}

	.bomb {
		border-radius: 100%;
		background-color: red;

	}

	.num {
		font-size: 15px;
		background-color: #014b69;
		border-radius: 100%;
		cursor: default;
		display: flex; /* or inline-flex */
		align-items: center;
		justify-content: center;
		color: white;
	}

	.hidden {
		background-color: #181818;
	}

	.flag {
		background-color: greenyellow;
	}
	h1 {
		color: #ffffff;
		font-size: 4em;
		font-weight: 600;
	}

	.end {
		color: white;
		position: absolute;
		z-index: 1000;
		top: 25%;
		left: 50%;
		transform: translate(-50% , -25%);
		-webkit-transform: translate(-50%, -25%);
		text-shadow: 0px 0px 14px rgba(0,0,0,0.59);


	}

	.lost {
		cursor: default;
		opacity: 25%;
	}

	.cell:hover {
		filter: brightness(150%);
	}
</style>
