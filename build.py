#!/usr/bin/env python3
"""Generates the static pages for liquid build. Run: python3 build.py"""
import os, html

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")
PHONE = "305-833-5025"
PHONE_TEL = "+13058335025"
EMAIL = "uwecerron@gmail.com"
AREA = "Fort Lauderdale · Miami · Palm Beach"

NAV = [
    ("home-development.html", "Home Development"),
    ("design-build.html", "Design-Build"),
    ("commercial.html", "Commercial"),
    ("schools.html", "Schools"),
    ("data-centers.html", "Data Centers"),
]

PROJECT_TYPES = [
    "Land / home development",
    "Design-build",
    "New custom home",
    "Renovation / addition",
    "Commercial build-out",
    "School / education",
    "Data center / industrial",
    "Other",
]


def logo(cls=""):
    return f'<span class="logo {cls}"><b>liquid</b><i>build</i></span>'


def header(active, over_photo):
    links = "".join(
        '<a href="/' + href + '"' + (' aria-current="page"' if href == active else '') + '>' + label + '</a>'
        for href, label in NAV
    )
    return f"""
<header class="site-header{' on-photo' if over_photo else ''}">
  <div class="wrap bar">
    <a href="/" class="brand" aria-label="liquid build home">{logo()}</a>
    <input type="checkbox" id="nav-toggle" class="nav-toggle" aria-label="Open menu">
    <label for="nav-toggle" class="burger" aria-hidden="true"><span></span><span></span></label>
    <nav aria-label="Main">{links}<a href="#quote" class="pill">Get a quote</a></nav>
  </div>
</header>"""


def quote_form(preset, headline="Let's <em>build.</em>", sub="Land, a lot or a lease — tell us what you have. We reply within one business day."):
    opts = "".join(
        f'<option{" selected" if t == preset else ""}>{html.escape(t)}</option>' for t in PROJECT_TYPES
    )
    return f"""
<section id="quote" class="quote wrap grid">
  <div class="quote-copy">
    <h2 class="display">{headline}</h2>
    <p class="muted lead">{sub}</p>
    <p class="contact-lines"><a href="tel:{PHONE_TEL}">{PHONE}</a><br><a href="mailto:{EMAIL}">{EMAIL}</a><br><span class="muted">{AREA}</span></p>
  </div>
  <form class="quote-form" action="/api/quote" method="post" data-quote>
    <div class="row2">
      <label>Name<input name="name" type="text" autocomplete="name" required></label>
      <label>Phone<input name="phone" type="tel" autocomplete="tel" required></label>
    </div>
    <label>Email<input name="email" type="email" autocomplete="email" required></label>
    <div class="row2">
      <label>Project<select name="project">{opts}</select></label>
      <label>Location<input name="location" type="text" placeholder="City or address"></label>
    </div>
    <label>Details<textarea name="details" rows="3" placeholder="Size, budget, timeline — whatever you know"></textarea></label>
    <label class="hp" aria-hidden="true">Company website<input name="company_website" type="text" tabindex="-1" autocomplete="off"></label>
    <input type="hidden" name="page" value="">
    <button type="submit" class="btn dark">Request a quote</button>
    <p class="form-status" role="status" aria-live="polite"></p>
  </form>
</section>"""


def footer():
    links = "".join(f'<a href="/{h}">{l}</a>' for h, l in NAV)
    return f"""
<footer class="site-footer">
  <div class="wrap foot">
    <div>{logo('dark')}<p class="muted">Liquid Build LLC · {AREA}</p><p class="muted license" data-license></p></div>
    <div class="foot-links">{links}</div>
    <div class="foot-links"><a href="tel:{PHONE_TEL}">{PHONE}</a><a href="mailto:{EMAIL}">{EMAIL}</a><a href="https://liquidpermit.com/">Liquid Permit</a><a href="https://www.liquid-labor.com/">Liquid Labor</a></div>
  </div>
</footer>"""


def page(filename, title, desc, body, active="", over_photo=True):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="/images/dev-aerial.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23141414'/%3E%3Cpath d='M12 40c6-5 12-5 20 0s14 5 20 0' stroke='%236FC3CF' stroke-width='5' fill='none' stroke-linecap='round'/%3E%3Cpath d='M16 30V20l16-8 16 8v10' stroke='%23fff' stroke-width='4' fill='none' stroke-linejoin='round'/%3E%3C/svg%3E">
</head>
<body>
{header(active, over_photo)}
<main>
{body}
</main>
{footer()}
<script src="/site.js" defer></script>
</body>
</html>"""


def hero(img, alt, h1, sub, cta="Start your project", tall=False):
    return f"""
