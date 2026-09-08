export const WC_COLORS = ["red", "blue", "green", "yellow"] as const;
export type WCColor = (typeof WC_COLORS)[number];
export type WCValue = number | "skip" | "reverse" | "draw2" | "wild" | "wild4";
export type WCCard = { id: string; color: WCColor | "wild"; value: WCValue };

export type WCState = {
  hands: [WCCard[], WCCard[]];
  deck: WCCard[];
  pile: WCCard[];
  color: WCColor;
  turn: 0 | 1;
  winner: 0 | 1 | null;
  pendingDraw: number;
  message: string;
};

export const WC_LABEL: Record<string, string> = {
  skip: "Skip",
  reverse: "Rev",
  draw2: "+2",
  wild: "Wild",
  wild4: "+4",
};

function buildDeck(): WCCard[] {
  const cards: WCCard[] = [];
  let n = 0;
  for (const color of WC_COLORS) {
    cards.push({ id: `c${n++}`, color, value: 0 });
    for (let v = 1; v <= 9; v++) {
      cards.push({ id: `c${n++}`, color, value: v });
      cards.push({ id: `c${n++}`, color, value: v });
    }
    for (const a of ["skip", "reverse", "draw2"] as const) {
      cards.push({ id: `c${n++}`, color, value: a });
      cards.push({ id: `c${n++}`, color, value: a });
    }
  }
  for (let k = 0; k < 4; k++) {
    cards.push({ id: `c${n++}`, color: "wild", value: "wild" });
    cards.push({ id: `c${n++}`, color: "wild", value: "wild4" });
  }
  return cards;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function wcInitial(): WCState {
  const deck = shuffle(buildDeck());
  const hands: [WCCard[], WCCard[]] = [deck.splice(0, 7), deck.splice(0, 7)];
  let first = deck.shift()!;
  while (first.color === "wild") {
    deck.push(first);
    first = deck.shift()!;
  }
  return {
    hands,
    deck,
    pile: [first],
    color: first.color as WCColor,
    turn: 0,
    winner: null,
    pendingDraw: 0,
    message: "Match the colour or the number.",
  };
}

export const wcTop = (s: WCState) => s.pile[s.pile.length - 1];

export function wcPlayable(s: WCState, card: WCCard): boolean {
  const top = wcTop(s);
  if (s.pendingDraw > 0) {
    // Stack only like-for-like penalties.
    if (top.value === "draw2") return card.value === "draw2";
    if (top.value === "wild4") return card.value === "wild4";
  }
  if (card.color === "wild") return true;
  return card.color === s.color || card.value === top.value;
}

function refill(s: WCState): WCState {
  if (s.deck.length > 0) return s;
  const top = wcTop(s);
  const rest = s.pile.slice(0, -1).map((c) => (c.value === "wild" || c.value === "wild4" ? { ...c, color: "wild" as const } : c));
  return { ...s, deck: shuffle(rest), pile: [top] };
}

function drawCards(s: WCState, seat: 0 | 1, count: number): WCState {
  let st = { ...s, hands: [s.hands[0].slice(), s.hands[1].slice()] as [WCCard[], WCCard[]], deck: s.deck.slice() };
  for (let i = 0; i < count; i++) {
    st = refill(st);
    const c = st.deck.shift();
    if (!c) break;
    st.hands[seat] = [...st.hands[seat], c];
  }
  return st;
}

const other = (s: 0 | 1) => (s === 0 ? 1 : 0) as 0 | 1;

export function wcPlay(s: WCState, seat: 0 | 1, cardId: string, chosen?: WCColor): WCState {
  if (s.winner != null || s.turn !== seat) return s;
  const hand = s.hands[seat];
  const card = hand.find((c) => c.id === cardId);
  if (!card || !wcPlayable(s, card)) return s;

  const hands: [WCCard[], WCCard[]] = [s.hands[0].slice(), s.hands[1].slice()];
  hands[seat] = hand.filter((c) => c.id !== cardId);
  let st: WCState = {
    ...s,
    hands,
    pile: [...s.pile, card],
    color: card.color === "wild" ? chosen ?? "red" : (card.color as WCColor),
    message: "",
  };

  if (hands[seat].length === 0) return { ...st, winner: seat, message: "All cards played." };

  const opp = other(seat);
  if (card.value === "draw2") st.pendingDraw = s.pendingDraw + 2;
  else if (card.value === "wild4") st.pendingDraw = s.pendingDraw + 4;

  // With two players, Skip and Reverse both return the turn to the player.
  if (card.value === "skip" || card.value === "reverse") {
    st.turn = seat;
    st.message = card.value === "skip" ? "Opponent skipped — play again." : "Reversed — play again.";
  } else {
    st.turn = opp;
  }
  return st;
}

/** Draw when you cannot (or choose not to) play. Serves the pending penalty too. */
export function wcDraw(s: WCState, seat: 0 | 1): WCState {
  if (s.winner != null || s.turn !== seat) return s;
  if (s.pendingDraw > 0) {
    const st = drawCards(s, seat, s.pendingDraw);
    return { ...st, pendingDraw: 0, turn: other(seat), message: `Drew ${s.pendingDraw}.` };
  }
  const st = drawCards(s, seat, 1);
  const drawn = st.hands[seat][st.hands[seat].length - 1];
  if (drawn && wcPlayable(st, drawn)) {
    return { ...st, message: "Drew a playable card — play it or pass." };
  }
  return { ...st, turn: other(seat), message: "Drew a card, no play." };
}

export function wcPass(s: WCState, seat: 0 | 1): WCState {
  if (s.winner != null || s.turn !== seat || s.pendingDraw > 0) return s;
  return { ...s, turn: other(seat), message: "Passed." };
}
