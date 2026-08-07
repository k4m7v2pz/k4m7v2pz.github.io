# Replacing Terrain Tiles with PNG: Digging meta.json Truth Out of mix

> Date: 2026-08-07

### 1. Goal and Background

OpenYRWeb's terrain tiles originally lived in .tem files inside mix, described by `[TileSetXXXX]` sections in `temperatmd.ini` (tileSetIndex → SetName/FileName/TilesInSet). The custom tile set `yuanbao` wants PNG replacement: 256×128 tiles plus @2x hi-DPI versions, semantically matching "barracks/light factory/oil well/construction yard" building tiles.

### 2. Digging the Truth Out of mix

The first step was understanding how the engine indexes tiles. A script unzipped `temperatmd.ini` from `ra2md.mix > localmd.mix` and printed each section:

```
TileSet0010: SetName=Cliff Set FileName=Cliff TilesInSet=40
```

**Key finding: `yuanbao`'s `tileSetIndex=10` corresponds to the vanilla "Cliff Set"**. This means:

- Putting custom building tiles on yuanbao's tile numbers will **overwrite every cliff tile on the map that uses that number**;
- If you don't want cliff terrain overwritten, a PNG tileset should only replace the tiles it owns, and missing tiles must fall back to vanilla .tem.

### 3. meta.json Structure

PNG tileset directory layout:

```
tilesets/yuanbao/
├── meta.json            # tile semantics + subTile layout
├── tile_16.png / @2x    # barracks (stone)
├── tile_17.png / @2x    # barracks (brick)
├── tile_20.png / @2x    # light factory
└── oil_well.png / @2x   # oil well
```

Each tile entry in `meta.json`:

```json
{
  "tile": 16,
  "description": "兵营（石头房子）",
  "variants": [{
    "file": "tile_16.png",
    "subTiles": [{
      "x": 0, "y": 0, "w": 256, "h": 128,
      "terrainType": 0, "rampType": 0
    }]
  }]
}
```

### 4. Two Big Pitfalls

#### 4.1 tileSetIndex Overwrites the Cliff Set

After putting a construction-yard tile into yuanbao, the game showed "cliff images became construction-yard images" — because yuanbao's tileSetIndex=10 is exactly the Cliff Set, and tile 1 overwrote cliff tile 1. **Fix: remove the tile 1 entry from meta.json; the cliff set returns to vanilla.**

#### 4.2 SubTile Crash After Removing a Tile

After removing tile 1, the game failed with:

```
SubTile 0 not found
```

Root cause: map data still references cliff tile 1, but the PNG tileset no longer has tile 1; `TileSets.initTileSets` mistakenly used `png.meta.fileName` ("yuanbao") as the TMP fallback prefix, looking for `yuanbao01.tem` (nonexistent), while the vanilla cliff tile is `cliff01.tem` — entry.files ended up empty → getTileImage threw. **Fix: the TMP fallback prefix always uses the vanilla FileName ("Cliff"), so missing tiles fall back to the vanilla cliff tiles.**

### 5. Injection and Verification

- `scripts/gen-inject-page.mjs` recursively collects the tilesets directory (including subdirectories) into the injection manifest;
- After adding PNGs, regenerate inject.html + hard-refresh (Cmd+Shift+R) and re-inject;
- playwright verification: entering Skirmish has no SubTile crash and the canvas renders.

### 6. Conclusion

The truth about PNG tileset replacement: **tileSetIndex decides which vanilla tile set you are replacing**. Picking the wrong index silently overwrites someone else's terrain; deleting tiles triggers a fallback-chain crash. First dig out the index mapping in `temperatmd.ini`, then decide which numbers your PNGs take and where missing tiles fall back — that is the prerequisite for not stepping on landmines.
