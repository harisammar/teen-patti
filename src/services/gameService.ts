import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { ref, push } from 'firebase/database';
import { db, rtdb } from './firebase';
import { Game, Player, Room, Card, BetAction } from '../types';
import { FIREBASE_PATHS } from '../utils/constants';
import { createDeck, dealCards as dealCardsUtil, pickJokerCard } from '../utils/cardUtils';
import { getUserProfile } from './authService';
import {
  determineWinner,
  evaluateHand,
  computeChaalAmount,
  shouldTriggerCounter,
  PlayStatus,
} from '../utils/gameLogic';

/**
 * Starts a new game in the given room. Only the admin can start.
 */
export async function startGame(roomId: string, adminId: string): Promise<Game> {
  const roomRef = doc(db, FIREBASE_PATHS.rooms, roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error('Room not found.');

  const room = roomSnap.data() as Room;
  if (room.adminId !== adminId) throw new Error('Only the admin can start the game.');
  if (room.currentPlayers < 2) throw new Error('Need at least 2 players to start.');

  // Fetch all players in the room
  const playersSnap = await getDocs(
    collection(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.players)
  );
  const playerDocs = playersSnap.docs.filter((d) => !(d.data() as Record<string, unknown>).isSpectator);

  // Build player objects with starting points
  const players: Player[] = [];
  for (let i = 0; i < playerDocs.length; i++) {
    const pDoc = playerDocs[i];
    const profile = await getUserProfile(pDoc.id);
    if (profile) {
      players.push({
        id: pDoc.id,
        uid: pDoc.id,
        name: profile.name,
        avatar: profile.avatar,
        points: room.startingPoints,
        status: 'blind',
        cards: [],
        currentBet: 0,
        isDealer: i === 0,
        isCurrentTurn: i === 1, // Player after dealer goes first
        totalBetThisRound: 0,
      });
    }
  }

  // Create and deal deck
  const deck = createDeck();
  const jokerCard = room.gameVariant === 'ak47' ? pickJokerCard(deck) : undefined;
  const hands = dealCardsUtil(deck, players.length);

  // Assign cards to players (used for hands subcollection only)
  const playersWithCards = players.map((p, i) => ({
    ...p,
    cards: hands[i] || [],
  }));

  // Collect boot amount from each player; cards are empty in the shared game doc
  const pot = room.bootAmount * players.length;
  const playersForDoc = playersWithCards.map((p) => ({
    ...p,
    cards: [] as Card[],         // cards live in private hands subcollection
    points: p.points - room.bootAmount,
    totalBetThisRound: room.bootAmount,
  }));

  const gameRef = doc(collection(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.games));

  const game: Game = {
    id: gameRef.id,
    roomId,
    roundNumber: 1,
    pot,
    currentBet: room.bootAmount,
    currentPlayerIndex: 1,
    players: playersForDoc,
    status: 'playing',
    ...(jokerCard ? { jokerCard } : {}),
    startedAt: Date.now(),
    previousPlayerStatus: null,
    counterTriggered: false,
  };

  // Atomically write game doc + per-player hand docs + room status update
  const batch = writeBatch(db);
  batch.set(gameRef, game);
  batch.update(roomRef, { status: 'playing', currentGameId: gameRef.id });
  for (const p of playersWithCards) {
    const handRef = doc(
      db, FIREBASE_PATHS.rooms, roomId,
      FIREBASE_PATHS.games, gameRef.id,
      'hands', p.uid,
    );
    batch.set(handRef, { cards: p.cards });
  }
  await batch.commit();

  return game;
}

/**
 * Processes a player's bet action atomically via a Firestore transaction.
 */
export async function placeBet(
  gameId: string,
  roomId: string,
  playerId: string,
  amount: number,
  action: BetAction
): Promise<void> {
  const gameRef = doc(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.games, gameId);
  const roomRef = doc(db, FIREBASE_PATHS.rooms, roomId);

  await runTransaction(db, async (transaction) => {
    const [gameSnap, roomSnap] = await Promise.all([
      transaction.get(gameRef),
      transaction.get(roomRef),
    ]);
    if (!gameSnap.exists()) throw new Error('Game not found.');

    const game = gameSnap.data() as Game;
    const playerIndex = game.players.findIndex((p) => p.uid === playerId);
    if (playerIndex === -1) throw new Error('Player not in game.');

    const player = game.players[playerIndex];
    if (!player.isCurrentTurn) throw new Error('Not your turn.');

    const updatedPlayers = [...game.players];
    let newPot = game.pot;
    let newCurrentBet = game.currentBet;
    let newPreviousPlayerStatus = game.previousPlayerStatus ?? null;
    let newCounterTriggered = game.counterTriggered ?? false;

    const playStatus: PlayStatus = player.status === 'seen' ? 'seen' : 'blind';

    if (action === 'fold') {
      updatedPlayers[playerIndex] = { ...player, status: 'folded', isCurrentTurn: false };
    } else if (action === 'call') {
      const betAmount = computeChaalAmount(
        playStatus, game.currentBet,
        game.previousPlayerStatus ?? null, game.counterTriggered ?? false,
      );
      if (player.points < betAmount) throw new Error('Insufficient points.');
      updatedPlayers[playerIndex] = {
        ...player,
        points: player.points - betAmount,
        currentBet: betAmount,
        totalBetThisRound: (player.totalBetThisRound || 0) + betAmount,
        isCurrentTurn: false,
      };
      newPot += betAmount;
      newCurrentBet = betAmount;
      newPreviousPlayerStatus = playStatus;
      newCounterTriggered = shouldTriggerCounter(
        playStatus, game.previousPlayerStatus ?? null, game.counterTriggered ?? false,
      );
    } else if (action === 'raise') {
      const chaalAmount = computeChaalAmount(
        playStatus, game.currentBet,
        game.previousPlayerStatus ?? null, game.counterTriggered ?? false,
      );
      const minRaise = Math.max(chaalAmount + 1, game.currentBet * 2);
      if (amount < minRaise) throw new Error(`Minimum raise is ${minRaise}.`);
      if (player.points < amount) throw new Error('Insufficient points.');
      const potLimit = roomSnap.exists() ? (roomSnap.data() as Room).potLimit : null;
      if (potLimit && newPot + amount > potLimit) {
        throw new Error('Raise would exceed pot limit.');
      }
      updatedPlayers[playerIndex] = {
        ...player,
        points: player.points - amount,
        currentBet: amount,
        totalBetThisRound: (player.totalBetThisRound || 0) + amount,
        isCurrentTurn: false,
      };
      newPot += amount;
      newCurrentBet = amount;
      newPreviousPlayerStatus = playStatus;
      newCounterTriggered = shouldTriggerCounter(
        playStatus, game.previousPlayerStatus ?? null, game.counterTriggered ?? false,
      );
    }

    const nextIndex = findNextActivePlayer(updatedPlayers, playerIndex);
    const activePlayers = updatedPlayers.filter((p) => p.status !== 'folded');

    if (activePlayers.length <= 1) {
      const winner = activePlayers[0];
      const finalPlayers = updatedPlayers.map((p) => ({
        ...p,
        status: p.uid === winner.uid ? ('winner' as const) : p.status,
        points: p.uid === winner.uid ? p.points + newPot : p.points,
        isCurrentTurn: false,
      }));
      transaction.update(gameRef, {
        players: finalPlayers,
        pot: newPot,
        status: 'finished' as const,
        winner: winner.uid,
        winnerHandName: 'Last Player Standing',
      });
      transaction.update(roomRef, { status: 'waiting' });
      return;
    }

    if (nextIndex !== -1) {
      updatedPlayers[nextIndex] = { ...updatedPlayers[nextIndex], isCurrentTurn: true };
    }

    transaction.update(gameRef, {
      players: updatedPlayers,
      pot: newPot,
      currentBet: newCurrentBet,
      currentPlayerIndex: nextIndex,
      previousPlayerStatus: newPreviousPlayerStatus,
      counterTriggered: newCounterTriggered,
      lastAction: { playerId, action, amount, timestamp: Date.now() },
    });
  });
}

function findNextActivePlayer(players: Player[], currentIndex: number): number {
  const total = players.length;
  for (let i = 1; i <= total; i++) {
    const idx = (currentIndex + i) % total;
    if (players[idx].status !== 'folded') {
      return idx;
    }
  }
  return -1;
}

/**
 * Transitions a blind player to seen (reveals their cards to themselves).
 */
export async function peekCards(gameId: string, roomId: string, playerId: string): Promise<void> {
  const gameRef = doc(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.games, gameId);

  await runTransaction(db, async (transaction) => {
    const gameSnap = await transaction.get(gameRef);
    if (!gameSnap.exists()) throw new Error('Game not found.');

    const game = gameSnap.data() as Game;
    const playerIndex = game.players.findIndex((p) => p.uid === playerId);
    if (playerIndex === -1) throw new Error('Player not in game.');

    const player = game.players[playerIndex];
    if (player.status !== 'blind') throw new Error('Player has already seen their cards.');

    const updatedPlayers = [...game.players];
    updatedPlayers[playerIndex] = { ...player, status: 'seen' };
    transaction.update(gameRef, { players: updatedPlayers });
  });
}

/**
 * Initiates a sideshow request.
 * Only valid when: challenger is seen, at least 3 players remain, previous player is seen.
 */
export async function requestSideshow(
  gameId: string,
  roomId: string,
  challengerId: string,
  challengedId: string
): Promise<void> {
  const gameRef = doc(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.games, gameId);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found.');

  const game = gameSnap.data() as Game;
  const challenger = game.players.find((p) => p.uid === challengerId);
  const challenged = game.players.find((p) => p.uid === challengedId);

  if (!challenger || !challenged) throw new Error('Invalid sideshow request.');
  if (challenger.status !== 'seen') throw new Error('You must be seen to request a sideshow.');
  if (challenged.status !== 'seen') throw new Error('The other player must be seen.');

  const activePlayers = game.players.filter((p) => p.status !== 'folded');
  if (activePlayers.length < 3) throw new Error('Need at least 3 active players for sideshow.');

  await updateDoc(gameRef, {
    status: 'sideshow_pending',
    sideshowChallengerId: challengerId,
    sideshowChallengedId: challengedId,
  });
}

/**
 * Responds to a sideshow request (accept or decline).
 */
export async function respondToSideshow(
  gameId: string,
  roomId: string,
  playerId: string,
  accept: boolean
): Promise<void> {
  const gameRef = doc(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.games, gameId);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found.');

  const game = gameSnap.data() as Game;
  if (game.sideshowChallengedId !== playerId) throw new Error('You are not the sideshow target.');

  const updatedPlayers = [...game.players];

  if (!accept) {
    // Declined — game continues normally
    await updateDoc(gameRef, {
      status: 'playing',
      sideshowChallengerId: null,
      sideshowChallengedId: null,
    });
    return;
  }

  // Compare hands — fetch cards from private subcollection, never from shared game doc
  const roomRef = doc(db, FIREBASE_PATHS.rooms, roomId);
  const roomSnap = await getDoc(roomRef);
  const gameVariant = roomSnap.exists() ? (roomSnap.data() as Room).gameVariant : 'classic';

  const challenger = game.players.find((p) => p.uid === game.sideshowChallengerId)!;
  const challenged = game.players.find((p) => p.uid === game.sideshowChallengedId)!;

  const [challengerCards, challengedCards] = await Promise.all([
    getPlayerCards(gameId, roomId, challenger.uid),
    getPlayerCards(gameId, roomId, challenged.uid),
  ]);

  const challengerHand = evaluateHand(challengerCards, gameVariant);
  const challengedHand = evaluateHand(challengedCards, gameVariant);

  // In sideshow, if tie, challenger folds
  const challengerWins = challengerHand.rank > challengedHand.rank ||
    (challengerHand.rank === challengedHand.rank && challengerHand.score > challengedHand.score);

  const loserUid = challengerWins ? challenged.uid : challenger.uid;
  const loserIndex = updatedPlayers.findIndex((p) => p.uid === loserUid);
  if (loserIndex !== -1) {
    updatedPlayers[loserIndex] = { ...updatedPlayers[loserIndex], status: 'folded' };
  }

  const activePlayers = updatedPlayers.filter((p) => p.status !== 'folded');
  if (activePlayers.length <= 1) {
    const sideshowWinnerUid = challengerWins ? challenger.uid : challenged.uid;
    await endGameWithWinner(gameRef, game, updatedPlayers, game.pot, roomId, sideshowWinnerUid, 'Sideshow Winner');
    return;
  }

  await updateDoc(gameRef, {
    players: updatedPlayers,
    status: 'playing',
    sideshowChallengerId: null,
    sideshowChallengedId: null,
  });
}

/**
 * Shows a player's hand (forces showdown when only 2 players left and both are seen).
 */
export async function showHand(gameId: string, roomId: string, playerId: string): Promise<void> {
  const gameRef = doc(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.games, gameId);
  const gameSnap = await getDoc(gameRef);
  if (!gameSnap.exists()) throw new Error('Game not found.');

  const game = gameSnap.data() as Game;
  const player = game.players.find((p) => p.uid === playerId);
  if (!player) throw new Error('Player not in game.');
  if (player.status !== 'seen') throw new Error('You must be seen to show your hand.');

  const roomRef = doc(db, FIREBASE_PATHS.rooms, roomId);
  const roomSnap = await getDoc(roomRef);
  const gameVariant = roomSnap.exists() ? (roomSnap.data() as Room).gameVariant : 'classic';

  await updateDoc(gameRef, { status: 'showdown' });

  // Fetch each active player's cards from their private subcollection
  const activePlayers = game.players.filter((p) => p.status !== 'folded');
  const playersWithCards = await Promise.all(
    activePlayers.map(async (p) => ({
      ...p,
      cards: await getPlayerCards(gameId, roomId, p.uid),
    })),
  );

  const winner = determineWinner(playersWithCards, gameVariant);
  const winnerHand = evaluateHand(winner.cards, gameVariant);

  await endGameWithWinner(gameRef, game, game.players, game.pot, roomId, winner.uid, winnerHand.name);
}

async function endGameWithWinner(
  gameRef: ReturnType<typeof doc>,
  game: Game,
  players: Player[],
  pot: number,
  roomId: string,
  winnerUid: string,
  winnerHandName: string,
): Promise<void> {
  const roomRef = doc(db, FIREBASE_PATHS.rooms, roomId);
  const activePlayers = players.filter((p) => p.status !== 'folded');
  const winner = activePlayers.find((p) => p.uid === winnerUid) ?? activePlayers[0];

  const updatedPlayers = players.map((p) => ({
    ...p,
    status: p.uid === winner.uid ? ('winner' as const) : p.status,
    points: p.uid === winner.uid ? p.points + pot : p.points,
    isCurrentTurn: false,
  }));

  await updateDoc(gameRef, {
    players: updatedPlayers,
    status: 'finished',
    winner: winner.uid,
    winnerHandName,
  });

  await updateDoc(roomRef, { status: 'waiting' });
}

/**
 * Ends the current game session entirely.
 */
export async function endGame(gameId: string, roomId: string): Promise<void> {
  const gameRef = doc(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.games, gameId);
  await updateDoc(gameRef, { status: 'finished' });

  const roomRef = doc(db, FIREBASE_PATHS.rooms, roomId);
  await updateDoc(roomRef, { status: 'waiting', currentGameId: null });
}

/**
 * Restarts the game in the same room.
 */
export async function restartGame(roomId: string, adminId: string): Promise<Game> {
  return startGame(roomId, adminId);
}

/**
 * Fetches a single player's dealt cards from their private hands subcollection.
 * Only the player whose uid matches the document ID can read this (Firestore rules).
 */
export async function getPlayerCards(
  gameId: string,
  roomId: string,
  playerId: string,
): Promise<Card[]> {
  const handRef = doc(
    db, FIREBASE_PATHS.rooms, roomId,
    FIREBASE_PATHS.games, gameId,
    'hands', playerId,
  );
  const snap = await getDoc(handRef);
  return snap.exists() ? (snap.data() as { cards: Card[] }).cards : [];
}

/**
 * Subscribes to a player's own hand in real-time.
 * Firestore rules restrict reads to the owning player only.
 */
export function subscribeToMyHand(
  gameId: string,
  roomId: string,
  playerId: string,
  callback: (cards: Card[]) => void,
): () => void {
  const handRef = doc(
    db, FIREBASE_PATHS.rooms, roomId,
    FIREBASE_PATHS.games, gameId,
    'hands', playerId,
  );
  return onSnapshot(handRef, (snap) => {
    callback(snap.exists() ? (snap.data() as { cards: Card[] }).cards : []);
  });
}

/**
 * Subscribes to real-time game state updates.
 */
export function subscribeToGame(
  gameId: string,
  roomId: string,
  callback: (game: Game | null) => void
): () => void {
  const gameRef = doc(db, FIREBASE_PATHS.rooms, roomId, FIREBASE_PATHS.games, gameId);
  return onSnapshot(gameRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data() as Game);
    } else {
      callback(null);
    }
  });
}

/**
 * Sends an emote event to the Realtime Database for low-latency delivery.
 */
export async function sendEmote(gameId: string, playerId: string, emote: string): Promise<void> {
  const emoteRef = ref(rtdb, `${FIREBASE_PATHS.emotes}/${gameId}`);
  await push(emoteRef, {
    playerId,
    emote,
    timestamp: Date.now(),
  });
}
