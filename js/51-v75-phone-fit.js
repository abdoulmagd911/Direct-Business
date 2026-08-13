/* v75 — phone fit (2026-08-13). Most of the team opens this on a phone.
   Two things were wrong at phone width and only showed up in a screenshot, never in a
   width check (nothing overflowed — it was just squeezed):
     1. THE PAGE TITLE WAS 18 PIXELS WIDE. The top bar carried the menu button, the title,
        the sync pill, the language button and the profile chip. The tools took 288 of 390
        pixels, so "Today" was crushed to "D..". On a phone the pill is hidden, the language
        button keeps only its globe, and the profile chip keeps only the avatar — which
        gives the title back about 200 pixels. Everything is still one tap away.
     2. CARDS SAT IN TWO 174-PIXEL COLUMNS. The Today grids use auto-fit at 180px, so a
        390px phone still made two columns — each barely wider than the words inside, so
        "Today · Aug 13, 2026" wrapped and the tiles looked broken. Below 560px they now
        stack one per row.
   Pure CSS, phone-only, and it changes nothing on a laptop.                                */
(function(){try{
  if(document.getElementById('v75phone'))return;
  var css=document.createElement('style'); css.id='v75phone';
  css.textContent=[
    '@media(max-width:560px){',
    /* --- 1. give the page title room to breathe --- */
    '  .top .tools .btn.sm.ghost[onclick*="expmenu"],',
    '  .top .tools .exp-wrap{display:none!important}',          /* Export lives in each page anyway */
    '  #cl_pill,.top .tools .cl-pill{display:none!important}',   /* the "Live · 44s" status pill */
    '  .top .tools{gap:6px!important;flex:0 0 auto!important}',
    '  .top>div[style*="flex:1"]{min-width:0!important;flex:1 1 auto!important}',
    '  .top h1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}',
    '  .top .sub{display:none!important}',                       /* the subtitle is noise on a phone */
    /* the profile chip keeps its avatar (and stays tappable), drops the words */
    '  #v68me{padding:4px!important;gap:0!important;border-radius:999px!important}',
    '  #v68me>span:not(:first-child){display:none!important}',
    /* --- 2. stop the two cramped columns --- */
    '  .v26-actiongrid,.v26-kpi-grid,.hero.v26-kpi-grid{grid-template-columns:1fr!important}',
    '  .detail-grid{grid-template-columns:1fr!important}',
    '  .chips{grid-template-columns:1fr!important}',
    '}',
    /* the language button: globe only, no word, on the narrowest phones */
    '@media(max-width:420px){',
    '  .top .tools .btn.sm.ghost{padding:6px 8px!important;font-size:0!important}',
    '  .top .tools .btn.sm.ghost svg,.top .tools .btn.sm.ghost span{font-size:12.5px!important}',
    '}'
  ].join('\n');
  document.head.appendChild(css);
  console.info('%c[v75] phone fit loaded','color:#F06820;font-weight:700');
}catch(e){if(window.console)console.warn('[v75] init',e);}})();
