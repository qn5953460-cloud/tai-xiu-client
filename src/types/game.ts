export type BetChoice = 'TAI' | 'XIU';

export interface GameState {
  timer: number;
  phase: 'betting' | 'result';
  dice: [number, number, number];
  totalBetTai: number;
  totalBetXiu: number;
  history: BetChoice[];
}