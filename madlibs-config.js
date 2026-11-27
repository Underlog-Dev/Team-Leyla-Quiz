/* Mad Libs Theatre - central visual configuration.
   Every screen's background artwork is listed here ("wide" = desktop/landscape, "tall" = mobile/portrait AND the streamer capture box).
   To swap artwork later: drop the new files into img/ and change the file names below. The white panels in the art are where the
   text goes; the exact panel positions are the --zx/--zy/--zw/--zh values in css/style.css (search "Mad Libs Theatre").
   Leave a value null to fall back to a plain red-and-gold gradient (text stays readable on its own white backing). */
window.ML_ART = {
  mlhome:    { wide: 'bg-ml-home.jpg',    tall: 'bg-ml-home-tall.jpg' },     /* Play / Back to main menu */
  mlsetup:   { wide: 'bg-ml-setup.jpg',   tall: 'bg-ml-setup-tall.jpg' },    /* game setup (clipboard) */
  mlcollect: { wide: 'bg-ml-collect.jpg', tall: 'bg-ml-collect-tall.jpg' },  /* word requests + answer box */
  mlready:   { wide: 'bg-ml-story.jpg',   tall: 'bg-ml-ready-tall.jpg' },    /* "are the actors ready?" + Reveal */
  mlstory:   { wide: 'bg-ml-story.jpg',   tall: 'bg-ml-story-tall.jpg' }     /* the finished script + The End / Play again */
};
window.ML_THEME = { c1: "#8f1230", c2: "#2a0610", panelBg: null };   /* panelBg: e.g. "rgba(255,255,255,.94)" gives the text a white backing if you ever use art without white panels */
