# Voltura Julkalender

A Swedish Christmas calendar with 24 doors, each revealing a different Voltura project. The bilingual calendar opens one new door each day from December 1 through Christmas Eve in Stockholm time.

[Open the calendar](https://x-mas.voltura.se/) · [Svenska](https://x-mas.voltura.se/?language=sv) · [English](https://x-mas.voltura.se/?language=en)

Share links accept `language=sv|en`, `night=on|off`, and `music=on|off`. The browser may require an interaction before starting music.

## Local development

With Node.js 22 or later, run `npm run dev` and open `http://127.0.0.1:4173/`. Run `npm test` to build and check the Worker. The project schedule lives in `src/calendar.json`. A hosted deployment uses the `CALENDAR_SIGNING_KEY` environment secret to sign temporary early-access tokens. The local preview generates its own key.

Project start years use the earliest documented work. WeekNumber, HardTop, and Earner use the years of the original repositories. NetOn’s start year is the author’s estimate for the first version. The store years follow their first documented collections.

The software is [MIT licensed](LICENSE). Instrument Sans is distributed under its [font license](public/assets/instrument-sans-OFL.txt).

Music is [JingleBells_Piano.wav by jess_pfohl](https://freesound.org/people/jess_pfohl/sounds/219327/), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The calendar uses an excerpt edited for looping and encoded as MP3.
