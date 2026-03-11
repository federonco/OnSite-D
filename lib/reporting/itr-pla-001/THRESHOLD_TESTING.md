# ITR-PLA-001 Threshold Testing

## Validation matrix

| Case | Rows | NAME | SIGNATURE | Alignment | Notes | Expected |
|------|------|------|-----------|-----------|-------|----------|
| 1 | 9 | "F. Ronco" | (empty) | "V: +1mm / H: L5mm" | standard | 1 page, notes on page 1 |
| 2 | 10 | "F. Ronco" | (empty) | standard | standard | Overflow (API limits to 9) |
| 3 | 9 | "Firstname M. Lastnamesurname" | (empty) | standard | standard | 1 page, name clipped if needed |
| 4 | 9 | "F. Ronco" | "X" (signature) | standard | standard | 1 page |
| 5 | 9 | standard | standard | "V: +100mm / H: R50mm" | standard | 1 page, alignment may clip |
| 6 | 9 | standard | standard | standard | Extended note text | 1 page, notes wrap |

## How to test

1. **9-row sample**: Use existing section with 9 records. Generate PDF → verify single page, notes visible.
2. **Long NAME**: Edit a record to set inspector_name = "Firstname M. Lastnamesurname" (20+ chars). Generate → verify no layout break, text clips.
3. **Long alignment**: Set deflection values to extremes (e.g. V: +100mm, H: R50mm). Generate → verify cell doesn't break layout.
4. **10+ rows**: Generator and API reject with clear error. Call `generateITRPla001Pdf` with 10+ records → expect thrown Error. API with >9 rows → 400 with message.

## Pass criteria

- 9 rows: single page, all content visible, notes on page 1
- Long NAME: overflow hidden, no column expansion
- Long alignment: overflow hidden
- Page No: "1 of 1" for completed ITR
