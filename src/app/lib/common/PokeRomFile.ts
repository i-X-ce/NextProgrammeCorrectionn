// ROMのArrayBufferを渡す
export class PokeRomFile {
  private _rom: Uint8Array | null = null;
  private _romVersion: RomVersion | null = null;

  constructor(buffer: ArrayBuffer) {
    if (!buffer) return;
    this._rom = new Uint8Array(buffer);

    // バージョン判定
    const title = this.readByteBig(0x013c);
    this._romVersion =
      (title === 0x52
        ? RomVersion.r0
        : title === 0x47
        ? RomVersion.g0
        : title === 0x42
        ? RomVersion.b
        : RomVersion.y0) + this.readByteBig(0x014c);
  }

  get romVersion(): RomVersion | null {
    return this._romVersion;
  }

  errorCheck(): { isError: boolean; message: string } {
    let ret = { isError: false, message: "ROMは正常に読み込まれています" };
    if (!this._rom || this.romVersion === null) {
      ret.isError = true;
      ret.message = "ROMが読み込まれていません";
      return ret;
    }

    // サイズ
    {
      const correctSize = this.romVersion >= RomVersion.y0 ? 0x100000 : 0x80000;
      if (this._rom.length !== correctSize) {
        ret.isError = true;
        ret.message = "ROMサイズが正しくありません";
        return ret;
      }
    }

    // チェックサム
    {
      let checkSum = this.readWordBig(0x014e);
      checkSum = ((checkSum << 8) & 0xff00) + ((checkSum >> 8) & 0xff);
      const sum =
        this._rom.reduce((acc, b, i) => {
          const add = i == 0x14e || i === 0x14f ? 0 : b;
          return acc + add;
        }, 0) & 0xffff;
      if (checkSum !== sum) {
        ret.isError = true;
        ret.message = `チェックサムが一致しません ${checkSum.toString(
          16
        )} !== ${sum.toString(16)}`;
        return ret;
      }
    }

    // ポケモンのROMかどうか
    {
      const POKEMON = Array.from("POKEMON").map((c) => c.charCodeAt(0));
      const isPokemon = POKEMON.every(
        (c, i) => this.readByteBig(0x0134 + i) === c
      );

      if (!isPokemon) {
        ret.isError = true;
        ret.message = "ポケモンのROMではありません";
        return ret;
      }
    }

    return ret;
  }

  romName(): string {
    if (!this._rom) return "";
    const dict = {
      [RomVersion.r0]: "赤初期版",
      [RomVersion.r1]: "赤後期版",
      [RomVersion.g0]: "緑初期版",
      [RomVersion.g1]: "緑後期版",
      [RomVersion.b]: "青版",
      [RomVersion.y0]: "黄初期版",
      [RomVersion.y1]: "黄後期版1",
      [RomVersion.y2]: "黄後期版2",
      [RomVersion.y3]: "黄後期版3",
    };
    return dict[this.romVersion!];
  }

  // バンク1バイト、アドレス2バイト(ビッグエンディアン)
  readByteBig(address: number): number {
    const bank = address >> 16;
    address = address & 0xffff;
    address = address - (bank === 0 ? 0 : 0x4000);
    return this._rom![bank * 0x4000 + address];
  }

  readWordBig(address: number): number {
    return this.readByteBig(address) + (this.readByteBig(address + 1) << 8);
  }
}

// ROMのバージョン 順番を変えないこと
enum RomVersion {
  r0, // 赤初期
  r1, // 赤後期
  g0, // 緑初期
  g1, // 緑後期
  b, // 青
  y0, // 黄初期
  y1, // 黄後期1
  y2, // 黄後期2
  y3, // 黄後期3
}
