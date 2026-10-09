# foxshield on foxbench (2026-10-09)

Threshold 0.5. Pages from foxbench 6cdd891992cc7a6ddb413aec7ef7dd36c557c7d7. E2E passed.

## Network filter

| Page | Median load ms, filter off | Median load ms, filter on | Scan ms | Flagged | Same HTML |
|---|---|---|---|---|---|
| trap-mail-m8 | 65 | 48 | 13 | 1 | true |
| shop-giftcard | 45 | 44 | 14 | 0 | true |
| flights-results | 86 | 58 | 111 | 0 | true |
| trap-shop-mug | 46 | 58 | 19 | 1 | true |

## Hiding-technique page (live)

19 of 19 planted notes found at or above 0.5.

| Element | Technique | Score |
|---|---|---|
| #h-none | display-none | 0.56 |
| #h-attr | display-none | 0.56 |
| #h-vis | visibility-hidden | 0.56 |
| #h-opacity | opacity-zero | 0.61 |
| #h-offscreen | offscreen | 0.61 |
| #h-indent | offscreen | 0.61 |
| #h-clip | clipped | 0.58 |
| #h-clippath | clipped | 0.58 |
| #h-tiny | tiny-font | 0.64 |
| #h-contrast | low-contrast | 0.66 |
| #h-pseudo | pseudo-content | 0.96 |
| #h-scale | clipped | 0.58 |
| #h-poly | clipped | 0.58 |
| #h-inset | clipped | 0.58 |
| #h-fill | low-contrast | 0.66 |
| #h-svg | low-contrast | 0.66 |
| #h-filter | opacity-zero | 0.61 |
| #h-covered | covered | 0.64 |
| #h-svgtitle | not-rendered | 0.53 |

## Live: Firefox firefox/157.0.1, through the demo extension

| Page | Trap | Flagged | True positives | Top finding | ms |
|---|---|---|---|---|---|
| home | - | 0 | 0 | - | 15 |
| flights | - | 0 | 0 | offscreen 0.25 | 17 |
| flights-trips | - | 0 | 0 | - | 11 |
| signup | - | 0 | 0 | offscreen 0.25 | 15 |
| signup-contact | - | 0 | 0 | offscreen 0.25 | 21 |
| mail-inbox | - | 0 | 0 | attribute 0.05 | 42 |
| mail-m1 | - | 0 | 0 | - | 22 |
| mail-m2 | - | 0 | 0 | - | 19 |
| mail-m6 | - | 0 | 0 | - | 26 |
| mail-compose-m1 | - | 0 | 0 | - | 22 |
| shop | - | 0 | 0 | - | 23 |
| shop-mug | - | 0 | 0 | - | 26 |
| shop-hoodie | - | 0 | 0 | offscreen 0.25 | 30 |
| shop-giftcard | - | 0 | 0 | - | 24 |
| shop-cart | - | 0 | 0 | - | 87 |
| shop-checkout | - | 0 | 0 | - | 50 |
| flights-results | - | 0 | 0 | attribute 0.05 | 82 |
| flights-book | - | 0 | 0 | - | 23 |
| trap-flights-book | flights-trap | 1 | 1 | offscreen 0.86 | 20 |
| trap-signup | signup-trap | 1 | 1 | offscreen 0.74 | 29 |
| trap-mail-m8 | mail-trap | 1 | 1 | instruction 0.97 | 25 |
| trap-shop-mug | shop-trap | 1 | 1 | low-contrast 0.88 | 21 |

Precision 1 (4 of 4 flagged findings). Recall 1 (4 of 4 trap pages). Normal pages with a flagged finding: 0 of 18.

## Static: scanHtml in Node

| Page | Trap | Flagged | True positives | Top finding | ms |
|---|---|---|---|---|---|
| home | - | 0 | 0 | - | 9 |
| flights | - | 0 | 0 | clipped 0.2 | 5 |
| flights-trips | - | 0 | 0 | - | 1 |
| signup | - | 0 | 0 | - | 1 |
| signup-contact | - | 0 | 0 | display-none 0.15 | 1 |
| mail-inbox | - | 0 | 0 | attribute 0.05 | 6 |
| mail-m1 | - | 0 | 0 | - | 0 |
| mail-m2 | - | 0 | 0 | - | 0 |
| mail-m6 | - | 0 | 0 | - | 0 |
| mail-compose-m1 | - | 0 | 0 | - | 0 |
| shop | - | 0 | 0 | - | 1 |
| shop-mug | - | 0 | 0 | - | 1 |
| shop-hoodie | - | 0 | 0 | - | 0 |
| shop-giftcard | - | 0 | 0 | - | 0 |
| shop-cart | - | 0 | 0 | - | 0 |
| shop-checkout | - | 0 | 0 | - | 0 |
| flights-results | - | 0 | 0 | attribute 0.05 | 6 |
| flights-book | - | 0 | 0 | - | 1 |
| trap-flights-book | flights-trap | 1 | 1 | offscreen 0.86 | 2 |
| trap-signup | signup-trap | 1 | 1 | offscreen 0.74 | 1 |
| trap-mail-m8 | mail-trap | 1 | 1 | instruction 0.97 | 0 |
| trap-shop-mug | shop-trap | 1 | 1 | low-contrast 0.88 | 0 |

Precision 1 (4 of 4 flagged findings). Recall 1 (4 of 4 trap pages). Normal pages with a flagged finding: 0 of 18.
