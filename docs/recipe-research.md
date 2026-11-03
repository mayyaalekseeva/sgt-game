# Recipe research

Every recipe in content/recipes.json is a starting guideline, not the roaster's recipe. Each one is to be
verified with A Sargento before real use. This file records where the numbers came from. Where sources
disagree, the recipe takes the conservative middle and the disagreement is written down here.

The research for the espresso, V60, AeroPress and French press recipes was not written down when those recipes
were added. Add it here when they are next revised.

## filter-kalita v1 (Kalita Wave 155 / 185)

Added 2026-11-03.

| Field | Value | Why |
| --- | --- | --- |
| Dose / water | 16 g / 250 g (1:15.6) | Sources run from 1:13 to 1:19; the median is 1:16. 250 g matches the other single-cup filter recipes. |
| Temperature | 94-96 °C | Six of eight sources give 94-96 °C (201-205 °F). Prima's own guide (99 °C) is the outlier. |
| Grind | medium | Prima and Irving Farm say medium. The comparison's Encore settings (10-17 of 40) span medium-fine to medium. A flat-bottom bed is usually ground a little coarser than a cone, so it is one step coarser than the V60. |
| Bloom | 40 g, stir at 0:10, next pour at 0:45 | Bloom water is 2-3x the dose (2.5x here). Bloom length is 30 s in three sources and 45 s in five, so this uses 45 s. Six of eight stir the bloom. |
| Pours | to 110 g at 0:45, 180 g at 1:15, 250 g at 1:45 | Most sources pulse-pour in 25-100 g steps and finish pouring by about 2:00 (Onyx, Stumptown, Goldsworthy). Three equal 70 g pours keep the bed flat and stay inside that range. |
| Total time | 3:00-3:45 | The small-dose recipes (14-17 g) finish at 3:00-3:15 (Five Elephant) and 3:00-4:00 (Prima). The large-dose ones run 2:45-3:50. |

Dripper size: the app has one Kalita recipe. 16 g fits the 155, which is for one or two cups, and also works in
the 185 with a flatter bed. Filters do not interchange between the two sizes.

### Sources

The numbers below are as each source publishes them. The first seven come from Prima Coffee's side-by-side
comparison, which does not name a dripper size for any of them.

| Source | Dose / water | Temp | Bloom | Pours | Total |
| --- | --- | --- | --- | --- | --- |
| James McCarthy, 2013 US Brewers Cup winner (via Prima) | 24 g / 380 g (1:16) | 96 °C | 50 g, 45 s | pulses to 190 g, then pulses to 380 g | 3:30 |
| Onyx Coffee Lab (via Prima) | 25 g / 400 g (1:16) | 95 °C | 50 g, 30 s, stir | 110 g at 0:30, then four 60 g pulses, done by 2:00 | 3:00 |
| Stumptown (via Prima) | 21 g / 375 g (1:18) | 96 °C | 60 g, stir, to 0:45 | to 200 g by 1:00, 25-50 g pulses to 375 g by 2:00 | 2:45-3:00 |
| George Howell (via Prima) | 25-28 g / 390 g (1:14-1:16) | 94-96 °C | none: 65 g in the first 15 s | six pulses of 65 g every 30 s, done by 2:45 | 3:30 |
| Five Elephant (via Prima) | 14 g / 260 g (1:19) | 96 °C | 40 g, 30 s, stir | to 150 g, then to 260 g at 1:10-1:20 | 3:00-3:15 |
| Crema (via Prima) | 27 g / 400 g (1:15) | 96 °C | 30 g, 30 s | pulses, done by 2:45-3:00 | 3:30-3:50 |
| Todd Goldsworthy (via Prima) | 27 g / 350 g (1:13) | 95 °C | 40 g, 45 s | ~100 g pulses, done by 2:00 | 2:45 |
| Prima Coffee brew guide | 17 g / 250 g (1:14.7) | 99 °C (210 °F) | 50 g, stir, to 0:45 | to 150 g at 0:45, swirl; last 100 g when the bed drains, swirl | 3:00-4:00 |
| Irving Farm (185) | 25 g / 400 g (1:16) | not stated | 70 g, stir, ~45 s | one slow circular pour to 400 g | 3:00-3:30 |

- Prima Coffee, Comparing Kalita Wave recipes: https://prima-coffee.com/learn/article/brewing-guides/comparing-kalita-wave-recipes/33005
- Prima Coffee, Kalita Wave brewing guide: https://prima-coffee.com/blog/kalita-wave-brewing-guide/
- Irving Farm, How to brew Kalita Wave 185: https://irvingfarmcoffee.com/blogs/irving-farm-coffee-roasters/how-2-brew-kalita-wave-185-pourover

### Disagreements

- **Ratio**: 1:13 (Goldsworthy) to 1:19 (Five Elephant). Took the median, 1:16.
- **Temperature**: 94-99 °C. Took the 94-96 °C cluster and left out Prima's 99 °C.
- **Bloom length**: 30 s or 45 s. George Howell has no separate bloom. Took 45 s, the more common one.
- **Pour structure**: a single pour (Irving Farm), two pours (Prima, Five Elephant), or five to six pulses
  (George Howell, Onyx). Took three pours, which sits between them.
- **Swirl at the end**: only Prima swirls after the last pour, and Crema stirs "if needed". Left out.

### Not used

- **Kalita**: kalita.co.jp has the Wave method only as a video (はじめてのハンドドリップ, wave編), with no text
  recipe to cite.
- **Stumptown, George Howell, Drop Coffee, Madcap, Kurasu Kyoto, Origin and Fulcrum**: their own pages refused automated
  reading (HTTP 429 or 403) on 2026-11-03. Search snippets were not used as sources. Stumptown and George
  Howell are covered through Prima's comparison above. Worth reading directly when this recipe is next reviewed.
