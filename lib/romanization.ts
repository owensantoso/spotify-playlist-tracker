import "server-only";

import { pinyin } from "pinyin-pro";

import type { NormalizedPlaylistTrack } from "@/lib/spotify/types";

type KuroshiroLike = {
  init(analyzer: unknown): Promise<void>;
  convert(
    input: string,
    options?: {
      to?: "hiragana" | "katakana" | "romaji";
      mode?: "normal" | "spaced" | "okurigana" | "furigana";
      romajiSystem?: "hepburn" | "passport" | "nippon";
    },
  ): Promise<string>;
};

declare global {
  var __kuroshiroPromise__: Promise<KuroshiroLike> | undefined;
}

const HANGUL_RE = /[\uac00-\ud7af]/;
const KANA_RE = /[\u3040-\u30ff]/;
const HAN_RE = /[\u3400-\u9fff]/;

function hasHangul(value: string) {
  return HANGUL_RE.test(value);
}

function hasKana(value: string) {
  return KANA_RE.test(value);
}

function hasHan(value: string) {
  return HAN_RE.test(value);
}

function collapseRomanizedWhitespace(value: string) {
  return value.replace(/\s+/g, " ").replace(/\s*-\s*/g, "-").trim();
}

async function getKuroshiro() {
  if (!global.__kuroshiroPromise__) {
    global.__kuroshiroPromise__ = (async () => {
      const [{ default: Kuroshiro }, { default: KuromojiAnalyzer }] = await Promise.all([
        import("kuroshiro"),
        import("kuroshiro-analyzer-kuromoji"),
      ]);
      const instance = new Kuroshiro();
      await instance.init(new KuromojiAnalyzer());
      return instance;
    })();
  }

  return global.__kuroshiroPromise__;
}

export async function romanizeText(value: string) {
  if (!value.trim()) {
    return null;
  }

  if (hasHangul(value)) {
    const kroman = await import("kroman");
    const result = collapseRomanizedWhitespace(kroman.parse(value));
    return result && result !== value ? result : null;
  }

  if (hasKana(value)) {
    const kuroshiro = await getKuroshiro();
    const result = collapseRomanizedWhitespace(
      await kuroshiro.convert(value, {
        to: "romaji",
        mode: "spaced",
        romajiSystem: "hepburn",
      }),
    );
    return result && result.toLowerCase() !== value.toLowerCase() ? result : null;
  }

  if (hasHan(value)) {
    const result = collapseRomanizedWhitespace(
      pinyin(value, {
        toneType: "none",
        type: "string",
      }),
    );
    return result && result.toLowerCase() !== value.toLowerCase() ? result : null;
  }

  return null;
}

export async function addRomanizationToNormalizedTracks(tracks: NormalizedPlaylistTrack[]) {
  return Promise.all(
    tracks.map(async (track) => ({
      ...track,
      trackNameRomanized: await romanizeText(track.trackName),
      artistNamesRomanized: (
        await Promise.all(track.artistNames.map(async (artist) => (await romanizeText(artist)) ?? ""))
      ).map((value, index) => value || track.artistNames[index]),
    })),
  );
}
