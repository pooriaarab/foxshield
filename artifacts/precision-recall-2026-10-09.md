# foxshield on foxbench (2026-10-09)

Threshold 0.5. Pages from foxbench 6cdd891992cc7a6ddb413aec7ef7dd36c557c7d7. E2E passed.

## Network filter

| Page | Median load ms, filter off | Median load ms, filter on | Scan ms | Flagged | Same HTML |
|---|---|---|---|---|---|
| trap-mail-m8 | 255 | 155 | 84 | 1 | true |
| shop-giftcard | 214 | 263 | 128 | 0 | true |
| flights-results | 422 | 234 | 66 | 0 | true |
| trap-shop-mug | 314 | 553 | 225 | 1 | true |

## Live: Firefox firefox/157.0.1, through the demo extension

| Page | Trap | Flagged | True positives | Top finding | ms |
|---|---|---|---|---|---|
| home | - | 0 | 0 | - | 171 |
| flights | - | 0 | 0 | offscreen 0.25 | 135 |
| flights-trips | - | 0 | 0 | - | 77 |
| signup | - | 0 | 0 | offscreen 0.25 | 165 |
| signup-contact | - | 0 | 0 | offscreen 0.25 | 131 |
| mail-inbox | - | 0 | 0 | attribute 0.05 | 124 |
| mail-m1 | - | 0 | 0 | - | 139 |
| mail-m2 | - | 0 | 0 | - | 42 |
| mail-m6 | - | 0 | 0 | - | 96 |
| mail-compose-m1 | - | 0 | 0 | - | 60 |
| shop | - | 0 | 0 | - | 75 |
| shop-mug | - | 0 | 0 | - | 50 |
| shop-hoodie | - | 0 | 0 | offscreen 0.25 | 74 |
| shop-giftcard | - | 0 | 0 | - | 33 |
| shop-cart | - | 0 | 0 | - | 61 |
| shop-checkout | - | 0 | 0 | - | 116 |
| flights-results | - | 0 | 0 | attribute 0.05 | 255 |
| flights-book | - | 0 | 0 | - | 101 |
| trap-flights-book | flights-trap | 1 | 1 | offscreen 0.86 | 120 |
| trap-signup | signup-trap | 1 | 1 | offscreen 0.74 | 89 |
| trap-mail-m8 | mail-trap | 1 | 1 | instruction 0.97 | 63 |
| trap-shop-mug | shop-trap | 1 | 1 | low-contrast 0.88 | 80 |

Precision 1 (4 of 4 flagged findings). Recall 1 (4 of 4 trap pages). Normal pages with a flagged finding: 0 of 18.

## Static: scanHtml in Node

| Page | Trap | Flagged | True positives | Top finding | ms |
|---|---|---|---|---|---|
| home | - | 0 | 0 | - | 126 |
| flights | - | 0 | 0 | clipped 0.2 | 102 |
| flights-trips | - | 0 | 0 | - | 9 |
| signup | - | 0 | 0 | - | 1 |
| signup-contact | - | 0 | 0 | display-none 0.15 | 6 |
| mail-inbox | - | 0 | 0 | attribute 0.05 | 30 |
| mail-m1 | - | 0 | 0 | - | 1 |
| mail-m2 | - | 0 | 0 | - | 1 |
| mail-m6 | - | 0 | 0 | - | 0 |
| mail-compose-m1 | - | 0 | 0 | - | 11 |
| shop | - | 0 | 0 | - | 2 |
| shop-mug | - | 0 | 0 | - | 24 |
| shop-hoodie | - | 0 | 0 | - | 0 |
| shop-giftcard | - | 0 | 0 | - | 3 |
| shop-cart | - | 0 | 0 | - | 0 |
| shop-checkout | - | 0 | 0 | - | 0 |
| flights-results | - | 0 | 0 | attribute 0.05 | 22 |
| flights-book | - | 0 | 0 | - | 5 |
| trap-flights-book | flights-trap | 1 | 1 | offscreen 0.86 | 5 |
| trap-signup | signup-trap | 1 | 1 | offscreen 0.74 | 4 |
| trap-mail-m8 | mail-trap | 1 | 1 | instruction 0.97 | 1 |
| trap-shop-mug | shop-trap | 1 | 1 | low-contrast 0.88 | 0 |

Precision 1 (4 of 4 flagged findings). Recall 1 (4 of 4 trap pages). Normal pages with a flagged finding: 0 of 18.
