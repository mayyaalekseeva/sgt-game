# Cupping research

The Cupping section is based on the SCA cupping form (the classic 100-point form, first published by the SCAA
in 2004). The app is not SCA-certified and gives no Q-grade. This file records what was checked against the
official documents and what is still open. Checked 2026-11-03.

## Sources

1. **SCAA Protocols | Cupping Specialty Coffee**, Specialty Coffee Association of America, revised
   December 16, 2015 (page footers say 07DEC2015). Official SCAA document. It is no longer on scaa.org or
   sca.coffee (both 404), so it was read from the Internet Archive copy of the official URL:
   https://web.archive.org/web/20160402102919/http://scaa.org/PDF/resources/cupping-protocols.pdf
2. **Specialty Coffee Association of America Coffee Cupping Form**, the form sheet itself. No official copy
   could be found online. This copy is hosted by a third party (Atlantic Specialty Coffee), so it is secondary:
   https://atlanticspecialtycoffee.com/wp-content/uploads/SCAA-Official-Cupping-Form.pdf
3. sca.coffee/research/coffee-standards (checked 2026-11-03) now lists only the CVA standards (SCA 102-105).
   The 2004 form and its protocol are no longer published by the SCA.

## Verified

| Fact | Value | Where |
| --- | --- | --- |
| Attributes | Fragrance/Aroma, Flavor, Aftertaste, Acidity, Body, Balance, Uniformity, Clean Cup, Sweetness, Overall; plus Defects | Protocol p. 5; form |
| Quality scale | "a 16-point scale representing levels of quality in quarter point increments between numeric values from 6 to 9": 6.00-6.75 Good, 7.00-7.75 Very Good, 8.00-8.75 Excellent, 9.00-9.75 Outstanding | Protocol p. 5 (table); form legend (same table) |
| Step | 0.25 | Protocol p. 5 |
| Scored per cup | Uniformity, Clean Cup, Sweetness: "awarding 2 points per cup per attribute (10 points maximum score)" | Protocol p. 6, p. 8-9 |
| Cups | "At least 5 cups from each sample should be prepared"; Uniformity "maximum of 10 points if all 5 cups are the same" | Protocol p. 3-4, p. 9 |
| Scored once | The other seven, on the horizontal scale; Overall is "Cupper's Points" | Protocol p. 6-7 |
| Intensity scales | Vertical scales (dry/break, acidity intensity, body level) "are marked for the evaluator's record", not scored | Protocol p. 7; form |
| Defects | Taint (noticeable, not overwhelming, usually aromatic) intensity "2"; fault (overwhelming or unpalatable, usually taste) intensity "4". Record the number of cups with the defect and the intensity; "The defect score is multiplied and subtracted from the total score" | Protocol p. 9; form row "Defects (subtract) Taint=2 Fault=4 # cups Intensity X=" |
| Total | Final Score = Total Score (sum of the attribute scores) - defects | Protocol p. 10; form |
| Bands (on the Final Score) | 90-100 Outstanding, 85-89.99 Excellent, 80-84.99 Very Good (these three: Specialty); < 80.0 Below Specialty Quality (Not Specialty) | Protocol p. 10 |

## Decisions (2026-11-03)

The open points below were decided by the project owner; src/cupping.ts follows them.

1. Scale attributes go from 6 to 10 in 0.25 steps (10 is allowed, nothing below 6).
2. Up to two defect rows per sample, each cups x intensity, summed.
3. Up to five cups per sample (1-5, default 5). With fewer than five, each cup stands for 5/n of the form's cups,
   for the per-cup points and for defects, so the best total is still 100. This is not the SCA way (the form
   has five cups), so the app marks such a sample as scored on fewer cups.
4. The vertical intensity scales are not recorded in v1.

## Open points (as found)

1. **Top of the scale: 9.75 or 10?** The quality-scale table (protocol and form legend) ends at 9.75 and is
   called a 16-point scale. But the form's tick marks run 6 to 10, the protocol says the scale "theoretically
   ranges from a minimum value of 0 to a maximum value of 10 points", and a 100-point total needs 10.
2. **Bottom of the scale: 6 or lower?** The form and the table start at 6.00. The protocol says the scale
   theoretically starts at 0 and "the lower end of the scale is below specialty grade".
3. **More than one defect in a sample.** The form has one defect row (one cup count, one intensity). Neither
   source says what to do when one sample has both a taint and a fault, or two different taints.
4. **Cup count other than 5.** The protocol asks for at least 5 cups and scores 2 points a cup to a maximum of
   10. It does not say how to score 3, 4 or 6 cups.
