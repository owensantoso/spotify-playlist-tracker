declare module "kuroshiro" {
  export default class Kuroshiro {
    init(analyzer: unknown): Promise<void>;
    convert(
      input: string,
      options?: {
        to?: "hiragana" | "katakana" | "romaji";
        mode?: "normal" | "spaced" | "okurigana" | "furigana";
        romajiSystem?: "hepburn" | "passport" | "nippon";
      },
    ): Promise<string>;
  }
}

declare module "kuroshiro-analyzer-kuromoji" {
  export default class KuromojiAnalyzer {
    constructor(options?: { dictPath?: string });
    init(): Promise<void>;
    parse(input: string): Promise<unknown[]>;
  }
}

declare module "kroman" {
  export function parse(input: string): string;
}