<section class="hero{' tall' if tall else ''}">
  <img src="/images/{img}" alt="{html.escape(alt)}" fetchpriority="high">
  <div class="scrim"></div>
  <div class="wrap hero-inner">
    <h1 class="display">{h1}</h1>
    <div class="hero-side">
      <p>{sub}</p>
      <a href="#quote" class="btn accent">{cta}</a>
    </div>
  </div>
</section>"""


def dark_hero(eyebrow, h1, sub):
    return f"""
<section class="hero dark-hero">
  <div class="wrap hero-inner">
    <div>
      <p class="eyebrow">{eyebrow}</p>
      <h1 class="display">{h1}</h1>
    </div>
    <div class="hero-side">
      <p>{sub}</p>
      <a href="#quote" class="btn accent">Talk to us</a>
    </div>
  </div>
</section>"""


def stats(items):
    cells = "".join(f'<div><div class="stat">{a}</div><div class="muted small">{b}</div></div>' for a, b in items)
    return f'<section class="stats"><div class="wrap stat-grid">{cells}</div></section>'


def fig(img, alt, name, meta, h=300):
    return f'<figure><img src="/images/{img}" alt="{html.escape(alt)}" loading="lazy" style="height:{h}px"><figcaption><b>{name}</b><span>{meta}</span></figcaption></figure>'


def list_block(title_html, rows, imgs):
    r = "".join(f'<div class="row"><span>{a}</span><span class="muted">{b}</span></div>' for a, b in rows)
    pics = "".join(f'<img src="/images/{i}" alt="{html.escape(a)}" loading="lazy">' for i, a in imgs)
    return f"""
<section class="band">
  <div class="wrap grid">
    <div class="band-copy"><h2 class="display">{title_html}</h2><div class="rows">{r}</div></div>
    <div class="band-pics">{pics}</div>
  </div>
</section>"""


def steps(title, items):
    s = "".join(f'<li><span class="num">{i+1}</span><b>{a}</b><p class="muted">{b}</p></li>' for i, (a, b) in enumerate(items))
    return f'<section class="wrap section"><h2 class="display">{title}</h2><ol class="steps">{s}</ol></section>'


def cards(title, items, note=""):
    c = "".join(f'<div class="card"><b>{a}</b><p class="muted">{b}</p></div>' for a, b in items)
    n = f'<p class="muted small note">{note}</p>' if note else ""
    return f'<section class="wrap section"><h2 class="display">{title}</h2><div class="cards">{c}</div>{n}</section>'


COMMUNITIES = f"""
<section class="wrap section">
  <div class="section-head"><h2 class="display">Communities</h2><p class="muted">Developed by our team at Shores Development &amp; Selenis</p></div>
  <div class="mosaic">
    <div class="m-big">{fig('redland-ranches.jpg','New single-family homes rising on graded land at Redland Ranches','Redland Ranches · Redland','57 homes',520)}</div>
    <div class="m-stack">
      {fig('toscana.jpg','Rendering of a one-story Mediterranean-style Toscana home','Toscana','24 single-family homes',250)}
      {fig('casabella.jpg','Rendering of a two-story Casabella home with tile roof','Casabella','Two-story model',250)}
    </div>
  </div>
  <div class="triple">
    <div class="line"><b>Las Palmas</b><span class="muted">19 units</span></div>
    <div class="line"><b>Villa Harbour</b><span class="muted">Waterfront community renovation</span></div>
    <div class="line"><b>Mid-rise</b><span class="muted">25-unit building</span></div>
  </div>
</section>"""

COMMERCIAL_GRID = f"""
<section class="wrap section">
  <h2 class="display">Commercial <em>build-outs</em></h2>
  <div class="grid4">
    {fig('chilis-fiu.jpg',"Finished circular bar inside a Chili's restaurant","Chili's","FIU, Miami")}
    {fig('starbucks-buildout.jpg','Crew installing millwork at a Starbucks counter','Starbucks','Miami')}
    {fig('restaurant-counter.jpg','Finished quick-service restaurant counter with menu boards','Quick-service restaurant','Build-out')}
    {fig('oasis-key-biscayne.jpg','Renovated Oasis storefront in Key Biscayne','Oasis','Key Biscayne')}
  </div>
