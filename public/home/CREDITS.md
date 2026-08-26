# Home page photography

Editorial photography for `src/app/page.tsx`, self-hosted so the marketing page
has no third-party image dependency at runtime.

The brief is Filipino patients and clinicians. Where a frame's origin could be
confirmed it is noted below: "Shot in" comes from the photo's own location
metadata, and "Region" is the photographer's or subject's country where that is
identifiable from the credit. Frames whose origin could not be confirmed were
still chosen on how they read, not on metadata alone.

Every frame is from Unsplash under the [Unsplash License](https://unsplash.com/license):
free to use commercially, no permission or attribution required. Unsplash+/Getty
premium images were deliberately excluded. The credits below are kept as a courtesy
and so each original can be found again.

| File | Used for | Photographer | Region | Shot in | Original |
| --- | --- | --- | --- | --- | --- |
| `hero.jpg` | Hero, full-bleed behind the headline | Angelyn Sanjorjo (@kiisstherain) | Philippines | Cebu, Philippines | [1srWfgR2XpM](https://unsplash.com/photos/a-group-of-people-sitting-around-a-table-1srWfgR2XpM) |
| `specialists.jpg` | Split feature, "Over 200 specialists across 33 fields" | Harold Hisona (@harold_angus) | Philippines | — | [EiQmC6c4chk](https://unsplash.com/photos/dentist-examining-dental-x-rays-on-light-board-EiQmC6c4chk) |
| `triage.jpg` | Pillar card, "Triage that names the sub-specialty" | Phil Monte (@philgmonte) | Philippines | Tomas Morato Avenue, Quezon City, Philippines | [ExP4uLco-lY](https://unsplash.com/photos/a-man-wearing-a-face-mask-while-talking-on-a-cell-phone-ExP4uLco-lY) |
| `coverage.jpg` | Pillar card, "HMO checked before you book" | National Cancer Institute (@nci) | — | — | [lTZUfrst5fM](https://unsplash.com/photos/doctor-standing-beside-man-inside-room-lTZUfrst5fM) |
| `family.jpg` | Pillar card, "Book for the people you care for" | Eryka Raton (@e_rtn) | Philippines | Manila, Metro Manila, Philippines | [qPvO2-qEhvo](https://unsplash.com/photos/a-woman-and-a-little-girl-hugging-each-other-qPvO2-qEhvo) |
| `reviews.jpg` | Pillar card, "Reviews from completed visits only" | Jeremy Brady (@jeremygbrady) | — | — | [A7STtLEFyQ8](https://unsplash.com/photos/elderly-woman-with-white-hair-in-blue-patterned-shirt-A7STtLEFyQ8) |

## Regenerating

The files are cropped to the sizes the page renders them at (hero 1920×1080,
split feature 1200×800, pillar cards 800×1040) and compressed with mozjpeg.
Replacing one means dropping in a file of the same name and dimensions.