</section>"""

SECTORS = """
<section class="wrap section">
  <h2 class="display">What we <em>build</em></h2>
  <div class="sectors">
    <a href="/home-development.html"><b>Home Development</b><span>Land to finished communities</span></a>
    <a href="/design-build.html"><b>Design-Build</b><span>One contract, one team</span></a>
    <a href="/commercial.html"><b>Commercial</b><span>Restaurant &amp; retail build-outs</span></a>
    <a href="/schools.html"><b>Schools</b><span>Charter, private &amp; higher-ed</span></a>
    <a href="/data-centers.html"><b>Data Centers</b><span>Power-first sites &amp; shells</span></a>
  </div>
</section>"""

pages = {}

pages["index.html"] = page(
    "index.html",
    "Liquid Build — South Florida Builder & Developer",
    "Liquid Build develops and builds communities, custom homes, commercial space, schools and data centers across South Florida.",
    hero("dev-aerial.jpg", "Aerial view of a new single-family community under construction", "From raw land<br><em>to keys in hand.</em>",
         "We develop and build communities, custom homes, commercial space, schools and data centers across South Florida.", tall=True)
    + stats([("300+", "homes &amp; condo units developed"), ("100", "homes across three communities"), ("Land → Keys", "sitework, vertical, finishes"), ("GC", "licensed general contracting")])
    + SECTORS + COMMUNITIES + COMMERCIAL_GRID
    + quote_form("Land / home development"),
)

pages["home-development.html"] = page(
    "home-development.html",
    "Home Development — Liquid Build",
    "Single-family communities in South Florida, from land and entitlements to sitework, model homes and closings.",
    hero("dev-aerial.jpg", "Aerial view of a new single-family community under construction", "Home<br><em>development.</em>",
         "Raw land in, finished streets out. We take single-family communities from entitlements to closings.")
    + stats([("57", "homes · Redland Ranches"), ("24", "homes · Toscana"), ("19", "units · Las Palmas"), ("300+", "units developed by our team")])
    + steps("Land to keys", [
        ("Land & feasibility", "Site due diligence, yield studies, budget and schedule before you close."),
        ("Entitlements & permits", "Plats, zoning and building permits, coordinated with Liquid Permit."),
        ("Sitework", "Clearing, fill, roads, drainage, water and sewer."),
        ("Vertical", "Model homes first, then production building lot by lot."),
    ])
    + COMMUNITIES
    + quote_form("Land / home development", "Have land?<br><em>Let's plan it.</em>"),
    "home-development.html",
)

pages["design-build.html"] = page(
    "design-build.html",
    "Design-Build — Liquid Build",
    "One contract, one team: design, permitting and construction under Liquid Build.",
    hero("pool-aerial.jpg", "Aerial view of a new pool and spa with paver deck", "Design-<em>build.</em>",
         "One contract. One team from first sketch to final inspection — so price and schedule are set early and stay put.")
    + cards("Why <em>design-build</em>", [
        ("One point of contact", "Design, engineering, permits and construction run through one team."),
        ("Price early", "Budget is set during design, not after bids come back high."),
        ("Faster start", "Permits and early site work move while drawings are finished."),
        ("Fewer change orders", "The people drawing it are the people building it."),
    ])
    + steps("How it works", [
        ("Program", "What you need, where, and for how much."),
        ("Design", "Architects and engineers draw to the budget."),
        ("Permit", "Plans submitted and tracked with Liquid Permit."),
        ("Build", "Our crews build it, then hand you the keys."),
    ])
    + list_block("We design-build", [("Custom homes", "New builds, additions, pools"), ("Commercial", "Restaurant &amp; retail"), ("Schools", "Classrooms, campuses"), ("Industrial", "Warehouses, data centers")],
                 [("new-home-pool.jpg", "New home under construction with pool forms"), ("team-on-site.jpg", "Project team reviewing plans on site")])
    + quote_form("Design-build", "Start with<br><em>a sketch.</em>"),
    "design-build.html",
)

pages["commercial.html"] = page(
    "commercial.html",
    "Commercial Build-Outs — Liquid Build",
    "Restaurant and retail build-outs in South Florida, built to brand spec and opening date.",
    hero("chilis-fiu.jpg", "Finished circular bar inside a Chili's restaurant at FIU", "Commercial<br><em>build-outs.</em>",
         "Restaurant and retail interiors built to the brand's spec — and the opening date.")
    + COMMERCIAL_GRID
    + list_block("What we <em>deliver</em>", [("Restaurants", "Kitchens, bars, dining rooms"), ("Retail", "Storefronts &amp; interiors"), ("Offices", "Tenant improvements"), ("Hospitality", "Renovations while open")],
                 [("interior-buildout.jpg", "Commercial interior under construction with new ceiling lighting"), ("starbucks-buildout.jpg", "Crew installing millwork at a Starbucks counter")])
    + quote_form("Commercial build-out", "Opening date?<br><em>We'll hit it.</em>"),
    "commercial.html",
)

pages["schools.html"] = page(
    "schools.html",
    "Schools & Education — Liquid Build",
    "Charter, private and higher-education construction in South Florida — built around the school calendar.",
    hero("albizu-university.jpg", "Carlos Albizu University campus building in Miami", "Schools &amp;<br><em>campuses.</em>",
         "New classrooms, renovations and campus work — scheduled around the school calendar so students never miss a day.")
    + cards("What we <em>build</em>", [
        ("Charter &amp; private schools", "New buildings, conversions and additions."),
        ("Higher education", "Floor remodels, labs, food service and student spaces."),
        ("Summer renovations", "Work phased to finish before the first bell."),
        ("Safety &amp; hardening", "Impact windows, secure entries, fire and life safety."),
    ], "Recent: second-floor remodel at Carlos Albizu University; Chili's at FIU's Graham Center.")
    + steps("Built around the calendar", [
        ("Walkthrough", "We tour the campus and map what can't be disrupted."),
        ("Phase plan", "Work split into windows — nights, weekends, summers."),
        ("Permit", "Plans filed and tracked with Liquid Permit."),
        ("Build &amp; hand over", "Rooms ready, inspected and clean before class."),
    ])
    + quote_form("School / education", "Next school year?<br><em>Start now.</em>"),
    "schools.html",
)

pages["data-centers.html"] = page(
    "data-centers.html",
    "Data Centers — Liquid Build",
    "Power-first data center and industrial construction in Florida: site, sitework, shell and electrical coordination.",
    dark_hero("DATA CENTERS · INDUSTRIAL", "Power first.<br><em>Built fast.</em>",
              "The constraint is megawatts, not square feet. We plan sites around power and build the shell, pads and infrastructure to energize on schedule.")
    + cards("What we <em>deliver</em>", [
        ("Site &amp; power diligence", "Utility capacity, interconnection timeline, flood and zoning checks before you buy."),
        ("Sitework", "Grading, pads, duct banks, drainage and access roads."),
        ("Shell &amp; core", "Tilt-up and pre-engineered structures ready for fit-out."),
        ("Electrical &amp; mechanical coordination", "Switchgear, generator yards and cooling plant, coordinated with your engineers."),
        ("Modular &amp; edge", "Prefabricated modules and small edge sites."),
        ("Permits", "Local and state approvals tracked with Liquid Permit."),
    ])
    + steps("From land to energized", [
        ("Find power", "Screen sites by available megawatts and time to energize."),
        ("Lock the site", "Due diligence, entitlements and utility agreements."),
        ("Build", "Sitework, pads, shell and infrastructure in parallel."),
        ("Energize", "Commissioning support and hand-over to operations."),
    ])
    + f'<section class="wrap section callout"><p>Tracking the U.S. data center build-out: <a href="https://www.liquid-labor.com/tracker/">Liquid Labor project tracker →</a></p></section>'
    + quote_form("Data center / industrial", "Have a site<br><em>or a load?</em>", "Send the location and the megawatts you need. We reply within one business day."),
    "data-centers.html",
    over_photo=False,
)

pages["thanks.html"] = page(
    "thanks.html",
    "Thanks — Liquid Build",
    "Your request was sent.",
    f'<section class="wrap section thanks"><h1 class="display">Got it. <em>Talk soon.</em></h1><p class="lead muted">We reply within one business day. Need us sooner? Call <a href="tel:{PHONE_TEL}">{PHONE}</a>.</p><p><a class="btn dark" href="/">Back to home</a></p></section>',
    over_photo=False,
)

pages["404.html"] = page(
    "404.html", "Not found — Liquid Build", "Page not found.",
    '<section class="wrap section thanks"><h1 class="display">Nothing <em>built here.</em></h1><p><a class="btn dark" href="/">Back to home</a></p></section>',
    over_photo=False,
)

import re
for name, content in pages.items():
    # clean URLs: /schools.html -> /schools, /index -> /
    content = re.sub(r'href="/([a-z0-9-]+)\.html"', lambda m: 'href="/' + ('' if m.group(1) == 'index' else m.group(1)) + '"', content)
    with open(os.path.join(OUT, name), "w") as f:
        f.write(content)
print("built", len(pages), "pages")
